import { AttachmentMeta, Campaign } from '../types/outreach';
import type { DeliveryEvent } from './deliveryEvents';

/**
 * One row per email MailFlow tried to send: the campaign's own record merged
 * with what the server learned afterwards (bounces, opens, sending mailbox).
 * Used by the Campaigns page and the lead panel.
 */
export type EmailState = 'opened' | 'delivered' | 'bounced' | 'failed' | 'simulated';

export interface EmailLogRow {
  id: string;
  campaignId: string;
  campaignName: string;
  templateId: string;
  templateName: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  subject: string;
  bodyHtml: string;
  sentAt: number;
  state: EmailState;
  bounceType: 'hard' | 'soft' | null;
  /** Raw server message, when the email bounced or failed. */
  reason?: string;
  openTracked: boolean;
  openedAt?: number;
  openCount: number;
  mailboxId: string | null;
  attachments?: AttachmentMeta[];
}

export function buildEmailLog(campaigns: Campaign[], events: DeliveryEvent[]): EmailLogRow[] {
  const byKey = new Map<string, DeliveryEvent>();
  for (const e of events) if (e.campaign_id && e.lead_id) byKey.set(`${e.campaign_id}|${e.lead_id}`, e);

  const rows: EmailLogRow[] = [];
  for (const c of campaigns) {
    for (const rec of c.recipientRecords) {
      if (rec.status === 'Draft') continue;
      const ev = byKey.get(`${c.id}|${rec.leadId}`);
      const simulated = rec.simulated || c.status === 'Simulated';
      const openTracked = ev ? ev.open_tracked : c.engagementTracked === true;
      const openedAt = openTracked ? ev?.opened_at ?? rec.openedAt : undefined;
      let state: EmailState;
      if (simulated) state = 'simulated';
      else if (rec.status === 'Failed' || ev?.status === 'Failed') state = 'failed';
      else if (rec.status === 'Bounced' || ev?.status === 'Bounced') state = 'bounced';
      else if (openedAt) state = 'opened';
      else state = 'delivered';
      rows.push({
        id: rec.id,
        campaignId: c.id,
        campaignName: c.name,
        templateId: c.templateId,
        templateName: c.templateName,
        leadId: rec.leadId,
        leadName: rec.leadName,
        leadEmail: rec.leadEmail,
        leadCompany: rec.leadCompany,
        subject: rec.subject,
        bodyHtml: rec.renderedBodyHtml,
        sentAt: new Date(rec.sentAt).getTime(),
        state,
        bounceType: state === 'bounced' ? ev?.bounce_type ?? 'hard' : null,
        reason: state === 'bounced' || state === 'failed' ? ev?.bounce_reason ?? ev?.error ?? rec.failureReason ?? undefined : undefined,
        openTracked,
        openedAt: openedAt ? new Date(openedAt).getTime() : undefined,
        openCount: ev?.open_count ?? rec.openCount ?? (openedAt ? 1 : 0),
        mailboxId: ev?.mailbox_id ?? null,
        attachments: rec.attachments,
      });
    }
  }
  return rows.sort((a, b) => b.sentAt - a.sentAt);
}

export interface EmailCounts {
  all: number;
  delivered: number;
  opened: number;
  bounced: number;
  failed: number;
  simulated: number;
  openTracked: number;
}

export function countEmails(rows: EmailLogRow[]): EmailCounts {
  const c: EmailCounts = { all: rows.length, delivered: 0, opened: 0, bounced: 0, failed: 0, simulated: 0, openTracked: 0 };
  for (const r of rows) {
    if (r.state === 'opened') c.opened++;
    if (r.state === 'opened' || r.state === 'delivered') {
      c.delivered++;
      if (r.openTracked) c.openTracked++;
    }
    if (r.state === 'bounced') c.bounced++;
    if (r.state === 'failed') c.failed++;
    if (r.state === 'simulated') c.simulated++;
  }
  return c;
}

/** Plain-language version of an SMTP / bounce message. The raw text stays available as detail. */
export function friendlyReason(raw: string | undefined, state: EmailState, bounceType: 'hard' | 'soft' | null = null): string {
  const r = (raw ?? '').toLowerCase();
  if (/do.?not.?contact|suppress|unsubscrib/.test(r)) return 'On the do-not-contact list';
  if (/5\.1\.1|user unknown|does not exist|doesn't exist|no such user|address not found|unknown user|recipient.*(rejected|invalid)|invalid recipient|undeliverable address/.test(r))
    return "Email address doesn't exist";
  if (/5\.1\.2|domain not found|host not found|no mx|nxdomain|unrouteable/.test(r)) return "The recipient's domain doesn't accept email";
  if (/mailbox (is )?full|quota|over.?quota|5\.2\.2|insufficient storage/.test(r)) return "Recipient's mailbox is full";
  if (/spam|blocked|blacklist|blocklist|policy|reputation|5\.7\.1|rejected/.test(r)) return "Rejected by the recipient's mail server";
  if (/daily.?limit|rate.?limit|too many|4\.7\.0|throttl/.test(r)) return 'Sending limit reached; try again later';
  if (/auth|password|credentials|535|login/.test(r)) return "Couldn't sign in to the sending mailbox";
  if (/timeout|timed out|econn|enotfound|network|socket|unreachable/.test(r)) return "Couldn't reach the mail server";
  if (/no.*mailbox|no sending mailbox|not connected/.test(r)) return 'No sending mailbox connected';
  if (state === 'bounced') return bounceType === 'soft' ? 'Temporarily undeliverable' : 'Bounced back';
  if (state === 'failed') return raw ? 'Sending failed' : 'Sending failed (no reason given)';
  return '';
}

export const EMAIL_STATE_LABEL: Record<EmailState, string> = {
  opened: 'Opened',
  delivered: 'Delivered',
  bounced: 'Bounced',
  failed: 'Failed',
  simulated: 'Simulated',
};

export const EMAIL_STATE_COLOR: Record<EmailState, string> = {
  opened: 'var(--color-accent)',
  delivered: 'var(--color-success)',
  bounced: 'var(--color-warning)',
  failed: 'var(--color-danger)',
  simulated: 'var(--color-ink-4)',
};
