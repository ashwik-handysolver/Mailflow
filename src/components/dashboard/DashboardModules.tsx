import { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CircleCheck, Clock, Eye, MailX, Send, UserMinus } from 'lucide-react';
import { LeadStatus } from '../../types/outreach';
import { LEAD_STATUS_COLOR } from '../common/StatusBadge';
import { formatRelativeTime } from '../../utils/analytics';
import { ActivityEntry } from '../../utils/dashboardData';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';

/* ------------------------------------------------------------------ */
/* Rail section: one titled card. */

export function RailSection({
  title,
  tip,
  meta,
  action,
  children,
}: {
  title: string;
  tip?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Kept for callers; every section is now its own card. */
  first?: boolean;
}) {
  return (
    <Card aria-label={title} className="p-5">
      <CardHeader title={title} meta={meta} tip={tip} action={action} className="mb-4" />
      {children}
    </Card>
  );
}

export { SkeletonRows, InlineError } from '../ui/Feedback';

/* ------------------------------------------------------------------ */
/* Act now: one alert card per issue, each with its reason and a direct action. */

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
  /** Label for the button that opens the records, e.g. "Review bounced list". */
  openLabel?: string;
  /** The one direct action, e.g. "Email them". */
  action?: { label: string; onClick: () => void };
}

const SEVERITY: Record<Severity, { icon: ReactNode; label: string; tile: string }> = {
  critical: {
    icon: <AlertOctagon className="size-4 text-danger" aria-hidden="true" />,
    label: 'Critical',
    tile: 'border-danger bg-danger-soft/70',
  },
  warning: {
    icon: <AlertTriangle className="size-4 text-warning" aria-hidden="true" />,
    label: 'Warning',
    tile: 'border-warning bg-warning-soft/70',
  },
  task: {
    icon: <Clock className="size-4 text-ink-3" aria-hidden="true" />,
    label: 'To do',
    tile: 'border-line-strong bg-subtle/60',
  },
};

const linkAction =
  'inline-flex h-6 items-center rounded text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function ActNowList({ items }: { items: ActItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-r-lg border-l-2 border-success bg-success-soft/70 px-3 py-3">
        <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
        <p className="text-ui text-ink-2">Nothing needs you right now</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const s = SEVERITY[a.severity];
        return (
          <li key={a.id} className={cn('flex items-start gap-2.5 rounded-r-lg border-l-2 py-2.5 pl-3 pr-3', s.tile)}>
            <span className="mt-0.5 shrink-0">
              {s.icon}
              <span className="sr-only">{s.label}:</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-ui text-ink">
                <span className="font-medium">{a.title}</span>
                <span className="ml-1.5 tabular-nums text-ink-3">{a.count}</span>
              </p>
              {a.why && <p className="text-xs leading-relaxed text-ink-3">{a.why}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-3">
                {a.action && (
                  <button type="button" onClick={a.action.onClick} className={cn(linkAction, 'text-ink')}>
                    {a.action.label} →
                  </button>
                )}
                <button type="button" onClick={a.onOpen} className={cn(linkAction, a.action ? 'text-ink-3 hover:text-ink' : 'text-ink')}>
                  {a.openLabel ?? 'Review'}
                  {!a.action && ' →'}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline snapshot: one segmented bar, then a legend that filters Leads. */

const STAGES: LeadStatus[] = ['New', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Not Interested'];

export function PipelineSnapshot({ counts, onSelect }: { counts: Record<LeadStatus, number>; onSelect: (s: LeadStatus) => void }) {
  const total = STAGES.reduce((n, s) => n + counts[s], 0);
  if (total === 0) return <p className="text-ui text-ink-3">No leads yet</p>;
  return (
    <div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={STAGES.map((s) => `${s}: ${counts[s]}`).join(', ')}>
        {STAGES.filter((s) => counts[s] > 0).map((s) => (
          <button
            key={s}
            type="button"
            tabIndex={-1}
            title={`${s}: ${counts[s]}`}
            onClick={() => onSelect(s)}
            className="h-full min-w-1.5 transition-opacity hover:opacity-80"
            style={{ flexGrow: counts[s], background: LEAD_STATUS_COLOR[s] }}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-0.5">
        {STAGES.map((s) => {
          const n = counts[s];
          return (
            <li key={s}>
              <button
                type="button"
                disabled={n === 0}
                onClick={() => onSelect(s)}
                className="-mx-1.5 flex h-8 w-[calc(100%+0.75rem)] items-center gap-2 rounded-md px-1.5 text-left transition-colors enabled:hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
              >
                <span className="size-2 shrink-0 rounded-[3px]" style={{ background: LEAD_STATUS_COLOR[s] }} aria-hidden="true" />
                <span className={cn('min-w-0 flex-1 truncate text-xs', n === 0 ? 'text-ink-4' : 'text-ink-2')}>{s}</span>
                <span className={cn('text-xs font-medium tabular-nums', n === 0 ? 'text-ink-4' : 'text-ink')}>{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
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
  /** A rate drawn against its limit (e.g. hard bounces vs 2%). The row is tinted when over it. */
  gauge?: { value: number; limit: number };
  action?: { label: string; onClick: () => void };
}

export type HealthState = 'risk' | 'attention' | 'healthy' | 'simulation';

/** Overall verdict for the card header. */
export function HealthBadge({ state }: { state: HealthState }) {
  if (state === 'simulation') return <Badge tone="neutral">Simulation</Badge>;
  if (state === 'healthy')
    return (
      <Badge tone="success" dot>
        Healthy
      </Badge>
    );
  return (
    <Badge tone={state === 'risk' ? 'danger' : 'warning'}>
      <AlertTriangle className="size-3" aria-hidden="true" />
      {state === 'risk' ? 'At risk' : 'Needs attention'}
    </Badge>
  );
}

/** Rate vs limit: the bar fills to the rate, the tick marks the limit. */
function Gauge({ value, limit, tone }: { value: number; limit: number; tone?: HealthRow['tone'] }) {
  const max = Math.max(limit * 5, Math.ceil(value));
  const fill = tone === 'bad' ? 'bg-danger' : tone === 'warn' ? 'bg-warning' : 'bg-success';
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <div
        className="relative h-1.5 flex-1 rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(1))}
        aria-label={`Hard-bounce rate ${value.toFixed(1)}%, limit ${limit}%`}
      >
        <div className={cn('h-full rounded-full', fill)} style={{ width: `${Math.max(value > 0 ? 3 : 0, Math.min(100, (value / max) * 100))}%` }} />
        <span className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink-2" style={{ left: `${(limit / max) * 100}%` }} aria-hidden="true" />
      </div>
      <span className="shrink-0 text-2xs tabular-nums text-ink-3">limit {limit}%</span>
    </div>
  );
}

export function SendingHealth({ rows }: { rows: HealthRow[] }) {
  return (
    <dl className="-my-1 divide-y divide-line/80">
      {rows.map((r) =>
        r.gauge ? (
          <div key={r.label} className="py-1.5">
            <div
              className={cn(
                '-mx-2 rounded-lg px-2 py-2',
                r.tone === 'bad' ? 'bg-danger-soft/70' : r.tone === 'warn' ? 'bg-warning-soft/70' : ''
              )}
            >
              <div className="flex items-center gap-3">
                <dt className={cn('w-28 shrink-0 text-xs', r.tone === 'bad' || r.tone === 'warn' ? 'font-medium text-ink-2' : 'text-ink-3')}>{r.label}</dt>
                <dd
                  className={cn(
                    'min-w-0 flex-1 text-right text-ui font-medium tabular-nums',
                    r.tone === 'bad' ? 'text-danger' : r.tone === 'warn' ? 'text-warning' : 'text-ink'
                  )}
                >
                  {r.value}
                </dd>
              </div>
              <Gauge value={r.gauge.value} limit={r.gauge.limit} tone={r.tone} />
            </div>
          </div>
        ) : (
        <div key={r.label} className="flex min-h-10 items-center gap-3 py-1.5">
          <dt className="w-28 shrink-0 text-xs text-ink-3">{r.label}</dt>
          <dd className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
            {r.meter !== undefined && (
              <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span
                  className={cn('block h-full rounded-full', r.meter >= 1 ? 'bg-warning' : 'bg-success')}
                  style={{ width: `${Math.min(100, r.meter * 100)}%` }}
                />
              </span>
            )}
            {r.tone === 'bad' || r.tone === 'warn' ? (
              <Badge tone={r.tone === 'bad' ? 'danger' : 'warning'} className="min-w-0 max-w-full truncate">
                {r.value}
              </Badge>
            ) : (
              <span className={cn('min-w-0 text-right text-ui tabular-nums [overflow-wrap:anywhere]', r.tone === 'muted' ? 'text-ink-3' : 'text-ink')}>{r.value}</span>
            )}
            {r.action && (
              <button
                type="button"
                onClick={r.action.onClick}
                className="shrink-0 rounded-md border border-line-strong bg-surface px-2 py-0.5 text-xs font-medium text-ink-2 hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {r.action.label}
              </button>
            )}
          </dd>
        </div>
        )
      )}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Recent activity */

const ACTIVITY_ICON: Record<ActivityEntry['kind'], { icon: ReactNode; tone: string }> = {
  campaign: { icon: <Send aria-hidden="true" />, tone: 'bg-subtle text-ink-3' },
  bounce: { icon: <MailX aria-hidden="true" />, tone: 'bg-danger-soft text-danger' },
  opens: { icon: <Eye aria-hidden="true" />, tone: 'bg-accent-soft text-accent' },
  unsubscribe: { icon: <UserMinus aria-hidden="true" />, tone: 'bg-warning-soft text-warning' },
  failed: { icon: <AlertTriangle aria-hidden="true" />, tone: 'bg-warning-soft text-warning' },
};

export function RecentActivity({ entries, onOpen }: { entries: ActivityEntry[]; onOpen: (e: ActivityEntry) => void }) {
  if (entries.length === 0) return <p className="text-ui text-ink-3">No activity in this period</p>;
  return (
    <ol className="-mx-2 space-y-0.5">
      {entries.map((e) => {
        const clickable = Boolean(e.campaignId || e.leadId);
        const icon = ACTIVITY_ICON[e.kind];
        const inner = (
          <>
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full [&>svg]:size-3.5', icon.tone)}>{icon.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-ui text-ink">{e.title}</span>
                {e.count && e.count > 1 && (
                  <span className="shrink-0 rounded-full bg-subtle px-1.5 text-2xs font-medium tabular-nums text-ink-2" aria-label={`${e.count} times`}>
                    {e.count}×
                  </span>
                )}
              </span>
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
                className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {inner}
              </button>
            ) : (
              <div className="flex items-start gap-3 px-2 py-2">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
