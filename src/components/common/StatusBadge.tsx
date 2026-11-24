import { CampaignStatus, EmailDeliveryStatus, LeadStatus } from '../../types/outreach';
import { cn } from '../../lib/cn';

/**
 * Statuses render as a coloured dot plus plain text. Bordered pills are
 * reserved for rare, exceptional states so tables stay calm.
 */
function StatusLabel({ color, label, title, muted }: { color: string; label: string; title?: string; muted?: boolean }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-ui', muted ? 'text-ink-3' : 'text-ink')}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  New: 'var(--color-status-new)',
  Contacted: 'var(--color-status-contacted)',
  Interested: 'var(--color-status-interested)',
  'Follow-up': 'var(--color-status-followup)',
  Converted: 'var(--color-status-converted)',
  'Not Interested': 'var(--color-status-lost)',
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <StatusLabel color={LEAD_STATUS_COLOR[status]} label={status} muted={status === 'Not Interested'} />;
}

const CAMPAIGN_STATUS: Record<CampaignStatus, { color: string; hint: string }> = {
  Completed: { color: 'var(--color-success)', hint: 'All emails were accepted for delivery' },
  Partial: { color: 'var(--color-warning)', hint: 'Some recipients failed' },
  Simulated: { color: 'var(--color-ink-4)', hint: 'Sent through the prototype simulator — no real emails left MailFlow' },
  Failed: { color: 'var(--color-danger)', hint: 'No emails could be sent' },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <StatusLabel color={CAMPAIGN_STATUS[status].color} label={status} title={CAMPAIGN_STATUS[status].hint} />;
}

const DELIVERY_COLOR: Record<EmailDeliveryStatus, string> = {
  Sent: 'var(--color-success)',
  Failed: 'var(--color-danger)',
  Draft: 'var(--color-ink-4)',
  Bounced: 'var(--color-warning)',
};

export function DeliveryStatusBadge({ status }: { status: EmailDeliveryStatus }) {
  return <StatusLabel color={DELIVERY_COLOR[status]} label={status} />;
}
