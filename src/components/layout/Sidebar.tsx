import { ReactNode, useEffect } from 'react';
import {
  FileText,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Send,
  ScrollText,
  Users,
  X,
} from 'lucide-react';
import { NavPage } from '../../types/outreach';
import { cn } from '../../lib/cn';
import { useNavigation, useWorkspace } from '../../app/WorkspaceContext';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Logo({ collapsed = false, onDark = false }: { collapsed?: boolean; onDark?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* Crops the supplied artwork (public/logo.png) to its black square. */}
      <svg viewBox="90 84 548 548" className="size-7 shrink-0 rounded-md" role="img" aria-label="hs logo">
        <image href="/logo.png" width="743" height="704" />
      </svg>
      {!collapsed && (
        <span className={cn('text-[15px] font-semibold tracking-[-0.01em]', onDark ? 'text-nav-ink' : 'text-ink')}>
          MailFlow
        </span>
      )}
    </div>
  );
}

/** Small icon button styled for the dark navigation surface. */
function NavIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-7 items-center justify-center rounded-md text-nav-ink-3 transition-colors hover:bg-nav-raised hover:text-nav-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { page, navigate, openComposer, selectedLeadIds } = useNavigation();
  const { leads, templates, campaigns } = useWorkspace();

  // Close the mobile drawer on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseMobile();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  const go = (target: NavPage) => {
    navigate(target);
    onCloseMobile();
  };

  const content = (isMobile: boolean) => {
    const isCollapsed = collapsed && !isMobile;
    return (
      <div className="flex h-full flex-col">
        <div className={cn('flex h-14 shrink-0 items-center', isCollapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <button
            type="button"
            onClick={() => go('dashboard')}
            className="rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="MailFlow home"
          >
            <Logo collapsed={isCollapsed} onDark />
          </button>
          {isMobile ? (
            <NavIconButton label="Close navigation" onClick={onCloseMobile}>
              <X />
            </NavIconButton>
          ) : (
            !isCollapsed && (
              <NavIconButton label="Collapse sidebar" onClick={onToggleCollapsed}>
                <PanelLeftClose />
              </NavIconButton>
            )
          )}
        </div>

        <div className={cn('pb-4', isCollapsed ? 'px-2' : 'px-3')}>
          <button
            type="button"
            onClick={() => {
              openComposer({ leadIds: selectedLeadIds });
              onCloseMobile();
            }}
            title={isCollapsed ? 'Compose email' : undefined}
            aria-label="Compose email"
            className={cn(
              'flex w-full items-center gap-2 rounded-lg bg-accent text-ui font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.12)] transition-colors hover:bg-accent-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nav',
              isCollapsed ? 'h-9 justify-center' : 'h-9 justify-center px-3'
            )}
          >
            <PenSquare className="size-4 shrink-0" />
            {!isCollapsed && <span>Compose email</span>}
          </button>
        </div>

        <nav aria-label="Main" className={cn('flex flex-col gap-0.5', isCollapsed ? 'px-2' : 'px-3')}>
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={page === 'dashboard'} collapsed={isCollapsed} onClick={() => go('dashboard')} />
          <NavItem icon={<Users />} label="Leads" count={leads.length} active={page === 'leads'} collapsed={isCollapsed} onClick={() => go('leads')} />
          <NavItem
            icon={<FileText />}
            label="Templates"
            count={templates.length}
            active={page === 'templates'}
            collapsed={isCollapsed}
            onClick={() => go('templates')}
          />
          <NavItem
            icon={<Send />}
            label="Campaigns"
            count={campaigns.length || undefined}
            active={page === 'campaigns'}
            collapsed={isCollapsed}
            onClick={() => go('campaigns')}
          />
          <NavItem icon={<ScrollText />} label="Audit logs" active={page === 'audit'} collapsed={isCollapsed} onClick={() => go('audit')} />
        </nav>

        <div className="flex-1" />

        {!isMobile && isCollapsed && (
          <div className="px-2 pb-3">
            <NavItem icon={<PanelLeftOpen />} label="Expand sidebar" collapsed onClick={onToggleCollapsed} />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 bg-nav transition-[width] duration-200 lg:block',
          collapsed ? 'w-[64px]' : 'w-[232px]'
        )}
      >
        <div className="h-full overflow-hidden">{content(false)}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-scrim/50 animate-fade-in" onClick={onCloseMobile} aria-hidden="true" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative h-full w-[272px] max-w-[85vw] overflow-hidden bg-nav shadow-dialog animate-slide-in-left"
          >
            {content(true)}
          </aside>
        </div>
      )}
    </>
  );
}

interface NavItemProps {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, count, active, collapsed, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'group relative flex h-8 w-full items-center gap-2.5 rounded-md text-ui font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&_svg]:size-4 [&_svg]:shrink-0',
        collapsed ? 'justify-center' : 'px-2.5',
        active
          ? 'bg-nav-raised text-nav-ink [&_svg]:text-nav-ink'
          : 'text-nav-ink-2 hover:bg-nav-raised/60 hover:text-nav-ink [&_svg]:text-nav-ink-3 hover:[&_svg]:text-nav-ink-2'
      )}
    >
      {icon}
      {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
    </button>
  );
}
