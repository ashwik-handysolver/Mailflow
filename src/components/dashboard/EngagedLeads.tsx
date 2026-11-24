import { useState } from 'react';
import { ChevronRight, PenSquare } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatRelativeTime } from '../../utils/analytics';
import { EngagementFilter, LeadEngagement } from '../../utils/dashboardData';
import { LEAD_STATUS_COLOR } from '../common/StatusBadge';
import { InfoTip } from '../ui/InfoTip';

const FILTERS: { value: EngagementFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'opened', label: 'Opened' },
  { value: 'followup', label: 'Follow-up due' },
  { value: 'noresponse', label: 'No opens' },
  { value: 'bounced', label: 'Bounced' },
];

const TIER_TONE: Record<number, string> = {
  1: 'text-accent',
  2: 'text-warning',
  3: 'text-accent',
  4: 'text-ink-3',
  5: 'text-danger',
};

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
    <section aria-labelledby="engaged-title">
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 id="engaged-title" className="text-heading font-semibold text-ink">
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
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-40',
                  active ? 'bg-ink text-canvas' : 'text-ink-2 enabled:hover:bg-subtle'
                )}
              >
                {f.label}
                <span className={cn('tabular-nums', active ? 'opacity-60' : 'text-ink-4')}>{n}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-ui text-ink-3">
            {items.length === 0 ? 'No engagement yet' : 'No matches'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((e) => {
              const last = e.lastOpenedAt ?? e.lastSentAt;
              return (
                <li key={e.lead.id} className="group relative flex h-14 items-center">
                  <button
                    type="button"
                    onClick={() => onOpenLead(e.lead.id)}
                    title={e.reason}
                    className="flex h-full min-w-0 flex-1 items-center gap-3 px-4 text-left transition-colors hover:bg-subtle/60 focus-visible:bg-subtle focus-visible:outline-none"
                  >
                    {/* Everything about the lead reads as one unit: who, then signal · status · when. */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui text-ink">
                        <span className="font-medium">{e.lead.fullName}</span>
                        {e.lead.company && <span className="text-ink-3"> · {e.lead.company}</span>}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
                        <span className={cn('shrink-0 font-medium', TIER_TONE[e.tier])}>{e.signal}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <span className="size-1.5 rounded-full" style={{ background: LEAD_STATUS_COLOR[e.lead.status] }} aria-hidden="true" />
                          {e.lead.status}
                        </span>
                        {(last || e.lead.lastContacted) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate tabular-nums">
                              {last ? formatRelativeTime(new Date(last).toISOString()) : formatRelativeTime(e.lead.lastContacted!)}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    {/* Space for the hover action on pointer devices. */}
                    <span className="w-8 shrink-0 sm:w-24" aria-hidden="true" />
                  </button>
                  <div className="absolute right-3 flex items-center gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                    {!e.bounced && (
                      <button
                        type="button"
                        onClick={() => onFollowUp([e.lead.id])}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink-2 hover:border-ink-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <PenSquare className="size-3.5" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Follow up</span>
                      </button>
                    )}
                    <ChevronRight className="hidden size-4 text-ink-4 sm:block" aria-hidden="true" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {filtered.length > PAGE && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2">
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
