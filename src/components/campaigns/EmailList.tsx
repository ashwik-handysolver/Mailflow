import { useState } from 'react';
import { ChevronDown, RotateCcw, Ban, UserRound, ExternalLink } from 'lucide-react';
import { EMAIL_STATE_COLOR, EMAIL_STATE_LABEL, EmailLogRow, friendlyReason } from '../../utils/emailLog';
import { AttachmentList } from '../common/AttachmentList';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

export function formatWhen(ms: number, now = new Date()): string {
  const d = new Date(ms);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function EmailStateBadge({ row }: { row: EmailLogRow }) {
  const label =
    row.state === 'opened' && row.openCount > 1
      ? `Opened ${row.openCount}×`
      : row.state === 'bounced' && row.bounceType === 'soft'
      ? 'Soft bounce'
      : EMAIL_STATE_LABEL[row.state];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-ui', row.state === 'simulated' ? 'text-ink-3' : 'text-ink')}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: EMAIL_STATE_COLOR[row.state] }} aria-hidden="true" />
      {label}
    </span>
  );
}

export interface EmailListActions {
  leadExists: (id: string) => boolean;
  onOpenLead: (id: string) => void;
  onResend: (row: EmailLogRow) => void;
  /** Adds the address to the do-not-contact list; undefined when offline. */
  onSuppress?: (row: EmailLogRow) => void;
  suppressed: Set<string>;
  onOpenCampaign?: (id: string) => void;
  mailboxName?: (id: string | null) => string | null;
}

/**
 * Emails as an expandable list: who, what, outcome, when. Expanding shows the
 * reason in plain words (raw server message underneath), the email itself and
 * the follow-up actions.
 */
export function EmailList({ rows, showCampaign = false, ...actions }: { rows: EmailLogRow[]; showCampaign?: boolean } & EmailListActions) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div>
      <div
        className="hidden border-b border-line py-2 text-xs text-ink-3 md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_120px_130px_16px] md:gap-4"
        aria-hidden="true"
      >
        <span>Recipient</span>
        <span>{showCampaign ? 'Email' : 'Subject'}</span>
        <span>Status</span>
        <span>Sent</span>
        <span />
      </div>
      <ul className="divide-y divide-line/70">
        {rows.map((row) => (
          <EmailItem key={row.id} row={row} open={openId === row.id} onToggle={() => setOpenId(openId === row.id ? null : row.id)} showCampaign={showCampaign} {...actions} />
        ))}
      </ul>
    </div>
  );
}

function EmailItem({
  row,
  open,
  onToggle,
  showCampaign,
  leadExists,
  onOpenLead,
  onResend,
  onSuppress,
  suppressed,
  onOpenCampaign,
  mailboxName,
}: { row: EmailLogRow; open: boolean; onToggle: () => void; showCampaign: boolean } & EmailListActions) {
  const problem = row.state === 'bounced' || row.state === 'failed';
  const reason = problem ? friendlyReason(row.reason, row.state, row.bounceType) : '';
  const isSuppressed = suppressed.has(row.leadEmail.toLowerCase());
  const canResend = row.state === 'failed' || (row.state === 'bounced' && row.bounceType === 'soft') || row.state === 'simulated';
  const mailbox = mailboxName?.(row.mailboxId);

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-3.5 text-left transition-colors hover:bg-subtle/50 focus-visible:bg-subtle focus-visible:outline-none md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_120px_130px_16px] md:items-center"
      >
        <span className="min-w-0">
          <span className="block truncate text-ui font-medium text-ink">{row.leadName || row.leadEmail}</span>
          <span className="block truncate text-xs text-ink-3">{row.leadEmail || 'No email address'}</span>
        </span>
        <span className="md:hidden">
          <EmailStateBadge row={row} />
        </span>
        <span className="col-span-2 min-w-0 md:col-span-1">
          <span className="block truncate text-ui text-ink-2">{row.subject || '(no subject)'}</span>
          {problem ? (
            <span className={cn('block truncate text-xs', row.state === 'failed' ? 'text-danger' : 'text-warning')}>{reason}</span>
          ) : showCampaign ? (
            <span className="block truncate text-xs text-ink-3">{row.campaignName}</span>
          ) : null}
        </span>
        <span className="hidden md:block">
          <EmailStateBadge row={row} />
        </span>
        <span className="col-span-2 text-xs tabular-nums text-ink-3 md:col-span-1 md:text-ui md:text-ink-2">
          {formatWhen(row.sentAt)}
          {row.openedAt && <span className="block text-xs text-ink-3 max-md:inline max-md:before:content-['_·_']">Opened {formatWhen(row.openedAt)}</span>}
        </span>
        <ChevronDown className={cn('hidden size-4 text-ink-4 transition-transform md:block', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-4 pb-6 pt-1">
          {problem && (
            <div className={cn('rounded-md px-3 py-2 text-ui', row.state === 'failed' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning')}>
              <p className="font-medium">{reason}</p>
              {row.reason && <p className="mt-0.5 break-words font-mono text-xs opacity-80">{row.reason}</p>}
            </div>
          )}

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
            {showCampaign && (
              <>
                <dt className="text-ink-3">Campaign</dt>
                <dd className="min-w-0 truncate text-ink-2">
                  {onOpenCampaign ? (
                    <button type="button" onClick={() => onOpenCampaign(row.campaignId)} className="font-medium text-ink hover:underline">
                      {row.campaignName}
                    </button>
                  ) : (
                    row.campaignName
                  )}
                </dd>
              </>
            )}
            <dt className="text-ink-3">Template</dt>
            <dd className="min-w-0 truncate text-ink-2">{row.templateName || '—'}</dd>
            {mailbox && (
              <>
                <dt className="text-ink-3">From</dt>
                <dd className="min-w-0 truncate text-ink-2">{mailbox}</dd>
              </>
            )}
            <dt className="text-ink-3">Opens</dt>
            <dd className="text-ink-2">
              {row.state === 'simulated'
                ? 'Not sent'
                : !row.openTracked
                ? 'Not tracked'
                : row.openedAt
                ? `${row.openCount || 1}× · first ${formatWhen(row.openedAt)}`
                : problem
                ? '—'
                : 'Not opened yet'}
            </dd>
          </dl>

          <div className="mailflow-preview-body max-h-72 overflow-y-auto rounded-lg bg-subtle/60 p-4 text-ui scrollbar-thin" dangerouslySetInnerHTML={{ __html: row.bodyHtml }} />
          {row.attachments && row.attachments.length > 0 && <AttachmentList items={row.attachments} />}

          <div className="flex flex-wrap items-center gap-2">
            {leadExists(row.leadId) && (
              <Button size="sm" variant="secondary" leadingIcon={<UserRound />} onClick={() => onOpenLead(row.leadId)}>
                Open lead
              </Button>
            )}
            {canResend && leadExists(row.leadId) && (
              <Button size="sm" variant="secondary" leadingIcon={<RotateCcw />} onClick={() => onResend(row)}>
                {row.state === 'simulated' ? 'Send for real' : 'Resend'}
              </Button>
            )}
            {row.state === 'bounced' && row.bounceType !== 'soft' && onSuppress &&
              (isSuppressed ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
                  <Ban className="size-3.5" aria-hidden="true" />
                  On do-not-contact list
                </span>
              ) : (
                <Button size="sm" variant="secondary" leadingIcon={<Ban />} onClick={() => onSuppress(row)}>
                  Don't contact again
                </Button>
              ))}
            {showCampaign && onOpenCampaign && (
              <Button size="sm" variant="ghost" leadingIcon={<ExternalLink />} onClick={() => onOpenCampaign(row.campaignId)}>
                View campaign
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
