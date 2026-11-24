import { ReactNode, useState } from 'react';
import { cn } from '../../lib/cn';
import { DayPoint, Summary } from '../../utils/outreachAnalytics';
import { SegmentedControl } from '../ui/Misc';
import { InfoTip } from '../ui/InfoTip';
import { ChartMode, OutreachChart } from './OutreachChart';

/** Below this denominator a rate is shown as a fraction ("1 of 1"), not a percentage. */
export const LOW_SAMPLE = 10;

export type FunnelStage = 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed';

/** "86%" with enough data, otherwise "6 of 7" so a tiny sample never looks like a strong result. */
export function rateText(num: number, den: number): string {
  if (den === 0) return '—';
  return den < LOW_SAMPLE ? `${num} of ${den}` : `${((num / den) * 100).toFixed(1)}%`;
}

function Stage({
  label,
  tip,
  value,
  sub,
  secondary,
  onClick,
}: {
  label: string;
  tip: ReactNode;
  value: string;
  sub?: ReactNode;
  secondary?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-ui text-ink-3">
        {label}
        <InfoTip>{tip}</InfoTip>
      </span>
      <span
        className={cn(
          'mt-1 block font-semibold tabular-nums tracking-[-0.03em]',
          secondary ? 'text-[24px] leading-9 text-ink-2' : 'text-[32px] leading-9 text-ink'
        )}
      >
        {value}
      </span>
      <span className="block min-h-4 text-xs tabular-nums text-ink-3">{sub}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="-m-2 block min-w-[112px] rounded-lg p-2 text-left transition-colors hover:bg-subtle/70 focus-visible:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {body}
    </button>
  ) : (
    <div className="min-w-[112px]">{body}</div>
  );
}

/** The conversion between two stages, written inline on the connector. */
function Connector({ num, den }: { num: number; den: number }) {
  return (
    <div className="hidden w-16 shrink-0 flex-col items-center pt-8 md:flex" aria-hidden="true">
      <span className="text-2xs font-medium tabular-nums text-ink-3">
        {den > 0 ? (den < LOW_SAMPLE ? `${num}/${den}` : `${Math.round((num / den) * 100)}%`) : '—'}
      </span>
      <span className="mt-1 h-px w-full bg-line-strong" />
    </div>
  );
}

export function FunnelHero({
  cur,
  series,
  onOpenStage,
  onEnableTracking,
  emptyRangeLabel,
  onCompose,
  onWiderRange,
}: {
  cur: Summary;
  series: DayPoint[];
  onOpenStage: (stage: FunnelStage) => void;
  onEnableTracking: () => void;
  /** e.g. "Oct 22 – Nov 20", used when nothing was sent. */
  emptyRangeLabel: string;
  onCompose: () => void;
  /** Switches to a longer range; omitted when already on the longest preset. */
  onWiderRange?: () => void;
}) {
  const [view, setView] = useState<ChartMode>('volume');

  // Nothing sent: one compact line with the two useful next steps, instead of zeros and an empty chart.
  if (cur.attempted === 0) {
    return (
      <section aria-labelledby="funnel-title" className="flex flex-col items-start gap-4 rounded-xl border border-line bg-surface px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="funnel-title" className="text-heading font-semibold text-ink">
            No emails sent
          </h2>
          <p className="mt-0.5 text-ui text-ink-3">{emptyRangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {onWiderRange && (
            <button
              type="button"
              onClick={onWiderRange}
              className="inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-3 text-ui font-medium text-ink-2 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Show 90 days
            </button>
          )}
          <button
            type="button"
            onClick={onCompose}
            className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-ui font-medium text-white hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Compose email
          </button>
        </div>
      </section>
    );
  }
  const opensTracked = cur.openEligible > 0;
  const bounced = cur.hardBounces + cur.softBounces;
  const lowSample = (cur.sent > 0 && cur.sent < LOW_SAMPLE) || (opensTracked && cur.openEligible < LOW_SAMPLE);
  const summary =
    cur.attempted === 0
      ? 'No emails were sent in this period.'
      : `${cur.sent} emails sent, ${cur.delivered} delivered, ${bounced} bounced, ${cur.failed} failed${
          opensTracked ? `, ${cur.uniqueOpens} of ${cur.openEligible} tracked emails opened` : ''
        }.`;

  return (
    <section aria-labelledby="funnel-title" className="rounded-xl border border-line bg-surface">
      <h2 id="funnel-title" className="sr-only">
        Outreach funnel
      </h2>
      {/* Funnel ribbon: the only large numbers on the page, grouped so the path reads left to right. */}
      <div className="flex flex-wrap items-start gap-x-2 gap-y-5 border-b border-line px-5 pb-4 pt-5">
        <div className="grid flex-1 grid-cols-3 gap-4 md:flex md:flex-none md:items-start md:gap-0">
          <Stage
            label="Sent"
            tip="Accepted by your mail server"
            value={String(cur.sent)}
            sub={cur.failed > 0 ? `${cur.failed} failed to send` : undefined}
            onClick={cur.attempted > 0 ? () => onOpenStage('sent') : undefined}
          />
          <Connector num={cur.delivered} den={cur.sent} />
          <Stage
            label="Delivered"
            tip="Sent emails that didn't bounce"
            value={String(cur.delivered)}
            sub={cur.sent > 0 ? `${rateText(cur.delivered, cur.sent)}${cur.sent < LOW_SAMPLE ? ' sent' : ' of sent'}` : undefined}
            onClick={cur.delivered > 0 ? () => onOpenStage('delivered') : undefined}
          />
          <Connector num={cur.uniqueOpens} den={opensTracked ? cur.openEligible : 0} />
          <Stage
            label="Opened"
            secondary
            tip="Tracked opens, not confirmed reads"
            value={opensTracked ? String(cur.uniqueOpens) : '—'}
            sub={
              opensTracked ? (
                `${rateText(cur.uniqueOpens, cur.openEligible)} tracked`
              ) : (
                <button type="button" onClick={onEnableTracking} className="text-accent hover:underline">
                  Turn on tracking
                </button>
              )
            }
            onClick={cur.uniqueOpens > 0 ? () => onOpenStage('opened') : undefined}
          />
        </div>

        {/* Losses, to the side: coloured only when non-zero. */}
        <div className="flex w-full gap-6 border-t border-line pt-3 md:ml-auto md:w-auto md:flex-col md:gap-1 md:border-l md:border-t-0 md:pl-5 md:pt-1">
          {[
            { key: 'bounced' as const, label: 'Bounced', value: bounced, tone: cur.hardBounces > 0 ? 'text-danger' : 'text-ink' },
            { key: 'failed' as const, label: 'Failed', value: cur.failed, tone: 'text-warning' },
          ].map((l) => (
            <button
              key={l.key}
              type="button"
              disabled={l.value === 0}
              onClick={() => onOpenStage(l.key)}
              className="flex h-8 items-center gap-3 rounded-md px-1.5 text-left transition-colors enabled:hover:bg-subtle/70 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="w-14 text-xs text-ink-3">{l.label}</span>
              <span className={cn('w-6 text-right text-heading font-semibold tabular-nums', l.value === 0 ? 'text-ink-4' : l.tone)}>{l.value}</span>
              <span className="w-12 text-xs tabular-nums text-ink-3">{l.value > 0 && cur.sent > 0 ? rateText(l.value, cur.sent) : ''}</span>
            </button>
          ))}
        </div>

        {lowSample && (
          <p className="w-full text-xs text-ink-3">Low sample (under {LOW_SAMPLE} emails)</p>
        )}
      </div>

      {/* The chart explains the funnel, so it lives on the same surface. */}
      <div className="px-5 pb-4 pt-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-ui font-medium text-ink">Over time</p>
          <SegmentedControl
            ariaLabel="Chart view"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'volume', label: 'Volume' },
              { value: 'engagement', label: 'Engagement' },
              { value: 'deliverability', label: 'Deliverability' },
            ]}
          />
        </div>
        {cur.attempted === 0 ? (
          <p className="flex h-[240px] items-center justify-center text-ui text-ink-3">No emails sent in this period</p>
        ) : view === 'engagement' && !opensTracked ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
            <p className="text-ui text-ink-2">Open tracking is off</p>
            <button type="button" onClick={onEnableTracking} className="text-ui font-medium text-accent hover:underline">
              Turn on
            </button>
          </div>
        ) : (
          <div className="h-[280px] sm:h-[260px]">
            <OutreachChart points={series} mode={view} summary={summary} />
          </div>
        )}
      </div>
    </section>
  );
}
