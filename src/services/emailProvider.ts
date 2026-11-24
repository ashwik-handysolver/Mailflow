import {
  AttachmentMeta,
  EmailActivityRecord,
  Lead,
  TeamSettings,
} from '../types/outreach';
import { useSyncExternalStore } from 'react';
import { personalizeEmail } from '../utils/personalization';
import { supabase } from '../lib/supabase';
import { EmailStyle, renderStyledEmail } from '../utils/emailTheme';

export interface SendBatchRequest {
  campaignId: string;
  campaignName: string;
  templateId: string;
  templateName: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  recipients: Lead[];
  settings: TeamSettings;
  /**
   * Files sent with every email. A real provider uploads/encodes these
   * (e.g. base64 for SES/SendGrid); the simulator only records their metadata.
   */
  attachments?: File[];
  /** Visual style; plain when unset. Brand comes from `settings`. */
  emailStyle?: EmailStyle;
  onProgress?: (progress: {
    completed: number;
    total: number;
    sent: number;
    failed: number;
    latestRecord: EmailActivityRecord;
  }) => void;
}

export interface SendBatchResponse {
  records: EmailActivityRecord[];
  sentCount: number;
  failedCount: number;
  simulated: boolean;
}

/**
 * Abstraction interface designed so a real Email Service Provider
 * (Resend, SendGrid, Amazon SES, or SMTP) can replace SimulatedEmailProvider
 * without altering UI components.
 */
export interface EmailServiceProvider {
  readonly providerName: string;
  readonly isSimulated: boolean;
  /** Whether opens and clicks are tracked for emails sent this way. */
  readonly tracksEngagement: boolean;
  sendPersonalizedBatch(request: SendBatchRequest): Promise<SendBatchResponse>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class SimulatedEmailProvider implements EmailServiceProvider {
  readonly providerName = 'MailFlow Prototype Simulator';
  readonly isSimulated = true;
  readonly tracksEngagement = false;

  async sendPersonalizedBatch(
    request: SendBatchRequest
  ): Promise<SendBatchResponse> {
    const records: EmailActivityRecord[] = [];
    let sentCount = 0;
    let failedCount = 0;
    const total = request.recipients.length;

    const attachmentMeta: AttachmentMeta[] = (request.attachments ?? []).map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));

    const signature = request.settings.includeSignatureByDefault
      ? request.settings.defaultSignatureHtml
      : undefined;

    for (let i = 0; i < total; i++) {
      const lead = request.recipients[i];
      await delay(total > 8 ? 95 : 160);

      const personalized = personalizeEmail({
        subject: request.subjectTemplate,
        bodyHtml: request.bodyHtmlTemplate,
        lead,
        signatureHtml: signature,
      });

      const hasInvalidEmail = !lead.email || !lead.email.includes('@');
      const status: 'Sent' | 'Failed' = hasInvalidEmail ? 'Failed' : 'Sent';

      if (status === 'Sent') {
        sentCount++;
      } else {
        failedCount++;
      }

      const record: EmailActivityRecord = {
        id: `act_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        campaignId: request.campaignId,
        campaignName: request.campaignName,
        leadId: lead.id,
        leadName: lead.fullName,
        leadEmail: lead.email,
        leadCompany: lead.company,
        templateId: request.templateId,
        templateName: request.templateName,
        subject: personalized.subject,
        renderedBodyHtml: personalized.bodyHtml,
        sentAt: new Date().toISOString(),
        status,
        simulated: true,
        failureReason: hasInvalidEmail ? 'Invalid recipient email address' : undefined,
        attachments: attachmentMeta.length > 0 ? attachmentMeta : undefined,
      };

      records.push(record);
      request.onProgress?.({
        completed: i + 1,
        total,
        sent: sentCount,
        failed: failedCount,
        latestRecord: record,
      });
    }

    return {
      records,
      sentCount,
      failedCount,
      simulated: true,
    };
  }
}

/** Pause between emails so a mailbox sends at a human-like pace (randomized 2–4 s). */
const sendGapMs = () => 2000 + Math.random() * 2000;

/**
 * Sends through the user's connected Gmail / Google Workspace mailboxes.
 * Personalization happens here; the "send-email" Edge Function picks the
 * mailbox, enforces daily limits and the do-not-contact list, adds the
 * unsubscribe link, and talks to Gmail over SMTP. App passwords never reach
 * the browser.
 */
export class SmtpEmailProvider implements EmailServiceProvider {
  readonly isSimulated = false;
  /** Opens are tracked (when turned on in Settings); clicks are not. */
  readonly tracksEngagement = true;
  constructor(readonly providerName: string) {}

  async sendPersonalizedBatch(request: SendBatchRequest): Promise<SendBatchResponse> {
    if (!supabase) throw new Error('Sending needs a Supabase connection.');
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) throw new Error('Sign in again to send.');

    // Upload the campaign's files once; every email references them.
    const files = request.attachments ?? [];
    const uploaded: { path: string; name: string; type: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `${userId}/outgoing/${request.campaignId}/${i}-${f.name.replace(/[^\w.-]+/g, '_')}`;
      const { error } = await supabase.storage
        .from('attachments')
        .upload(path, f, { upsert: true, contentType: f.type || undefined });
      if (error) throw new Error(`Couldn't upload "${f.name}": ${error.message}`);
      uploaded.push({ path, name: f.name, type: f.type });
    }
    const attachmentMeta: AttachmentMeta[] = files.map((f) => ({ name: f.name, size: f.size, type: f.type }));
    const signature = request.settings.includeSignatureByDefault ? request.settings.defaultSignatureHtml : undefined;

    const records: EmailActivityRecord[] = [];
    let sentCount = 0;
    let failedCount = 0;
    const total = request.recipients.length;

    try {
      for (let i = 0; i < total; i++) {
        const lead = request.recipients[i];
        const personalized = personalizeEmail({
          subject: request.subjectTemplate,
          bodyHtml: request.bodyHtmlTemplate,
          lead,
          signatureHtml: signature,
        });

        let status: 'Sent' | 'Failed' = 'Failed';
        let failureReason: string | undefined;
        try {
          const { data, error } = await supabase.functions.invoke<{ status: 'Sent' | 'Failed'; error?: string }>(
            'send-email',
            {
              body: {
                campaignId: request.campaignId,
                leadId: lead.id,
                to: lead.email,
                toName: lead.fullName,
                trackOpens: request.settings.openTrackingEnabled === true,
                subject: personalized.subject,
                html: renderStyledEmail({
                  bodyHtml: personalized.bodyHtml,
                  style: request.emailStyle ?? 'plain',
                  brand: {
                    color: request.settings.brandColor,
                    logoUrl: request.settings.brandLogoUrl,
                    name: request.settings.brandName || request.settings.teamName,
                  },
                }),
                attachments: uploaded,
              },
            }
          );
          if (error) {
            failureReason = 'The sending service could not be reached';
          } else {
            status = data?.status === 'Sent' ? 'Sent' : 'Failed';
            failureReason = status === 'Failed' ? data?.error ?? 'Not sent' : undefined;
          }
        } catch {
          failureReason = 'Network error while sending';
        }
        if (status === 'Sent') sentCount++;
        else failedCount++;

        const record: EmailActivityRecord = {
          id: `act_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          campaignId: request.campaignId,
          campaignName: request.campaignName,
          leadId: lead.id,
          leadName: lead.fullName,
          leadEmail: lead.email,
          leadCompany: lead.company,
          templateId: request.templateId,
          templateName: request.templateName,
          subject: personalized.subject,
          renderedBodyHtml: personalized.bodyHtml,
          sentAt: new Date().toISOString(),
          status,
          simulated: false,
          failureReason,
          attachments: attachmentMeta.length > 0 ? attachmentMeta : undefined,
        };
        records.push(record);
        request.onProgress?.({ completed: i + 1, total, sent: sentCount, failed: failedCount, latestRecord: record });

        if (i < total - 1 && status === 'Sent') await delay(sendGapMs());
      }
    } finally {
      // The files were only needed while sending.
      if (uploaded.length > 0) void supabase.storage.from('attachments').remove(uploaded.map((u) => u.path));
    }

    return { records, sentCount, failedCount, simulated: false };
  }
}

/**
 * The provider the app uses right now: the simulator until a working mailbox
 * is connected, then real sending. Components read it with useEmailProvider()
 * so they re-render when it changes.
 */
const simulator = new SimulatedEmailProvider();
let current: EmailServiceProvider = simulator;
const listeners = new Set<() => void>();

/** Called with the active mailboxes' addresses (or null) whenever they change. */
export function setRealSending(mailboxEmails: string[] | null) {
  current =
    mailboxEmails && mailboxEmails.length > 0
      ? new SmtpEmailProvider(
          mailboxEmails.length === 1 ? `Gmail (${mailboxEmails[0]})` : `Gmail (${mailboxEmails.length} mailboxes)`
        )
      : simulator;
  listeners.forEach((l) => l());
}

export const emailProvider: EmailServiceProvider = {
  get providerName() {
    return current.providerName;
  },
  get isSimulated() {
    return current.isSimulated;
  },
  get tracksEngagement() {
    return current.tracksEngagement;
  },
  sendPersonalizedBatch: (request) => current.sendPersonalizedBatch(request),
};

/** Same object as `emailProvider`, but re-renders the component when sending switches on or off. */
export function useEmailProvider(): EmailServiceProvider {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current
  );
  return emailProvider;
}
