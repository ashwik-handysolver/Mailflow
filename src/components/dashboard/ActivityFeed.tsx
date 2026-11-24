import { ReactNode, useMemo, useState } from 'react';
import { FilePlus2, Pencil, Send, UserPlus, Mail } from 'lucide-react';
import { ActivityEventType, ActivityLogItem } from '../../types/outreach';
import { formatRelativeTime } from '../../utils/analytics';
import { EmptyState } from '../ui/Misc';
import { Button } from '../ui/Button';
import { SectionHeader } from '../layout/PageHeader';

const INITIAL = 8;

const TYPE_ICON: Record<ActivityEventType, ReactNode> = {
  campaign_sent: <Send aria-hidden="true" />,
  email_sent: <Mail aria-hidden="true" />,
  lead_added: <UserPlus aria-hidden="true" />,
  lead_updated: <Pencil aria-hidden="true" />,
  template_created: <FilePlus2 aria-hidden="true" />,
};

function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** Bolds quoted names in messages so the object of each event stands out. */
function renderMessage(message: string, onOpen?: () => void): ReactNode {
  const parts = message.split(/("[^"]+")/g);
  return parts.map((part, i) => {
    if (/^"[^"]+"$/.test(part)) {
      const name = part.slice(1, -1);
      return onOpen ? (
        <button key={i} type="button" onClick={onOpen} className="font-medium text-ink hover:underline underline-offset-2">
          {name}
        </button>
      ) : (
        <span key={i} className="font-medium text-ink">
          {name}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface ActivityFeedProps {
  activities: ActivityLogItem[];
  onOpenCampaign: (id: string) => void;
  onOpenLead: (id: string) => void;
  /** Full log: every event, no section header or "Show more". */
  full?: boolean;
}

export function ActivityFeed({ activities, onOpenCampaign, onOpenLead, full = false }: ActivityFeedProps) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(
    () => [...activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [activities]
  );
  const items = full ? sorted : showAll ? sorted.slice(0, 50) : sorted.slice(0, INITIAL);

  const groups = useMemo(() => {
    const out: { label: string; items: ActivityLogItem[] }[] = [];
    for (const item of items) {
      const label = dayLabel(item.timestamp);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [items]);

  const openerFor = (item: ActivityLogItem) => {
    if (!item.relatedId) return undefined;
    if (item.type === 'campaign_sent') return () => onOpenCampaign(item.relatedId!);
    if (item.type === 'lead_added' || item.type === 'lead_updated' || item.type === 'email_sent')
      return () => onOpenLead(item.relatedId!);
    return undefined;
  };

  return (
    <section aria-labelledby="activity-title">
      {!full && <SectionHeader
        title={<span id="activity-title">Activity</span>}
        actions={
          sorted.length > INITIAL ? (
            <Button variant="link" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show less' : 'Show more'}
            </Button>
          ) : undefined
        }
      />}
      {groups.length === 0 ? (
        <EmptyState compact title="No activity yet" />
      ) : (
        <div>
          {groups.map((g) => (
            <div key={g.label}>
              {/* Day label stays visible while its events scroll past. */}
              <h3 className="sticky top-0 z-10 bg-canvas pb-2 pt-6 text-xs font-medium text-ink-3">
                {g.label}
              </h3>
              <ul>
                {g.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-2.5">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-ink-4 [&_svg]:size-3.5">
                      {TYPE_ICON[item.type]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-ui text-ink-2">{renderMessage(item.message, openerFor(item))}</span>
                      <time
                        dateTime={item.timestamp}
                        title={new Date(item.timestamp).toLocaleString()}
                        className="block text-xs tabular-nums text-ink-3"
                      >
                        {Date.now() - new Date(item.timestamp).getTime() < 86_400_000
                          ? formatRelativeTime(item.timestamp)
                          : new Date(item.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </time>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
