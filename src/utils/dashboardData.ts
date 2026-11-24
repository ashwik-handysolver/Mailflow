import { Campaign, Lead } from '../types/outreach';
import type { DeliveryEvent } from './deliveryEvents';
import { DateRange, EmailFact, inRange } from './outreachAnalytics';
import { FOLLOW_UP_AFTER_DAYS } from './followUps';

/* ------------------------------------------------------------------ */
/* Lead engagement: a transparent ranking, not a hidden score. */

export type EngagementFilter = 'all' | 'opened' | 'followup' | 'noresponse' | 'bounced';

export interface LeadEngagement {
  lead: Lead;
  /** Lower ranks first. */
  tier: number;
  /** The strongest signal, shown on the row. */
  signal: string;
  /** Why the lead is ranked here (row tooltip). */
  reason: string;
  sends: number;
  delivered: number;
  openTracked: number;
  opens: number;
  lastOpenedAt?: number;
  lastSentAt?: number;
  bounced: boolean;
  followUpDue: boolean;
  filters: Set<EngagementFilter>;
}

const CLOSED = new Set(['Converted', 'Not Interested']);

/**
 * Ranks leads by what deserves attention next, using real send records in the
 * selected range plus each lead's status and last contact:
 *  1. opened 2+ times with no response recorded
 *  2. Interested / Follow-up with a follow-up overdue
 *  3. opened once
 *  4. delivered with open tracking on, but not opened ("no response")
 *  5. bounced (address problem)
 * Converted and Not Interested leads are left out: there's nothing to chase.
 */
export function rankLeads(leads: Lead[], facts: EmailFact[], now = Date.now()): LeadEngagement[] {
  const byLead = new Map<string, EmailFact[]>();
  for (const f of facts) byLead.set(f.leadId, [...(byLead.get(f.leadId) ?? []), f]);
  const threshold = now - FOLLOW_UP_AFTER_DAYS * 86_400_000;
  const out: LeadEngagement[] = [];

  for (const lead of leads) {
    if (CLOSED.has(lead.status)) continue;
    const fs = byLead.get(lead.id) ?? [];
    const delivered = fs.filter((f) => f.outcome === 'delivered');
    const tracked = delivered.filter((f) => f.openTracked);
    const openedFacts = tracked.filter((f) => f.opened);
    const opens = openedFacts.reduce((n, f) => n + Math.max(1, f.openCount), 0);
    const lastOpenedAt = Math.max(0, ...openedFacts.map((f) => f.openedAt ?? 0)) || undefined;
    const lastSentAt = Math.max(0, ...fs.map((f) => f.sentAt)) || undefined;
    const bounced = fs.some((f) => f.outcome === 'hard_bounce');
    const followUpDue =
      (lead.status === 'Interested' || lead.status === 'Follow-up') &&
      (!lead.lastContacted || new Date(lead.lastContacted).getTime() < threshold);

    const filters = new Set<EngagementFilter>();
    let tier = 0;
    let signal = '';
    let reason = '';
    if (opens >= 2) {
      tier = 1;
      signal = `Opened ${opens}×`;
      reason = `Opened ${opens} times across ${openedFacts.length} ${openedFacts.length === 1 ? 'email' : 'emails'}`;
      filters.add('opened');
    }
    if (followUpDue) {
      filters.add('followup');
      if (!tier) {
        tier = 2;
        signal = 'Follow-up due';
        reason = lead.lastContacted ? `${lead.status}, no contact in ${FOLLOW_UP_AFTER_DAYS}+ days` : `${lead.status}, never contacted`;
      }
    }
    if (opens === 1) {
      filters.add('opened');
      if (!tier) {
        tier = 3;
        signal = 'Opened';
        reason = 'Opened once';
      }
    }
    if (tracked.length > 0 && openedFacts.length === 0) {
      filters.add('noresponse');
      if (!tier) {
        tier = 4;
        signal = 'No opens yet';
        reason = `${tracked.length} tracked ${tracked.length === 1 ? 'email' : 'emails'} delivered, none opened`;
      }
    }
    if (bounced) {
      filters.add('bounced');
      if (!tier) {
        tier = 5;
        signal = 'Bounced';
        reason = 'Email address rejected mail';
      }
    }
    if (!tier) continue;
    out.push({
      lead,
      tier,
      signal,
      reason,
      sends: fs.length,
      delivered: delivered.length,
      openTracked: tracked.length,
      opens,
      lastOpenedAt,
      lastSentAt,
      bounced,
      followUpDue,
      filters,
    });
  }
  return out.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.opens - a.opens ||
      (b.lastOpenedAt ?? b.lastSentAt ?? 0) - (a.lastOpenedAt ?? a.lastSentAt ?? 0)
  );
}

/* ------------------------------------------------------------------ */
/* Recent activity: grouped by campaign, individual lines only for events that matter. */

export interface ActivityEntry {
  id: string;
  at: number;
  kind: 'campaign' | 'bounce' | 'opens' | 'unsubscribe' | 'failed';
  title: string;
  detail?: string;
  campaignId?: string;
  leadId?: string;
  /** How many identical consecutive events this line stands for (shown as "3×"). */
  count?: number;
}

/**
 * Folds runs of identical events (same kind, line, lead and campaign) into one
 * line with a count. Entries are newest first, so the kept line has the latest time.
 */
export function groupRepeats(entries: ActivityEntry[]): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  for (const e of entries) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === e.kind && prev.title === e.title && prev.leadId === e.leadId && prev.campaignId === e.campaignId) {
      out[out.length - 1] = { ...prev, count: (prev.count ?? 1) + 1 };
    } else out.push(e);
  }
  return out;
}

export function buildActivity(input: {
  campaigns: Campaign[];
  facts: EmailFact[];
  events: DeliveryEvent[];
  unsubscribes: { email: string; reason: string; created_at: string }[];
  leads: Lead[];
  range: DateRange;
}): ActivityEntry[] {
  const { campaigns, facts, events, unsubscribes, leads, range } = input;
  const out: ActivityEntry[] = [];
  const nameOf = (leadId: string | null, email: string) => leads.find((l) => l.id === leadId)?.fullName ?? email;
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));

  // Campaign lines only when they're noteworthy: sends that share a name are merged,
  // and a line appears only once the group reached at least MIN_CAMPAIGN_RECIPIENTS people.
  // (Small test sends are already visible in the Campaigns table; repeating them here is noise.)
  const MIN_CAMPAIGN_RECIPIENTS = 5;
  const byName = new Map<string, EmailFact[]>();
  for (const f of facts) if (inRange(f.sentAt, range)) byName.set(f.campaignName, [...(byName.get(f.campaignName) ?? []), f]);
  for (const [name, fs] of byName) {
    if (fs.length < MIN_CAMPAIGN_RECIPIENTS) continue;
    const sends = new Set(fs.map((f) => f.campaignId));
    const delivered = fs.filter((f) => f.outcome === 'delivered').length;
    const bounced = fs.filter((f) => f.outcome === 'hard_bounce' || f.outcome === 'soft_bounce').length;
    const failed = fs.filter((f) => f.outcome === 'failed').length;
    // Only non-zero outcomes are listed; never "0 sent · 0 delivered".
    const parts = [delivered && `${delivered} delivered`, bounced && `${bounced} bounced`, failed && `${failed} failed`].filter(Boolean);
    const latest = fs.reduce((a, b) => (b.sentAt > a.sentAt ? b : a));
    out.push({
      id: `c-${name}`,
      at: latest.sentAt,
      kind: 'campaign',
      title: sends.size > 1 ? `${sends.size} sends of ${name}` : `${name} sent to ${fs.length}`,
      detail: parts.join(' · ') || undefined,
      campaignId: latest.campaignId,
    });
  }

  // Failed sends individually, with the reason: each one needs a decision.
  for (const f of facts) {
    if (f.outcome !== 'failed' || !inRange(f.sentAt, range)) continue;
    out.push({
      id: `f-${f.campaignId}-${f.leadId}`,
      at: f.sentAt,
      kind: 'failed',
      title: `Failed to send to ${f.leadName}`,
      detail: f.reason,
      leadId: f.leadId,
      campaignId: f.campaignId,
    });
  }

  // Bounces individually: each one is an address to fix.
  for (const e of events) {
    if (e.status !== 'Bounced' || !e.bounced_at) continue;
    const at = new Date(e.bounced_at).getTime();
    if (!inRange(at, range)) continue;
    out.push({
      id: `b-${e.id}`,
      at,
      kind: 'bounce',
      title: `Email to ${nameOf(e.lead_id, e.to_email)} bounced`,
      detail: e.bounce_reason ?? undefined,
      leadId: e.lead_id ?? undefined,
      campaignId: e.campaign_id ?? undefined,
    });
  }

  // Opens grouped per campaign per day.
  const openGroups = new Map<string, DeliveryEvent[]>();
  for (const e of events) {
    if (!e.opened_at) continue;
    const at = new Date(e.opened_at);
    if (!inRange(at.getTime(), range)) continue;
    const k = `${e.campaign_id}|${at.toDateString()}`;
    openGroups.set(k, [...(openGroups.get(k) ?? []), e]);
  }
  for (const [k, es] of openGroups) {
    const latest = Math.max(...es.map((e) => new Date(e.opened_at!).getTime()));
    const cid = es[0].campaign_id ?? undefined;
    out.push({
      id: `o-${k}`,
      at: latest,
      kind: 'opens',
      title:
        es.length === 1
          ? `${nameOf(es[0].lead_id, es[0].to_email)} opened ${cid && campaignName.get(cid) ? `"${campaignName.get(cid)}"` : 'your email'}`
          : `${es.length} people opened ${cid && campaignName.get(cid) ? `"${campaignName.get(cid)}"` : 'your email'}`,
      campaignId: cid,
      leadId: es.length === 1 ? es[0].lead_id ?? undefined : undefined,
    });
  }

  for (const u of unsubscribes) {
    const at = new Date(u.created_at).getTime();
    if (!inRange(at, range)) continue;
    out.push({
      id: `u-${u.email}`,
      at,
      kind: 'unsubscribe',
      title: `${u.email} unsubscribed`,
      detail: u.reason === 'unsubscribed' ? 'One-click unsubscribe' : 'Replied "unsubscribe"',
    });
  }

  return groupRepeats(out.sort((a, b) => b.at - a.at));
}
