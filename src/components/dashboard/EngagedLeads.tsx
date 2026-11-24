import { useState } from 'react';
import { Flame, PenSquare } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../utils/analytics';
import { EngagementFilter, LeadEngagement } from '../../utils/dashboardData';
import { LEAD_STATUS_COLOR } from '../common/StatusBadge';
import { InfoTip } from '../ui/InfoTip';
import { Badge, BadgeTone } from '../ui/Badge';
import { Avatar } from '../ui/Misc';
import { LeadStatus } from '../../types/outreach';
import { CARD } from '../ui/Card';

const FILTERS: { value: EngagementFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'opened', label: 'Opened' },
  { value: 'followup', label: 'Follow-up due' },
  { value: 'noresponse', label: 'No opens' },
  { value: 'bounced', label: 'Bounced' },
];

/** Heat: opens are good news (green), overdue follow-ups need a nudge (amber), bounces are a problem (red). */
const TIER_TONE: Record<number, BadgeTone> = {
  1: 'success',
  2: 'warning',
  3: 'success',
  4: 'neutral',
  5: 'danger',
};

function StagePill({ status }: { status: LeadStatus }) {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-ink-2">
      <span className="size-1.5 rounded-full" style={{ background: LEAD_STATUS_COLOR[status] }} aria-hidden="true" />
      {status}
    </span>
  );
}

const PAGE = 8;

/**
 * Who to talk to next. Ranked by a visible rule (see the info tip), with one
 * direct action per row. Opens are tracked signals, not confirmed reads.
 */
export function EngagedLeads({
  items,
  onOpenLead,
  onFollowUp,
}: {
  items: LeadEngagement[];
  onOpenLead: (id: string) => void;
  onFollowUp: (ids: string[]) => void;
}) {
  const [filter, setFilter] = useState<EngagementFilter>('all');
  const [all, setAll] = useState(false);
  const count = (f: EngagementFilter) => (f === 'all' ? items.length : items.filter((i) => i.filters.has(f)).length);
  const filtered = filter === 'all' ? items : items.filter((i) => i.filters.has(filter));
  const shown = all ? filtered : filtered.slice(0, PAGE);

  return (
    <section aria-labelledby="engaged-title" className={cn(CARD, 'p-5')}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 id="engaged-title" className="text-heading font-semibold tracking-[-0.01em] text-ink">
            Engaged leads
          </h2>
          <InfoTip>
            Opened 2+ → follow-up due → opened → no opens → bounced
          </InfoTip>
        </div>
        <div className="-mx-1 flex flex-wrap gap-1" role="group" aria-label="Filter leads">
          {FILTERS.map((f) => {
            const n = count(f.value);
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                disabled={n === 0 && f.value !== 'all'}
                onClick={() => {
                  setFilter(f.value);
                  setAll(false);
                }}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-35',
                  active ? 'bg-ink font-medium text-canvas' : 'text-ink-3 enabled:hover:bg-subtle enabled:hover:text-ink'
                )}
              >
                {f.label}
                <span className={cn('tabular-nums', active ? 'text-canvas/70' : 'text-ink-4')}>{n}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="-mx-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-ui text-ink-3">
            {items.length === 0 ? 'No engagement yet' : 'No matches'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((e) => {
              const last = e.lastOpenedAt ?? e.lastSentAt;
              const when = last ? formatRelativeTime(new Date(last).toISOString()) : e.lead.lastContacted ? formatRelativeTime(e.lead.lastContacted) : null;
              const heat = (
                <Badge tone={TIER_TONE[e.tier] ?? 'neutral'} className="shrink-0">
                  {e.tier === 1 && <Flame className="size-3" aria-hidden="true" />}
                  {e.signal}
                </Badge>
              );
              return (
                <li key={e.lead.id} className="group flex items-center gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-subtle/70">
                  <button
                    type="button"
                    onClick={() => onOpenLead(e.lead.id)}
                    title={e.reason}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Avatar name={e.lead.fullName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui text-ink">
                        <span className="font-medium">{e.lead.fullName}</span>
                        {e.lead.company && <span className="text-ink-3"> · {e.lead.company}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-3">
                        {e.lead.email}
                        {when && <span className="tabular-nums"> · {when}</span>}
                      </span>
                      {/* On small screens the signals sit under the name. */}
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                        {heat}
                        <StagePill status={e.lead.status} />
                      </span>
                    </span>
                  </button>
                  <span className="hidden shrink-0 items-center gap-1.5 md:flex">
                    {heat}
                    <StagePill status={e.lead.status} />
                  </span>
                  {/* Fixed width so badges line up whether or not the row can be followed up. */}
                  <span className="ml-1 flex shrink-0 items-center justify-end gap-1 sm:min-w-[92px] lg:min-w-[172px]">
                    {!e.bounced && (
                      <button
                        type="button"
                        onClick={() => onFollowUp([e.lead.id])}
                        aria-label={`Follow up with ${e.lead.fullName}`}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-ink px-2 text-xs font-medium text-canvas transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-2.5"
                      >
                        <PenSquare className="size-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Follow up</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenLead(e.lead.id)}
                      aria-label={`View ${e.lead.fullName}`}
                      className="hidden h-7 items-center rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink-2 transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:inline-flex"
                    >
                      View lead
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {filtered.length > PAGE && (
          <div className="flex items-center justify-between px-3 pt-2">
            <button type="button" onClick={() => setAll((v) => !v)} className="text-ui font-medium text-accent hover:underline">
              {all ? 'Show fewer' : `Show all ${filtered.length}`}
            </button>
            {filter !== 'all' && filter !== 'bounced' && (
              <button
                type="button"
                onClick={() => onFollowUp(filtered.filter((f) => !f.bounced).map((f) => f.lead.id))}
                className="text-ui font-medium text-ink-2 hover:text-ink hover:underline"
              >
                Email these {filtered.filter((f) => !f.bounced).length}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
