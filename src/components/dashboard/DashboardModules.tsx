import { KeyboardEvent, ReactNode, useRef } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ChevronRight,
  CircleCheck,
  Clock,
  Eye,
  MailX,
  Send,
  UserMinus,
} from 'lucide-react';
import { LeadStatus } from '../../types/outreach';
import { LEAD_STATUS_COLOR } from '../common/StatusBadge';
import { formatRelativeTime } from '../../utils/analytics';
import { ActivityEntry } from '../../utils/dashboardData';
import { cn } from '../../lib/cn';
import { InfoTip } from '../ui/InfoTip';
import { CountChip } from '../ui/Feedback';

/* ------------------------------------------------------------------ */
/* Rail section: a titled block on the canvas, separated by a hairline, no box. */

export function RailSection({
  title,
  tip,
  meta,
  action,
  children,
  first,
}: {
  title: string;
  tip?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <section aria-label={title} className={cn(!first && 'border-t border-line pt-6')}>
      <header className="mb-3 flex min-h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-heading font-semibold text-ink">{title}</h2>
          {meta !== undefined && <CountChip>{meta}</CountChip>}
          {tip && <InfoTip>{tip}</InfoTip>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export { SkeletonRows, InlineError } from '../ui/Feedback';

/* ------------------------------------------------------------------ */
/* Act now */

export type Severity = 'critical' | 'warning' | 'task';

export interface ActItem {
  id: string;
  severity: Severity;
  title: string;
  /** Short reason, only when it adds information beyond the title. */
  why?: string;
  count: number;
  /** Opens the affected records (drawer). */
  onOpen: () => void;
  /** The one direct action, e.g. "Email them". */
  action?: { label: string; onClick: () => void };
}

const SEVERITY: Record<Severity, { icon: ReactNode; label: string }> = {
  critical: { icon: <AlertOctagon className="size-4 text-danger" aria-hidden="true" />, label: 'Critical' },
  warning: { icon: <AlertTriangle className="size-4 text-warning" aria-hidden="true" />, label: 'Warning' },
  task: { icon: <Clock className="size-4 text-accent" aria-hidden="true" />, label: 'To do' },
};

/** Arrow keys and J/K move between rows; Enter opens. */
function useRovingList() {
  const ref = useRef<HTMLUListElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const keys = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 } as Record<string, number>;
    const step = keys[e.key];
    if (!step || !ref.current) return;
    const rows = [...ref.current.querySelectorAll<HTMLElement>('[data-row]')];
    const idx = rows.indexOf(document.activeElement as HTMLElement);
    const next = rows[Math.min(rows.length - 1, Math.max(0, idx + step))];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };
  return { ref, onKeyDown };
}

export function ActNowList({ items }: { items: ActItem[] }) {
  const { ref, onKeyDown } = useRovingList();
  if (items.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <p className="text-ui font-medium text-ink">All clear</p>
      </div>
    );
  }
  return (
    <ul ref={ref} onKeyDown={onKeyDown} className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {items.map((a) => (
        <li
          key={a.id}
          className={cn(
            'group relative',
            a.severity === 'critical' && 'shadow-[inset_3px_0_0_var(--color-danger)]',
            a.severity === 'warning' && 'shadow-[inset_3px_0_0_var(--color-warning)]'
          )}
        >
          <button
            type="button"
            data-row
            onClick={a.onOpen}
            className="flex w-full items-start gap-3 px-3.5 py-3 pr-4 text-left transition-colors hover:bg-subtle/60 focus-visible:bg-subtle focus-visible:outline-none"
          >
            <span className="mt-0.5 shrink-0">
              {SEVERITY[a.severity].icon}
              <span className="sr-only">{SEVERITY[a.severity].label}:</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-ui font-medium text-ink">{a.title}</span>
                <span className={cn('text-ui font-semibold tabular-nums', a.severity === 'critical' ? 'text-danger' : 'text-ink')}>
                  {a.count}
                </span>
              </span>
              {a.why && <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{a.why}</span>}
              {/* Spacer so the absolutely positioned action doesn't overlap text. */}
              {a.action && <span className="mt-2 block h-6" aria-hidden="true" />}
            </span>
          </button>
          {a.action && (
            <button
              type="button"
              onClick={a.action.onClick}
              className="absolute bottom-3 left-[2.625rem] inline-flex h-6 items-center rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink-2 transition-colors hover:border-ink-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {a.action.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline snapshot (current state; movement needs status history) */

const STAGES: LeadStatus[] = ['New', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Not Interested'];

export function PipelineSnapshot({ counts, onSelect }: { counts: Record<LeadStatus, number>; onSelect: (s: LeadStatus) => void }) {
  const total = STAGES.reduce((n, s) => n + counts[s], 0);
  if (total === 0) return <p className="text-ui text-ink-3">No leads yet</p>;
  const filled = STAGES.filter((s) => counts[s] > 0);
  const empty = STAGES.filter((s) => counts[s] === 0);
  return (
    <div>
      {filled.length > 1 && (
        <div className="mb-2 flex h-1.5 gap-px overflow-hidden rounded-full" aria-hidden="true">
          {filled.map((s) => (
            <span key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: LEAD_STATUS_COLOR[s] }} />
          ))}
        </div>
      )}
      <ul>
        {filled.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className="group -mx-2 flex h-8 w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: LEAD_STATUS_COLOR[s] }} aria-hidden="true" />
              <span className="flex-1 truncate text-ui text-ink-2 group-hover:text-ink">{s}</span>
              <span className="text-ui font-semibold tabular-nums text-ink">{counts[s]}</span>
              <span className="w-9 text-right text-xs tabular-nums text-ink-3">{Math.round((counts[s] / total) * 100)}%</span>
              <ChevronRight className="size-3.5 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {empty.length > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-ink-3">
          0 in {empty.join(', ').replace(/, ([^,]*)$/, ' and $1')}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sending health */

export interface HealthRow {
  label: string;
  value: ReactNode;
  tone?: 'ok' | 'warn' | 'bad' | 'muted';
  /** 0–1 meter (e.g. today's capacity). */
  meter?: number;
  action?: { label: string; onClick: () => void };
}

export function SendingHealth({ rows }: { rows: HealthRow[] }) {
  return (
    <dl className="space-y-0.5">
      {rows.map((r) => (
        <div key={r.label} className="flex min-h-8 items-center gap-2">
          <dt className="w-28 shrink-0 text-ui text-ink-3">{r.label}</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={cn(
                'min-w-0 truncate text-ui tabular-nums',
                r.tone === 'bad' ? 'font-medium text-danger' : r.tone === 'warn' ? 'font-medium text-warning' : r.tone === 'muted' ? 'text-ink-3' : 'text-ink'
              )}
            >
              {r.value}
            </span>
            {r.meter !== undefined && (
              <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span
                  className={cn('block h-full rounded-full', r.meter >= 1 ? 'bg-warning' : 'bg-success')}
                  style={{ width: `${Math.min(100, r.meter * 100)}%` }}
                />
              </span>
            )}
          </dd>
          {r.action && (
            <button
              type="button"
              onClick={r.action.onClick}
              className="shrink-0 rounded px-1 text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {r.action.label}
            </button>
          )}
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Recent activity */

const ACTIVITY_ICON: Record<ActivityEntry['kind'], ReactNode> = {
  campaign: <Send className="size-3.5 text-ink-3" aria-hidden="true" />,
  bounce: <MailX className="size-3.5 text-danger" aria-hidden="true" />,
  opens: <Eye className="size-3.5 text-accent" aria-hidden="true" />,
  unsubscribe: <UserMinus className="size-3.5 text-warning" aria-hidden="true" />,
  failed: <AlertTriangle className="size-3.5 text-warning" aria-hidden="true" />,
};

export function RecentActivity({ entries, onOpen }: { entries: ActivityEntry[]; onOpen: (e: ActivityEntry) => void }) {
  if (entries.length === 0) return <p className="text-ui text-ink-3">No activity in this period</p>;
  return (
    <ol className="relative space-y-0.5">
      {entries.map((e) => {
        const clickable = Boolean(e.campaignId || e.leadId);
        const inner = (
          <>
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-line">
              {ACTIVITY_ICON[e.kind]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-ink">{e.title}</span>
              {e.detail && <span className="block truncate text-xs text-ink-3">{e.detail}</span>}
            </span>
            <time className="shrink-0 pt-0.5 text-2xs tabular-nums text-ink-4" dateTime={new Date(e.at).toISOString()}>
              {formatRelativeTime(new Date(e.at).toISOString())}
            </time>
          </>
        );
        return (
          <li key={e.id}>
            {clickable ? (
              <button
                type="button"
                onClick={() => onOpen(e)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {inner}
              </button>
            ) : (
              <div className="flex items-start gap-2.5 py-1.5">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
