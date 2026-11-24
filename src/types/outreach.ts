export type NavPage = 'dashboard' | 'leads' | 'templates' | 'campaigns' | 'settings' | 'compose' | 'audit';

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Follow-up'
  | 'Converted'
  | 'Not Interested';

export interface Lead {
  id: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  industry: string;
  status: LeadStatus;
  lastContacted: string | null;
  roleTitle?: string;
  notes?: string;
  createdAt: string;
}

export type TemplateCategory =
  | 'Outreach'
  | 'Pitch'
  | 'Follow-up'
  | 'Meeting'
  | 'Proposal'
  | 'Relationship';

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  subject: string;
  bodyHtml: string;
  lastModified: string;
  createdBy: string;
  /**
   * Files attached to every email sent from this template. Metadata lives here;
   * the file contents are kept in the browser's IndexedDB file store, keyed by id.
   */
  attachments?: TemplateAttachment[];
  /** Visual style of emails sent from this template; plain when unset. */
  style?: 'plain' | 'light' | 'card';
}

export interface TemplateAttachment extends AttachmentMeta {
  /** Key of the stored file contents. */
  id: string;
}

export type EmailDeliveryStatus = 'Sent' | 'Failed' | 'Draft' | 'Bounced';

export interface EmailActivityRecord {
  id: string;
  campaignId: string;
  campaignName: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  templateId: string;
  templateName: string;
  subject: string;
  renderedBodyHtml: string;
  sentAt: string;
  status: EmailDeliveryStatus;
  simulated: boolean;
  failureReason?: string;
  /** Files sent with this email (metadata only). */
  attachments?: AttachmentMeta[];
  /** First open seen by the tracking pixel (real sends with open tracking on). */
  openedAt?: string;
  openCount?: number;
}

export type CampaignStatus = 'Completed' | 'Partial' | 'Simulated' | 'Failed';

export interface Campaign {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  deliveredRate: number;
  openRate: number;
  clickRate: number;
  sentAt: string;
  status: CampaignStatus;
  recipientRecords: EmailActivityRecord[];
  /**
   * False when open/click engagement was not measured (e.g. simulated sends);
   * openRate/clickRate must not be displayed then. Undefined = legacy tracked data.
   */
  engagementTracked?: boolean;
  /** Files attached to every email in the campaign (metadata only). */
  attachments?: AttachmentMeta[];
  /** Real sends: bounces and opens already counted into the dashboard metrics. */
  bouncedCount?: number;
  openedCount?: number;
  /** Real sends: opens were tracked but clicks were not. */
  clicksTracked?: boolean;
}

export type ActivityEventType =
  | 'email_sent'
  | 'campaign_sent'
  | 'template_created'
  | 'lead_added'
  | 'lead_updated';

export interface ActivityLogItem {
  id: string;
  type: ActivityEventType;
  message: string;
  timestamp: string;
  relatedId?: string;
}

export interface DailyMetricPoint {
  date: string; // YYYY-MM-DD
  label: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  /** Delivered emails whose opens/clicks are not tracked (e.g. simulated sends). */
  untracked?: number;
  /**
   * Delivered emails whose clicks were tracked. Click rate is clicked / clickTracked;
   * days without any are shown with no click rate rather than 0%.
   */
  clickTracked?: number;
}

export interface TeamSettings {
  userName: string;
  /** Profile photo, downscaled to a small JPEG data URL. */
  avatarDataUrl?: string;
  /** Brand colour for styled emails (hex). */
  brandColor?: string;
  /** Public URL of the logo used in styled emails. */
  brandLogoUrl?: string;
  /** Company name shown in the branded-card footer. */
  brandName?: string;
  /** Add an open-tracking pixel to real emails. Off unless turned on. */
  openTrackingEnabled?: boolean;
  userRole: string;
  teamName: string;
  senderDisplayName: string;
  senderEmail: string;
  defaultSignatureHtml: string;
  includeSignatureByDefault: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
  confirmBeforeBulkSend: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  /** Optional button; clicking it runs the action and dismisses the toast. */
  action?: { label: string; onClick: () => void };
  /** Stays until dismissed instead of fading after a few seconds. */
  persistent?: boolean;
}

export type TemplateVariable = 'name' | 'company' | 'email' | 'phone';

/**
 * Persisted description of an attached file. File contents are never written
 * to browser storage; they live in memory while composing and are handed to
 * the email provider at send time.
 */
export interface AttachmentMeta {
  name: string;
  /** Bytes. */
  size: number;
  /** MIME type, may be empty if the browser can't tell. */
  type: string;
}
