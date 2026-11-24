import { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Info,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';
import { AttachmentMeta, EmailActivityRecord, TeamSettings } from '../../../types/outreach';
import { formatBytes, totalBytes } from '../../../utils/attachments';
import { AttachmentList } from '../../common/AttachmentList';
import { VARIABLE_LABELS } from '../../../utils/personalization';
import { Button } from '../../ui/Button';
import { Callout } from '../../ui/Misc';
import { DeliveryStatusBadge } from '../../common/StatusBadge';
import { TokenizedText } from '../../common/TokenizedText';
import { cn } from '../../../lib/cn';
import { RecipientPersonalization } from '../composerTypes';

export type SendState =
  | { phase: 'idle' }
  | { phase: 'sending'; completed: number; total: number; sent: number; failed: number; records: EmailActivityRecord[] }
  | { phase: 'done'; sent: number; failed: number; records: EmailActivityRecord[]; campaignName: string }
  | { phase: 'error'; message: string };

interface ReviewStepProps {
  campaignName: string;
  templateName: string;
  subject: string;
  includeSignature: boolean;
  attachments: AttachmentMeta[];
  settings: TeamSettings;
  personalizations: RecipientPersonalization[];
  isSimulated: boolean;
  providerName: string;
  onEditStep: (step: 1 | 2) => void;
  onRemoveInvalid: () => void;
}

export function ReviewStep({
  campaignName,
  templateName,
  subject,
  includeSignature,
  attachments,
  settings,
  personalizations,
  isSimulated,
  providerName,
  onEditStep,
  onRemoveInvalid,
}: ReviewStepProps) {
  const invalid = personalizations.filter((p) => !p.validEmail);
  const missing = personalizations.filter((p) => p.validEmail && p.result.hasMissingFields);
  const missingFields = Array.from(new Set(missing.flatMap((p) => p.result.missingFields)));
  const deliverable = personalizations.length - invalid.length;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="summary-title" className="rounded-lg border border-line bg-surface">
        <h2 id="summary-title" className="border-b border-line px-5 py-3 text-ui font-semibold text-ink">
          Campaign summary
        </h2>
        <dl className="divide-y divide-line">
          <SummaryRow label="Campaign">
            {campaignName}
          </SummaryRow>
          <SummaryRow label="Recipients" onEdit={() => onEditStep(1)}>
            <span className="tabular-nums">{personalizations.length}</span>{' '}
            {personalizations.length === 1 ? 'lead' : 'leads'}
            <span className="block text-xs text-ink-3 truncate">
              {personalizations
                .slice(0, 3)
                .map((p) => p.lead.fullName)
                .join(', ')}
              {personalizations.length > 3 && ` and ${personalizations.length - 3} more`}
            </span>
          </SummaryRow>
          <SummaryRow label="Template" onEdit={() => onEditStep(2)}>
            {templateName}
          </SummaryRow>
          <SummaryRow label="Subject" onEdit={() => onEditStep(2)}>
            <TokenizedText text={subject} />
          </SummaryRow>
          <SummaryRow label="From">
            {settings.senderDisplayName}
            <span className="block text-xs text-ink-3">{settings.senderEmail}</span>
          </SummaryRow>
          <SummaryRow label="Attachments" onEdit={() => onEditStep(2)}>
            {attachments.length === 0 ? (
              <span className="text-ink-3">None</span>
            ) : (
              <>
                <span className="tabular-nums">
                  {attachments.length} {attachments.length === 1 ? 'file' : 'files'} · {formatBytes(totalBytes(attachments))}
                </span>
                <AttachmentList items={attachments} className="mt-1.5" />
              </>
            )}
          </SummaryRow>
          <SummaryRow label="Signature">{includeSignature ? 'Included' : 'Not included'}</SummaryRow>
        </dl>
      </section>

      <section aria-labelledby="checks-title" className="space-y-3">
        <h2 id="checks-title" className="text-ui font-semibold text-ink">
          Pre-send checks
        </h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          <Check
            status={invalid.length === 0 ? 'pass' : 'fail'}
            title={
              invalid.length === 0
                ? 'All email addresses are valid'
                : `${invalid.length} invalid ${invalid.length === 1 ? 'address' : 'addresses'}`
            }
            detail={invalid.length > 0 ? 'These recipients will fail to send.' : undefined}
            action={
              invalid.length > 0 && (
                <Button size="sm" variant="link" onClick={onRemoveInvalid}>
                  Remove them
                </Button>
              )
            }
          />
          <Check
            status={missing.length === 0 ? 'pass' : 'warn'}
            title={
              missing.length === 0
                ? 'Personalization complete'
                : `${missing.length} ${missing.length === 1 ? 'recipient is' : 'recipients are'} missing data`
            }
            detail={
              missing.length > 0
                ? `No ${missingFields.map((f) => VARIABLE_LABELS[f].toLowerCase()).join(' or ')} — generic wording will be used.`
                : undefined
            }
            action={
              missing.length > 0 && (
                <Button size="sm" variant="link" onClick={() => onEditStep(2)}>
                  Review
                </Button>
              )
            }
          />
          <Check
            status={isSimulated ? 'info' : 'pass'}
            title={isSimulated ? 'Simulation mode' : `Sending via ${providerName}`}
            detail={
              isSimulated
                ? 'No email provider is connected, so nothing leaves MailFlow. Results are recorded as simulated.'
                : undefined
            }
          />
        </ul>
        <p className="text-xs text-ink-3">
          <span className="font-medium text-ink-2 tabular-nums">{deliverable}</span> of{' '}
          <span className="tabular-nums">{personalizations.length}</span> emails are expected to send.
        </p>
      </section>
    </div>
  );
}

function SummaryRow({ label, children, onEdit }: { label: string; children: ReactNode; onEdit?: () => void }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)_auto] items-start gap-3 px-5 py-3">
      <dt className="text-ui text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-ui text-ink">{children}</dd>
      {onEdit ? (
        <Button variant="link" size="sm" onClick={onEdit} aria-label={`Edit ${label.toLowerCase()}`}>
          Edit
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

function Check({
  status,
  title,
  detail,
  action,
}: {
  status: 'pass' | 'warn' | 'fail' | 'info';
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  const icon = {
    pass: <CheckCircle2 className="text-success" />,
    warn: <AlertTriangle className="text-warning" />,
    fail: <XCircle className="text-danger" />,
    info: <FlaskConical className="text-info" />,
  }[status];
  return (
    <li className="flex items-start gap-2.5 px-3.5 py-3">
      <span className="mt-px shrink-0 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-ui font-medium text-ink">{title}</p>
        {detail && <p className="mt-0.5 text-xs text-ink-3">{detail}</p>}
      </div>
      {action}
    </li>
  );
}

/* ---------------- Sending / result views ---------------- */

interface SendStatusViewProps {
  state: Exclude<SendState, { phase: 'idle' }>;
  isSimulated: boolean;
  onRetry: () => void;
  onBackToReview: () => void;
  onDashboard: () => void;
  onNewCampaign: () => void;
}

export function SendStatusView({
  state,
  isSimulated,
  onRetry,
  onBackToReview,
  onDashboard,
  onNewCampaign,
}: SendStatusViewProps) {
  if (state.phase === 'error') {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <XCircle className="mx-auto size-6 text-danger" />
        <h2 className="mt-3 text-heading font-semibold text-ink">The campaign couldn't be sent</h2>
        <p className="mt-1 text-ui text-ink-3">{state.message}</p>
        <p className="mt-1 text-ui text-ink-3">Nothing was recorded. Your recipients and content are unchanged.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={onBackToReview}>Back to review</Button>
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const sending = state.phase === 'sending';
  const total = sending ? state.total : state.sent + state.failed;
  const completed = sending ? state.completed : total;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const failedRecords = state.records.filter((r) => r.status === 'Failed');

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-4">
      <div className="text-center">
        {sending ? (
          <Loader2 className="mx-auto size-6 animate-spin text-accent" />
        ) : state.sent === 0 ? (
          <XCircle className="mx-auto size-6 text-danger" />
        ) : state.failed > 0 ? (
          <AlertTriangle className="mx-auto size-6 text-warning" />
        ) : (
          <CheckCircle2 className="mx-auto size-6 text-success" />
        )}
        <h2 className="mt-3 text-heading font-semibold text-ink" aria-live="polite">
          {sending
            ? `Sending ${completed} of ${total}…`
            : state.sent === 0
            ? 'No emails were sent'
            : state.failed > 0
            ? `${state.sent} sent, ${state.failed} failed`
            : `${state.sent} ${state.sent === 1 ? 'email' : 'emails'} sent`}
        </h2>
        <p className="mt-1 text-ui text-ink-3">
          {sending
            ? 'Keep this page open until sending finishes.'
            : isSimulated
            ? `"${state.campaignName}" was processed by the simulator. No real emails were delivered.`
            : `"${state.campaignName}" has been handed to your email provider.`}
        </p>
      </div>

      <div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Send progress"
        >
          <div
            className={cn('h-full rounded-full transition-[width] duration-200', sending ? 'bg-accent' : state.failed > 0 ? 'bg-warning' : 'bg-success')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-ink-3 tabular-nums">
          <span>
            {state.sent} sent · {state.failed} failed
          </span>
          <span>{pct}%</span>
        </div>
      </div>

      {!sending && failedRecords.length > 0 && (
        <Callout tone="danger" icon={<AlertTriangle />} title="Failed recipients">
          <ul className="mt-1 space-y-0.5">
            {failedRecords.map((r) => (
              <li key={r.id}>
                {r.leadName} — {r.failureReason ?? 'Unknown error'}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="rounded-lg border border-line bg-surface">
        <p className="border-b border-line px-4 py-2 text-xs font-medium text-ink-3">Delivery log</p>
        <ul className="max-h-64 divide-y divide-line overflow-y-auto scrollbar-thin">
          {[...state.records].reverse().map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="min-w-0 truncate text-ui text-ink">
                {r.leadName} <span className="text-ink-3">· {r.leadEmail || 'no email'}</span>
              </span>
              <DeliveryStatusBadge status={r.status} />
            </li>
          ))}
          {state.records.length === 0 && (
            <li className="flex items-center gap-2 px-4 py-3 text-ui text-ink-3">
              <Info className="size-4" /> Preparing emails…
            </li>
          )}
        </ul>
      </div>

      {!sending && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onNewCampaign}>New campaign</Button>
          <Button variant="primary" onClick={onDashboard}>
            View dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
