import { ReactNode } from 'react';
import { CircleCheck, Eye, MailX, Send } from 'lucide-react';
import { cn } from '../../lib/cn';
import { DayPoint, Summary } from '../../utils/outreachAnalytics';
import { Badge, BadgeTone } from '../ui/Badge';
import { Card, CardHeader, CARD } from '../ui/Card';
import { InfoTip } from '../ui/InfoTip';
import { OutreachChart, VOLUME_LEGEND } from './OutreachChart';

/** Below this denominator a rate is shown as a fraction ("1 of 1"), not a percentage. */
export const LOW_SAMPLE = 10;

export type FunnelStage = 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed';

/** "86%" with enough data, otherwise "6 of 7" so a tiny sample never looks like a strong result. */
export function rateText(num: number, den: number): string {
  if (den === 0) return '—';
  return den < LOW_SAMPLE ? `${num} of ${den}` : `${((num / den) * 100).toFixed(1)}%`;
}

/** A clickable badge that sits above the card's full-size hit area. */
function BadgeButton({ tone, children, onClick }: { tone: BadgeTone; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative z-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Badge tone={tone} className="cursor-pointer hover:brightness-[0.97]">
        {children}
      </Badge>
    </button>
  );
}

function KpiCard({
  label,
  icon,
  tip,
  value,
  footer,
  onClick,
  tipAlign = 'start',
}: {
  label: string;
  icon: ReactNode;
  tip: ReactNode;
  /** Cards in the right-hand column open their tip leftwards so it stays on screen. */
  tipAlign?: 'start' | 'end';
  value: string;
  footer?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className={cn(CARD, 'group relative flex min-w-0 flex-col p-5 transition-[border-color,box-shadow]', onClick && 'hover:border-line-strong hover:shadow-float')}>
      {/* The whole card opens the records; badges and the tip sit above this layer. */}
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          aria-label={`${label}: ${value}. View emails`}
          className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-ui font-medium text-ink-2">
          {label}
          <span className="relative z-10 inline-flex">
            <InfoTip align={tipAlign}>{tip}</InfoTip>
          </span>
        </span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink-3 [&>svg]:size-3.5" aria-hidden="true">
          {icon}
        </span>
      </div>
      <span className="mt-3 block text-[28px] font-semibold leading-8 tracking-tight tabular-nums text-ink">{value}</span>
      {/* One badge + one line of context, same height on every card so the row reads level. */}
      <div className="mt-3 flex h-[22px] min-w-0 items-center gap-2 whitespace-nowrap text-xs leading-none text-ink-3 [&>*:first-child]:shrink-0 [&>span:last-child:not(:first-child)]:truncate">
        {footer}
      </div>
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
  onNarrowRange,
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
  /** Switches to 7 days; passed only when every send in range happened in the last week. */
  onNarrowRange?: () => void;
}) {
  // Nothing sent: one card with the two useful next steps, instead of zeros and an empty chart.
  if (cur.attempted === 0) {
    return (
      <Card aria-labelledby="funnel-title" className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-subtle text-ink-3" aria-hidden="true">
            <Send className="size-4" />
          </span>
          <div>
            <h2 id="funnel-title" className="text-heading font-semibold text-ink">
              No emails sent yet
            </h2>
            <p className="mt-0.5 text-ui text-ink-3">Nothing went out between {emptyRangeLabel}.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onWiderRange && (
            <button
              type="button"
              onClick={onWiderRange}
              className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-surface px-3 text-ui font-medium text-ink-2 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Show 90 days
            </button>
          )}
          <button
            type="button"
            onClick={onCompose}
            className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-ui font-medium text-white shadow-xs hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Compose email
          </button>
        </div>
      </Card>
    );
  }

  const opensTracked = cur.openEligible > 0;
  const bounced = cur.hardBounces + cur.softBounces;
  const lowSample = (cur.sent > 0 && cur.sent < LOW_SAMPLE) || (opensTracked && cur.openEligible < LOW_SAMPLE);
  const activeDays = series.filter((p) => p.attempted > 0).length;
  const sparse = series.length > 7 && activeDays <= 3;
  const summary = `${cur.sent} emails sent, ${cur.delivered} delivered, ${bounced} bounced, ${cur.failed} failed${
    opensTracked ? `, ${cur.uniqueOpens} of ${cur.openEligible} tracked emails opened` : ''
  }.`;

  return (
    <section aria-labelledby="funnel-title" className="space-y-4">
      <h2 id="funnel-title" className="sr-only">
        Outreach overview
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Sent"
          icon={<Send />}
          tip="Accepted by your mail server"
          value={String(cur.sent)}
          onClick={() => onOpenStage('sent')}
          footer={
            cur.failed > 0 ? (
              <>
                <BadgeButton tone="warning" onClick={() => onOpenStage('failed')}>
                  {cur.failed} failed
                </BadgeButton>
                <span>of {cur.attempted}</span>
              </>
            ) : (
              <>
                <Badge tone="success">0 failed</Badge>
                <span>all accepted</span>
              </>
            )
          }
        />
        <KpiCard
          label="Delivered"
          icon={<CircleCheck />}
          tip="Sent emails that didn't bounce"
          tipAlign="end"
          value={String(cur.delivered)}
          onClick={cur.delivered > 0 ? () => onOpenStage('delivered') : undefined}
          footer={
            <>
              {/* Delivery is good news; only the bounce card carries the warning colours. */}
              <Badge tone={cur.delivered > 0 ? 'success' : 'neutral'}>{rateText(cur.delivered, cur.sent)}</Badge>
              <span>of sent</span>
            </>
          }
        />
        <KpiCard
          label="Opened"
          icon={<Eye />}
          tip="Tracked opens, not confirmed reads"
          value={opensTracked ? String(cur.uniqueOpens) : '—'}
          onClick={cur.uniqueOpens > 0 ? () => onOpenStage('opened') : undefined}
          footer={
            opensTracked ? (
              <>
                <Badge tone={cur.uniqueOpens > 0 ? 'success' : 'neutral'}>{rateText(cur.uniqueOpens, cur.openEligible)}</Badge>
                <span>of tracked</span>
              </>
            ) : (
              <>
                <BadgeButton tone="neutral" onClick={onEnableTracking}>
                  Turn on tracking
                </BadgeButton>
                <span>opens off</span>
              </>
            )
          }
        />
        <KpiCard
          label="Bounced"
          icon={<MailX />}
          tip="Rejected by the recipient's server. Hard bounces are blocked from future sends."
          tipAlign="end"
          value={String(bounced)}
          onClick={bounced > 0 ? () => onOpenStage('bounced') : undefined}
          footer={
            bounced > 0 ? (
              <>
                <Badge tone={cur.hardBounces > 0 ? 'danger' : 'warning'}>{rateText(bounced, cur.sent)}</Badge>
                <span>{cur.hardBounces > 0 ? `${cur.hardBounces} hard` : 'all soft'}</span>
              </>
            ) : (
              <>
                <Badge tone="success">0%</Badge>
                <span>no bounces</span>
              </>
            )
          }
        />
      </div>

      <Card className="p-5">
        <CardHeader
          title="Sending volume"
          tip="One bar per day (or week for long ranges). Height is emails sent; segments show what happened to them."
          meta={null}
          action={
            <ul className="hidden items-center gap-4 sm:flex" aria-label="Legend">
              {VOLUME_LEGEND.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 text-xs text-ink-2">
                  <span className="size-2 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </li>
              ))}
            </ul>
          }
        />
        {(lowSample || sparse) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {lowSample && (
              <Badge tone="neutral" title={`Fewer than ${LOW_SAMPLE} emails, so rates are shown as counts`}>
                Low sample
              </Badge>
            )}
            {sparse && (
              <span className="text-xs text-ink-3">
                Activity on {activeDays} of {series.length} days
                {onNarrowRange && (
                  <>
                    {' · '}
                    <button type="button" onClick={onNarrowRange} className="font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
                      View last 7 days
                    </button>
                  </>
                )}
              </span>
            )}
          </div>
        )}
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 sm:hidden" aria-label="Legend">
          {VOLUME_LEGEND.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-xs text-ink-2">
              <span className="size-2 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="mt-4 h-[220px]">
          <OutreachChart points={series} mode="volume" summary={summary} />
        </div>
      </Card>
    </section>
  );
}
