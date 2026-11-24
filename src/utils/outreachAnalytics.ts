import { Campaign } from '../types/outreach';
import type { DeliveryEvent } from './deliveryEvents';
import { toLocalIsoDate } from './analytics';

/**
 * Dashboard analytics, computed from per-email send records of real campaigns.
 * Simulated sends never count. Server-side delivery events add bounce type and
 * open counts when available.
 *
 * Definitions (also shown in the UI):
 * - Sent: accepted by the mail server (delivered + bounced). Failed sends were never accepted.
 * - Delivery rate: delivered / sent.
 * - Unique open rate: emails opened at least once / delivered emails sent with open tracking on.
 * - Click rate: not available (no click tracking yet). Spam complaints: not reported for SMTP sending.
 */
export type Outcome = 'delivered' | 'hard_bounce' | 'soft_bounce' | 'failed';

export interface EmailFact {
  campaignId: string;
  campaignName: string;
  templateName: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  sentAt: number;
  outcome: Outcome;
  reason?: string;
  openTracked: boolean;
  opened: boolean;
  /** First tracked open, when known. */
  openedAt?: number;
  openCount: number;
}

export function buildFacts(campaigns: Campaign[], events: DeliveryEvent[]): EmailFact[] {
  const byKey = new Map<string, DeliveryEvent>();
  for (const e of events) if (e.campaign_id && e.lead_id) byKey.set(`${e.campaign_id}|${e.lead_id}`, e);

  const facts: EmailFact[] = [];
  for (const c of campaigns) {
    if (c.status === 'Simulated') continue;
    for (const rec of c.recipientRecords) {
      if (rec.simulated || rec.status === 'Draft') continue;
      const ev = byKey.get(`${c.id}|${rec.leadId}`);
      let outcome: Outcome = 'delivered';
      if (rec.status === 'Failed') outcome = 'failed';
      else if (rec.status === 'Bounced' || ev?.status === 'Bounced') outcome = ev?.bounce_type === 'soft' ? 'soft_bounce' : 'hard_bounce';
      const openTracked = ev ? ev.open_tracked : c.engagementTracked === true;
      const openedAt = ev?.opened_at ?? rec.openedAt;
      facts.push({
        campaignId: c.id,
        campaignName: c.name,
        templateName: c.templateName,
        leadId: rec.leadId,
        leadName: rec.leadName,
        leadEmail: rec.leadEmail,
        sentAt: new Date(rec.sentAt).getTime(),
        outcome,
        reason: outcome === 'delivered' ? undefined : ev?.bounce_reason ?? rec.failureReason,
        openTracked,
        opened: openTracked && Boolean(openedAt),
        openedAt: openTracked && openedAt ? new Date(openedAt).getTime() : undefined,
        openCount: ev?.open_count ?? rec.openCount ?? (openedAt ? 1 : 0),
      });
    }
  }
  return facts;
}

export interface Summary {
  attempted: number;
  sent: number;
  delivered: number;
  failed: number;
  hardBounces: number;
  softBounces: number;
  openEligible: number;
  uniqueOpens: number;
  totalOpens: number;
}

export function summarize(facts: EmailFact[]): Summary {
  const s: Summary = { attempted: 0, sent: 0, delivered: 0, failed: 0, hardBounces: 0, softBounces: 0, openEligible: 0, uniqueOpens: 0, totalOpens: 0 };
  for (const f of facts) {
    s.attempted++;
    if (f.outcome === 'failed') {
      s.failed++;
      continue;
    }
    s.sent++;
    if (f.outcome === 'hard_bounce') s.hardBounces++;
    else if (f.outcome === 'soft_bounce') s.softBounces++;
    else {
      s.delivered++;
      if (f.openTracked) {
        s.openEligible++;
        if (f.opened) {
          s.uniqueOpens++;
          s.totalOpens += Math.max(1, f.openCount);
        }
      }
    }
  }
  return s;
}

/** Percentage, or null when the denominator is zero (show "—", never 0%). */
export const pct = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null);
export const deliveryRate = (s: Summary) => pct(s.delivered, s.sent);
export const uniqueOpenRate = (s: Summary) => pct(s.uniqueOpens, s.openEligible);
export const bounceRate = (s: Summary) => pct(s.hardBounces + s.softBounces, s.sent);

// ----- Date ranges -----

export type RangePreset = 7 | 30 | 90 | 'custom';

export interface DateRange {
  /** Inclusive start, local midnight. */
  from: Date;
  /** Inclusive end, local end of day. */
  to: Date;
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function presetRange(days: number, now = new Date()): DateRange {
  const to = endOfDay(now);
  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
  return { from, to };
}

export function rangeDays(r: DateRange) {
  return Math.round((startOfDay(r.to).getTime() - r.from.getTime()) / 86_400_000) + 1;
}

export function inRange(t: number, r: DateRange) {
  return t >= r.from.getTime() && t <= r.to.getTime();
}

export interface DayPoint extends Summary {
  date: string;
}

export function dailySeries(facts: EmailFact[], r: DateRange): DayPoint[] {
  const buckets = new Map<string, EmailFact[]>();
  for (const f of facts) {
    if (!inRange(f.sentAt, r)) continue;
    const k = toLocalIsoDate(new Date(f.sentAt));
    const list = buckets.get(k) ?? [];
    list.push(f);
    buckets.set(k, list);
  }
  const out: DayPoint[] = [];
  for (let d = new Date(r.from); d <= r.to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const k = toLocalIsoDate(d);
    out.push({ date: k, ...summarize(buckets.get(k) ?? []) });
  }
  return out;
}

// ----- Campaigns -----

export interface CampaignRow {
  campaign: Campaign;
  simulated: boolean;
  summary: Summary;
  deliveryRate: number | null;
  openRate: number | null;
  bounceRate: number | null;
}

export function campaignRows(campaigns: Campaign[], facts: EmailFact[]): CampaignRow[] {
  const byCampaign = new Map<string, EmailFact[]>();
  for (const f of facts) {
    const list = byCampaign.get(f.campaignId) ?? [];
    list.push(f);
    byCampaign.set(f.campaignId, list);
  }
  return campaigns.map((c) => {
    // Real campaigns always carry per-email records from a real send; anything else (simulator, old demo data) is excluded.
    const simulated =
      c.status === 'Simulated' || c.recipientRecords.length === 0 || c.recipientRecords.every((r) => r.simulated);
    const summary = summarize(byCampaign.get(c.id) ?? []);
    return {
      campaign: c,
      simulated,
      summary,
      deliveryRate: simulated ? null : deliveryRate(summary),
      openRate: simulated ? null : uniqueOpenRate(summary),
      bounceRate: simulated ? null : bounceRate(summary),
    };
  });
}
