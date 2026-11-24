import { Campaign } from '../types/outreach';

/** Open rate is only shown once at least this many tracked emails were delivered. */
const MIN_TRACKED = 10;

export interface TemplateUsage {
  /** Real sends (campaign records) that used the template. */
  sends: number;
  /** Real emails accepted for delivery. */
  emails: number;
  lastUsed: string | null;
  /** Open rate across tracked real sends, or null when there isn't enough tracked data. */
  openRate: number | null;
  /** Only simulated sends used this template. */
  simulatedOnly: boolean;
}

const isSimulated = (c: Campaign) =>
  c.status === 'Simulated' || c.recipientRecords.length === 0 || c.recipientRecords.every((r) => r.simulated);

/** How each template has performed across real sent campaigns. */
export function computeTemplateUsage(campaigns: Campaign[]): Map<string, TemplateUsage> {
  const acc = new Map<string, { sends: number; emails: number; lastUsed: string | null; opens: number; tracked: number; simulated: number }>();
  for (const c of campaigns) {
    const cur = acc.get(c.templateId) ?? { sends: 0, emails: 0, lastUsed: null, opens: 0, tracked: 0, simulated: 0 };
    if (isSimulated(c)) {
      cur.simulated += 1;
    } else {
      cur.sends += 1;
      cur.emails += c.sentCount;
      if (!cur.lastUsed || c.sentAt > cur.lastUsed) cur.lastUsed = c.sentAt;
      if (c.engagementTracked === true) {
        const delivered = c.recipientRecords.filter((r) => r.status === 'Sent');
        cur.tracked += delivered.length;
        cur.opens += delivered.filter((r) => r.openedAt).length;
      }
    }
    acc.set(c.templateId, cur);
  }
  const out = new Map<string, TemplateUsage>();
  for (const [id, v] of acc) {
    out.set(id, {
      sends: v.sends,
      emails: v.emails,
      lastUsed: v.lastUsed,
      openRate: v.tracked >= MIN_TRACKED ? (v.opens / v.tracked) * 100 : null,
      simulatedOnly: v.sends === 0 && v.simulated > 0,
    });
  }
  return out;
}

export function describeUsage(u: TemplateUsage | undefined): string {
  if (!u || (u.sends === 0 && !u.simulatedOnly)) return 'Not used yet';
  if (u.simulatedOnly) return 'Only used in simulation';
  const parts = [`${u.emails} ${u.emails === 1 ? 'email' : 'emails'} sent`];
  if (u.openRate !== null) parts.push(`${u.openRate.toFixed(0)}% opened`);
  return parts.join(' · ');
}
