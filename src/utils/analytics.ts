import { DailyMetricPoint } from '../types/outreach';

export type RangeDays = 7 | 30 | 90;

export function toLocalIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Extends the series with zero-value days up to `today`, so ranges like
 * "last 7 days" are anchored on the real calendar instead of the last
 * day that happened to have data.
 */
export function fillMetricsToToday(
  metrics: DailyMetricPoint[],
  today: Date = new Date()
): DailyMetricPoint[] {
  if (metrics.length === 0) return metrics;
  const todayIso = toLocalIsoDate(today);
  const last = metrics[metrics.length - 1];
  if (last.date >= todayIso) return metrics;

  const out = [...metrics];
  const cursor = new Date(`${last.date}T12:00:00`);
  cursor.setDate(cursor.getDate() + 1);
  while (toLocalIsoDate(cursor) <= todayIso) {
    out.push({
      date: toLocalIsoDate(cursor),
      label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface MetricTotals {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  /** Delivered emails where engagement was tracked (denominator for open rate). */
  trackedDelivered: number;
}

function sumPoints(points: DailyMetricPoint[]): MetricTotals {
  return points.reduce(
    (acc, p) => ({
      sent: acc.sent + p.sent,
      delivered: acc.delivered + p.delivered,
      opened: acc.opened + p.opened,
      clicked: acc.clicked + p.clicked,
      trackedDelivered: acc.trackedDelivered + Math.max(0, p.delivered - (p.untracked ?? 0)),
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, trackedDelivered: 0 }
  );
}

export interface PeriodSummary {
  current: MetricTotals;
  /** Null when the series does not cover a full previous period. */
  previous: MetricTotals | null;
  points: DailyMetricPoint[];
}

/** Totals for the last `days` days and the equally long period before it. */
export function summarizePeriod(metrics: DailyMetricPoint[], days: RangeDays): PeriodSummary {
  const points = metrics.slice(-days);
  const previousPoints =
    metrics.length >= days * 2 ? metrics.slice(-days * 2, -days) : null;
  return {
    current: sumPoints(points),
    previous: previousPoints ? sumPoints(previousPoints) : null,
    points,
  };
}

/** Percent change, or null when there is no meaningful baseline. */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return (part / whole) * 100;
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  if (Number.isNaN(diffMs)) return '';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatShortDate(iso, now);
}

/** "Nov 9", with the year only when it isn't the current one. */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function formatFullDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
