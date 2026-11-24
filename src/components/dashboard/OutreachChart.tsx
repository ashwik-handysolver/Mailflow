import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Rectangle,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { DayPoint, pct } from '../../utils/outreachAnalytics';

export type ChartMode = 'volume' | 'engagement' | 'deliverability';

/** Hard-bounce rates above this damage sender reputation. */
export const BOUNCE_LIMIT = 2;

interface Series {
  key: string;
  label: string;
  color: string;
  kind: 'bar' | 'line';
  axis: 'count' | 'rate';
}

const SERIES: Record<ChartMode, Series[]> = {
  // One stacked bar per period: height = volume, segments = outcome.
  volume: [
    { key: 'delivered', label: 'Delivered', color: 'var(--color-series-delivered)', kind: 'bar', axis: 'count' },
    { key: 'softBounces', label: 'Soft bounced', color: 'var(--color-warning)', kind: 'bar', axis: 'count' },
    { key: 'hardBounces', label: 'Hard bounced', color: 'var(--color-danger)', kind: 'bar', axis: 'count' },
    { key: 'failed', label: 'Failed', color: 'var(--color-ink-4)', kind: 'bar', axis: 'count' },
  ],
  engagement: [
    { key: 'uniqueOpens', label: 'Unique opens', color: 'var(--color-series-opened)', kind: 'bar', axis: 'count' },
    { key: 'openRate', label: 'Open rate', color: 'var(--color-ink-2)', kind: 'line', axis: 'rate' },
  ],
  deliverability: [{ key: 'bounceRate', label: 'Hard-bounce rate', color: 'var(--color-danger)', kind: 'line', axis: 'rate' }],
};

/** Legend for the stacked volume bars, in stacking order. */
export const VOLUME_LEGEND = SERIES.volume.map(({ key, label, color }) => ({ key, label, color }));

const STACK_ORDER = SERIES.volume.map((s) => s.key);

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: Record<string, unknown>;
}

/** Only the topmost non-empty segment of each stack gets rounded top corners. */
function StackSegment({ seriesKey, payload, x, y, width, height, fill }: SegmentProps & { seriesKey: string }) {
  if (!height) return <g />;
  const top = [...STACK_ORDER].reverse().find((k) => Number(payload?.[k] ?? 0) > 0);
  return <Rectangle x={x} y={y} width={width} height={height} fill={fill} radius={top === seriesKey ? [4, 4, 0, 0] : 0} />;
}

const SUM_KEYS = ['attempted', 'sent', 'delivered', 'failed', 'hardBounces', 'softBounces', 'openEligible', 'uniqueOpens', 'totalOpens'] as const;
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', opts);

type Grouped = DayPoint & { end: string; openRate: number | null; bounceRate: number | null };

/** Long ranges are grouped into weeks so marks stay readable. */
function group(points: DayPoint[]): { points: Grouped[]; weekly: boolean } {
  const withRates = (p: DayPoint & { end: string }): Grouped => ({
    ...p,
    openRate: pct(p.uniqueOpens, p.openEligible),
    bounceRate: pct(p.hardBounces, p.sent),
  });
  if (points.length <= 31) return { points: points.map((p) => withRates({ ...p, end: p.date })), weekly: false };
  const out: Grouped[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7);
    const sum = { ...chunk[0], end: chunk[chunk.length - 1].date };
    for (const p of chunk.slice(1)) for (const k of SUM_KEYS) sum[k] += p[k];
    out.push(withRates(sum));
  }
  return { points: out, weekly: true };
}

/**
 * Outreach over time. Each view answers one question; series can be hidden
 * from the legend. Rates are only plotted for periods that have a denominator.
 */
export function OutreachChart({ points, mode, summary }: { points: DayPoint[]; mode: ChartMode; summary: string }) {
  const { points: data, weekly } = useMemo(() => group(points), [points]);
  const drawn = SERIES[mode];
  const hasRate = drawn.some((s) => s.axis === 'rate');
  const hasCount = drawn.some((s) => s.axis === 'count');
  const tickOpts: Intl.DateTimeFormatOptions =
    points.length <= 14 ? { weekday: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' };
  const maxBounce = Math.max(0, ...data.map((p) => p.bounceRate ?? 0));
  const rateMax = mode === 'deliverability' ? Math.max(10, Math.ceil((maxBounce + 2) / 5) * 5) : 100;

  return (
    <figure className="m-0 flex h-full flex-col">
      <figcaption className="sr-only">
        {summary}
        {weekly ? ' Grouped by week.' : ''}
      </figcaption>
      <div className="min-h-0 flex-1" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} barCategoryGap="30%" margin={{ top: 8, right: hasRate && hasCount ? 0 : 8, bottom: 0, left: hasCount ? -16 : -6 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line-strong)" strokeOpacity={0.55} strokeDasharray="3 4" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => fmt(v, tickOpts)}
              tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tickMargin={10}
            />
            {hasCount && (
              <YAxis
                yAxisId="count"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
            )}
            {hasRate && (
              <YAxis
                yAxisId="rate"
                orientation={hasCount ? 'right' : 'left'}
                domain={[0, rateMax]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
            )}
            {mode === 'deliverability' && (
              <>
                <ReferenceArea yAxisId="rate" y1={BOUNCE_LIMIT} y2={rateMax} fill="var(--color-danger)" fillOpacity={0.04} />
                <ReferenceLine yAxisId="rate" y={BOUNCE_LIMIT} stroke="var(--color-danger)" strokeDasharray="4 4" strokeOpacity={0.6} />
              </>
            )}
            <Tooltip content={(props) => <ChartTooltip {...props} weekly={weekly} mode={mode} />} cursor={{ fill: 'var(--color-subtle)' }} />
            {drawn.map((s) =>
              s.kind === 'bar' ? (
                <Bar
                  key={s.key}
                  yAxisId="count"
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  stackId={mode === 'volume' ? 'v' : undefined}
                  maxBarSize={18}
                  shape={
                    mode === 'volume' ? (props: unknown) => <StackSegment {...(props as SegmentProps)} seriesKey={s.key} /> : undefined
                  }
                  radius={mode === 'volume' ? undefined : [4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={s.key}
                  yAxisId="rate"
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={1.75}
                  dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  weekly,
  mode,
}: TooltipContentProps<ValueType, NameType> & { weekly: boolean; mode: ChartMode }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload as Grouped | undefined;
  if (!p) return null;
  const title = weekly
    ? `${fmt(p.date, { month: 'short', day: 'numeric' })} – ${fmt(p.end, { month: 'short', day: 'numeric' })}`
    : fmt(String(label), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const rows: [string, string][] =
    mode === 'volume'
      ? [
          ['Sent', String(p.sent)],
          ['Delivered', String(p.delivered)],
          ['Bounced', String(p.hardBounces + p.softBounces)],
          ['Failed', String(p.failed)],
        ]
      : mode === 'engagement'
      ? [
          ['Unique opens', String(p.uniqueOpens)],
          ['Open rate', p.openRate === null ? 'Not tracked' : `${p.openRate.toFixed(1)}% (${p.uniqueOpens}/${p.openEligible})`],
        ]
      : [
          ['Hard bounces', String(p.hardBounces)],
          ['Hard-bounce rate', p.bounceRate === null ? 'Nothing sent' : `${p.bounceRate.toFixed(1)}% (${p.hardBounces}/${p.sent})`],
        ];
  return (
    <div className="min-w-[200px] rounded-lg border border-line bg-surface px-3 py-2.5 shadow-overlay">
      <p className="mb-1.5 text-xs font-medium text-ink-2">{title}</p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 text-ui">
            <dt className="text-ink-2">{k}</dt>
            <dd className="font-medium tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
