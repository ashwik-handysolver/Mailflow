import { LogOut, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigation, useWorkspace } from '../../app/WorkspaceContext';
import { cn } from '../../lib/cn';
import { Menu } from '../ui/Menu';
import { NotificationsBell } from './NotificationsBell';
import { Avatar } from '../ui/Misc';
import avatarUrl from '../../assets/images/avatar_team_lead_1794544071841.jpg';

/** Profile menu (with Settings inside), shown at the right end of the app header on every page. */
export function AccountControls({ className }: { className?: string }) {
  const { page, navigate } = useNavigation();
  const { settings } = useWorkspace();
  const onSettings = page === 'settings';

  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <NotificationsBell />
      <Menu
        width={248}
        header={
          <div className="mb-1 flex items-center gap-2.5 border-b border-line px-2 pb-2.5 pt-1.5">
            <Avatar name={settings.userName} src={settings.avatarDataUrl ?? (supabase ? undefined : avatarUrl)} size="md" />
            <div className="min-w-0">
              <p className="truncate text-ui font-medium text-ink">{settings.userName}</p>
              <p className="truncate text-xs text-ink-3">{settings.senderEmail}</p>
              {(settings.userRole || settings.teamName) && (
                <p className="truncate text-xs text-ink-3">
                  {[settings.userRole, settings.teamName].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        }
        items={[
          { label: 'Settings', icon: <Settings />, onSelect: () => navigate('settings') },
          ...(supabase
            ? [{ label: 'Sign out', icon: <LogOut />, separated: true, onSelect: () => void supabase!.auth.signOut() }]
            : []),
        ]}
        trigger={(p) => (
          <button
            type="button"
            {...p}
            aria-label={`Account menu for ${settings.userName}`}
            title={settings.userName}
            aria-current={onSettings ? 'page' : undefined}
            className={cn(
              'flex size-8 items-center justify-center rounded-full transition-shadow hover:ring-2 hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-accent',
              // On the Settings page, ring the avatar to show where you are.
              onSettings && 'ring-2 ring-accent/40'
            )}
          >
            <Avatar name={settings.userName} src={settings.avatarDataUrl ?? (supabase ? undefined : avatarUrl)} size="md" />
          </button>
        )}
      />
    </div>
  );
}
