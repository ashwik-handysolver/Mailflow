import { ReactNode, useCallback, useEffect, useState } from 'react';
import { AuthGate, FullScreenMessage } from './components/auth/AuthGate';
import { supabase } from './lib/supabase';
import { applyMailboxes, listMailboxes } from './utils/mailboxes';
import { setRealSending } from './services/emailProvider';
import { clearDeliveryEvents, refreshDeliveryEvents } from './utils/deliveryEvents';
import { Menu as MenuIcon, PenSquare } from 'lucide-react';
import { AppProvider, useNavigation, useWorkspace } from './app/WorkspaceContext';
import { Logo, Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/common/ToastContainer';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { LeadsPage } from './components/leads/LeadsPage';
import { TemplatesPage } from './components/templates/TemplatesPage';
import { AuditLogsPage } from './components/audit/AuditLogsPage';
import { CampaignsPage } from './components/campaigns/CampaignsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { ComposerPage } from './components/composer/ComposerPage';
import { HeaderSlotContext } from './components/layout/PageHeader';
import { AccountControls } from './components/layout/AccountControls';
import { IconButton } from './components/ui/Button';

const SIDEBAR_PREF_KEY = 'mailflow_sidebar_collapsed';

function readSidebarPref(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function Shell() {
  const { page, composeRequest, openComposer, selectedLeadIds } = useNavigation();
  const { toasts, dismissToast } = useWorkspace();
  const [collapsed, setCollapsed] = useState(readSidebarPref);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_PREF_KEY, next ? '1' : '0');
      } catch {
        // Preference only; safe to ignore.
      }
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // The composer is a focused, full-page workflow without the app chrome.
  if (page === 'compose') {
    return (
      <>
        <ComposerPage key={composeRequest.key} request={composeRequest} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} aboveFooter />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh lg:h-dvh lg:overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-ui focus:shadow-overlay"
      >
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-canvas/90 px-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-1.5">
            <IconButton label="Open navigation" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Logo />
          </div>
          <IconButton
            label="Compose email"
            onClick={() => openComposer({ leadIds: selectedLeadIds })}
            className="text-accent hover:text-accent-hover"
          >
            <PenSquare />
          </IconButton>
        </div>

        {/* Header sits on the page itself; on desktop the content below scrolls on its own. */}
        <header className="sticky top-14 z-20 flex items-center bg-canvas pr-3 sm:pr-4 lg:static lg:pr-6">
          {/* Page title and actions are portalled in here by <PageHeader>. */}
          <div ref={setHeaderSlot} className="min-w-0 flex-1" />
          <AccountControls />
        </header>
        <main
          id="main"
          className="relative min-w-0 flex-1 bg-canvas lg:min-h-0 lg:overflow-y-auto scrollbar-thin"
        >
          <HeaderSlotContext.Provider value={headerSlot}>
            <div key={page} className="page-enter">
            {page === 'dashboard' && <DashboardPage />}
            {page === 'leads' && <LeadsPage />}
            {page === 'templates' && <TemplatesPage />}
            {page === 'settings' && <SettingsPage />}
            {page === 'campaigns' && <CampaignsPage />}
            {page === 'audit' && <AuditLogsPage />}
            </div>
          </HeaderSlotContext.Provider>
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      {(session) => (
        // Keyed by user so switching accounts starts from that account's data.
        <AppProvider key={session?.user.id ?? 'local'} db={session ? supabase : null}>
          <SyncGate>
            <Shell />
          </SyncGate>
        </AppProvider>
      )}
    </AuthGate>
  );
}

/** Holds the app until the cloud workspace has loaded, so nothing stale is shown or edited. */
function SyncGate({ children }: { children: ReactNode }) {
  const { syncStatus, applyDeliveryEvents } = useWorkspace();

  // Bounces and opens recorded by the server: check now, every 2 minutes, and when the tab regains focus.
  useEffect(() => {
    if (syncStatus === 'local' || syncStatus === 'loading' || syncStatus === 'load-error') return;
    const pull = () => void refreshDeliveryEvents().then(applyDeliveryEvents);
    pull();
    const timer = window.setInterval(pull, 120_000);
    window.addEventListener('focus', pull);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', pull);
    };
  }, [syncStatus === 'local' || syncStatus === 'loading' || syncStatus === 'load-error', applyDeliveryEvents]);
  useEffect(() => clearDeliveryEvents, []);

  // Switch to real sending if this account has a working mailbox; back to simulation on sign-out.
  useEffect(() => {
    if (syncStatus === 'local') return;
    listMailboxes().then(applyMailboxes, () => setRealSending(null));
    return () => setRealSending(null);
  }, [syncStatus === 'local']);
  if (syncStatus === 'loading') return <FullScreenMessage>Loading your workspace…</FullScreenMessage>;
  if (syncStatus === 'load-error') {
    return (
      <FullScreenMessage>
        <span>
          Couldn't load your workspace from Supabase.{' '}
          <button type="button" className="text-accent underline" onClick={() => window.location.reload()}>
            Try again
          </button>
        </span>
      </FullScreenMessage>
    );
  }
  return <>{children}</>;
}
