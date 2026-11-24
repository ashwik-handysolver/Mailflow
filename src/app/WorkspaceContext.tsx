import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LeadStatus, NavPage } from '../types/outreach';
import { useOutreachStore } from '../store/useOutreachStore';

/* ---------------- Workspace data ---------------- */

export type Workspace = ReturnType<typeof useOutreachStore>;

const WorkspaceCtx = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error('useWorkspace must be used inside <AppProvider>');
  return ctx;
}

/* ---------------- Navigation ---------------- */

/** Resets both the window (mobile) and the desktop content panel, which scrolls on its own. */
function scrollToTop() {
  window.scrollTo({ top: 0 });
  document.getElementById('main')?.scrollTo({ top: 0 });
}

const PAGES: NavPage[] = ['dashboard', 'leads', 'templates', 'campaigns', 'settings', 'compose', 'audit'];

function readRoute(): NavPage {
  const raw = window.location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  return (PAGES as string[]).includes(raw) ? (raw as NavPage) : 'dashboard';
}

/** Deep links: #/leads?lead=<id> opens that lead; #/campaigns?campaign=<id> opens that campaign. */
function readIntent(): PageIntent {
  const query = window.location.hash.split('?')[1];
  if (!query) return {};
  const q = new URLSearchParams(query);
  const lead = q.get('lead');
  const campaign = q.get('campaign');
  return { ...(lead ? { openLeadId: lead } : {}), ...(campaign ? { openCampaignId: campaign } : {}) };
}

export interface ComposeRequest {
  leadIds: string[];
  templateId: string | null;
  /** Changes on every request so the composer starts fresh. */
  key: number;
}

export interface PageIntent {
  /** Open "Add lead" when arriving on Leads. */
  addLead?: boolean;
  /** Open "New template" when arriving on Templates. */
  createTemplate?: boolean;
  /** Pre-filter Leads to this status. */
  leadStatus?: LeadStatus;
  /** Open this lead's panel on arrival. */
  openLeadId?: string;
  /** Open this campaign on the Campaigns page. */
  openCampaignId?: string;
  /** Campaigns page: open the All emails tab, optionally searching for this text. */
  emailSearch?: string;
}

interface Navigation {
  page: NavPage;
  navigate: (page: NavPage, intent?: PageIntent) => void;
  intent: PageIntent;
  clearIntent: () => void;
  composeRequest: ComposeRequest;
  openComposer: (opts?: { leadIds?: string[]; templateId?: string | null }) => void;
  /** Where to return after leaving the composer. */
  returnPage: NavPage;
  selectedLeadIds: string[];
  setSelectedLeadIds: (ids: string[]) => void;
}

const NavigationCtx = createContext<Navigation | null>(null);

export function useNavigation(): Navigation {
  const ctx = useContext(NavigationCtx);
  if (!ctx) throw new Error('useNavigation must be used inside <AppProvider>');
  return ctx;
}

export function AppProvider({ children, db = null }: { children: ReactNode; db?: SupabaseClient | null }) {
  const workspace = useOutreachStore(db);
  const [page, setPage] = useState<NavPage>(readRoute);
  const [intent, setIntent] = useState<PageIntent>(readIntent);
  const [returnPage, setReturnPage] = useState<NavPage>('dashboard');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [composeRequest, setComposeRequest] = useState<ComposeRequest>({
    leadIds: [],
    templateId: null,
    key: 0,
  });

  useEffect(() => {
    const onHashChange = () => {
      setPage(readRoute());
      setIntent(readIntent());
      scrollToTop();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Drop selections that point at deleted leads.
  useEffect(() => {
    setSelectedLeadIds((ids) => {
      const valid = ids.filter((id) => workspace.leads.some((l) => l.id === id));
      return valid.length === ids.length ? ids : valid;
    });
  }, [workspace.leads]);

  const navigate = useCallback((next: NavPage, nextIntent: PageIntent = {}) => {
    setIntent(nextIntent);
    if (`#/${next}` !== window.location.hash) {
      window.location.hash = `/${next}`;
    }
    setPage(next);
    scrollToTop();
  }, []);

  const openComposer = useCallback(
    (opts?: { leadIds?: string[]; templateId?: string | null }) => {
      setReturnPage((current) => (page === 'compose' ? current : page));
      setComposeRequest((prev) => ({
        leadIds: opts?.leadIds ?? [],
        templateId: opts?.templateId ?? null,
        key: prev.key + 1,
      }));
      navigate('compose');
    },
    [navigate, page]
  );

  const nav = useMemo<Navigation>(
    () => ({
      page,
      navigate,
      intent,
      clearIntent: () => setIntent({}),
      composeRequest,
      openComposer,
      returnPage,
      selectedLeadIds,
      setSelectedLeadIds,
    }),
    [page, navigate, intent, composeRequest, openComposer, returnPage, selectedLeadIds]
  );

  return (
    <WorkspaceCtx.Provider value={workspace}>
      <NavigationCtx.Provider value={nav}>{children}</NavigationCtx.Provider>
    </WorkspaceCtx.Provider>
  );
}
