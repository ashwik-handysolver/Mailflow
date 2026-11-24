import { useMemo } from 'react';
import { Bell, Clock } from 'lucide-react';
import { useNavigation, useWorkspace } from '../../app/WorkspaceContext';
import { useEmailProvider } from '../../services/emailProvider';
import { DeliveryEvent, useDeliveryEvents } from '../../utils/deliveryEvents';
import { dueFollowUps } from '../../utils/followUps';
import { formatRelativeTime } from '../../utils/analytics';
import { Menu } from '../ui/Menu';

/**
 * Header bell. Lists recent opens and bounces from real sends, and follow-ups
 * that are due (from lead data).
 * Later this feeds push notifications.
 */
export function NotificationsBell() {
  const { leads } = useWorkspace();
  const emailProvider = useEmailProvider();
  const events = useDeliveryEvents();
  const recent = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const nameFor = (e: DeliveryEvent) => leads.find((l) => l.id === e.lead_id)?.fullName ?? e.to_email;
    const items: { id: string; at: string; text: string; leadId: string | null; bounce: boolean }[] = [];
    for (const e of events) {
      if (e.opened_at && new Date(e.opened_at).getTime() > weekAgo)
        items.push({ id: `o_${e.id}`, at: e.opened_at, text: `${nameFor(e)} opened your email`, leadId: e.lead_id, bounce: false });
      if (e.status === 'Bounced' && e.bounced_at && new Date(e.bounced_at).getTime() > weekAgo)
        items.push({ id: `b_${e.id}`, at: e.bounced_at, text: `Email to ${nameFor(e)} bounced`, leadId: e.lead_id, bounce: true });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  }, [events, leads]);
  const { navigate } = useNavigation();
  const due = useMemo(() => dueFollowUps(leads), [leads]);
  const shown = due.slice(0, 6);

  return (
    <Menu
      width={300}
      header={
        <div className="mb-1 border-b border-line px-2 pb-2 pt-1.5">
          <p className="text-ui font-medium text-ink">Notifications</p>
          <div className="mt-2 rounded-md bg-subtle px-2.5 py-2">
            <p className="text-xs font-medium text-ink-2">Opens and bounces</p>
            {recent.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-baseline gap-2 text-xs">
                    <button
                      type="button"
                      disabled={!r.leadId}
                      onClick={() => r.leadId && navigate('leads', { openLeadId: r.leadId })}
                      className={
                        r.bounce
                          ? 'min-w-0 flex-1 truncate text-left text-danger hover:underline'
                          : 'min-w-0 flex-1 truncate text-left text-ink-2 hover:underline'
                      }
                    >
                      {r.text}
                    </button>
                    <span className="shrink-0 text-ink-4">{formatRelativeTime(r.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-3">
                {emailProvider.isSimulated
                  ? 'Connect a sending mailbox in Settings to send real emails.'
                  : 'Nothing in the last 7 days. Opens appear when open tracking is on in Settings.'}
              </p>
            )}
          </div>
          <p className="mt-2.5 text-xs font-medium text-ink-2">
            Follow-ups due {due.length > 0 && <span className="text-ink-3">({due.length})</span>}
          </p>
          {due.length === 0 && <p className="pb-1 text-xs text-ink-3">Nothing due. You're all caught up.</p>}
        </div>
      }
      items={[
        ...shown.map((l) => ({
          label: l.fullName,
          icon: <Clock />,
          hint: l.lastContacted ? formatRelativeTime(l.lastContacted) : 'Never',
          onSelect: () => navigate('leads', { openLeadId: l.id }),
        })),
        ...(due.length > shown.length
          ? [{ label: `View all ${due.length} on the dashboard`, separated: true, onSelect: () => navigate('dashboard') }]
          : []),
      ]}
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label={due.length > 0 ? `Notifications, ${due.length} follow-ups due` : 'Notifications'}
          className="relative flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Bell className="size-[18px]" />
          {due.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
              {due.length > 9 ? '9+' : due.length}
            </span>
          )}
        </button>
      )}
    />
  );
}
