import { DragEvent, useId, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, FilePlus2, FileText } from 'lucide-react';
import { ATTACHMENT_LIMITS, formatBytes, PendingAttachment, toMeta } from '../../../utils/attachments';
import { AttachmentField } from '../../common/AttachmentField';
import { EMAIL_STYLES, EmailStyle } from '../../../utils/emailTheme';
import { cn } from '../../../lib/cn';
import { EmailTemplate, TeamSettings } from '../../../types/outreach';
import { getGracefulFallback, VARIABLE_LABELS } from '../../../utils/personalization';
import { Button, IconButton } from '../../ui/Button';
import { Switch } from '../../ui/Field';
import { Callout } from '../../ui/Misc';
import { Menu } from '../../ui/Menu';
import { Dropdown } from '../../ui/Dropdown';
import { RichTextEditor } from '../../common/RichTextEditor';
import { SubjectInput } from '../../common/SubjectInput';
import { EmailPreview } from '../../common/EmailPreview';
import { RecipientPersonalization, TemplateChoice } from '../composerTypes';

export interface MessageErrors {
  subject?: string;
  body?: string;
}

interface MessageStepProps {
  templates: EmailTemplate[];
  choice: TemplateChoice;
  onChooseTemplate: (choice: Exclude<TemplateChoice, null>) => void;
  subject: string;
  bodyHtml: string;
  onSubject: (v: string) => void;
  onBody: (v: string) => void;
  includeSignature: boolean;
  hasSignature: boolean;
  onIncludeSignature: (v: boolean) => void;
  errors: MessageErrors;
  personalizations: RecipientPersonalization[];
  activeLeadId: string;
  onActiveLeadChange: (id: string) => void;
  settings: TeamSettings;
  attachments: PendingAttachment[];
  /** Adds what fits within the limits; returns messages for rejected files. */
  onAddFiles: (files: File[]) => string[];
  onRemoveAttachment: (id: string) => void;
  emailStyle: EmailStyle;
  onEmailStyle: (style: EmailStyle) => void;
}

export function MessageStep({
  templates,
  choice,
  onChooseTemplate,
  subject,
  bodyHtml,
  onSubject,
  onBody,
  includeSignature,
  hasSignature,
  onIncludeSignature,
  errors,
  personalizations,
  activeLeadId,
  onActiveLeadChange,
  settings,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  emailStyle,
  onEmailStyle,
}: MessageStepProps) {
  const uid = useId();
  const [highlight, setHighlight] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [dropErrors, setDropErrors] = useState<string[]>([]);

  const selectedTemplate = choice && choice !== 'scratch' ? templates.find((t) => t.id === choice) : null;
  const templateLabel = choice === 'scratch' ? 'Blank email' : selectedTemplate?.name ?? 'Choose a template';

  const activeIndex = Math.max(0, personalizations.findIndex((p) => p.lead.id === activeLeadId));
  const active = personalizations[activeIndex];
  const issues = personalizations.filter((p) => p.result.hasMissingFields || !p.validEmail);

  const cycle = (dir: -1 | 1) => {
    const next = (activeIndex + dir + personalizations.length) % personalizations.length;
    onActiveLeadChange(personalizations[next].lead.id);
  };
  const nextIssue = () => {
    if (issues.length === 0) return;
    const after = issues.find((p) => personalizations.indexOf(p) > activeIndex) ?? issues[0];
    onActiveLeadChange(after.lead.id);
  };

  const fallbacks = useMemo(
    () =>
      active?.result.missingFields.map((f) => ({ field: VARIABLE_LABELS[f].toLowerCase(), fallback: getGracefulFallback(f) })) ?? [],
    [active]
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
      {/* Editor — dropping files anywhere here attaches them */}
      <div
        className={cn('relative min-w-0 space-y-4 rounded-lg', dragging && 'outline-2 outline-dashed outline-offset-4 outline-accent')}
        onDragOverCapture={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDropCapture={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          setDropErrors(onAddFiles(Array.from(e.dataTransfer.files)));
        }}
      >
        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-ui text-ink-3">Template</span>
          <Menu
            align="start"
            width={300}
            items={[
              { label: 'Blank email', icon: <FilePlus2 />, onSelect: () => onChooseTemplate('scratch') },
              ...templates.map((t, i) => ({
                label: t.name,
                icon: <FileText />,
                separated: i === 0,
                hint: <span className="text-xs text-ink-3">{t.category}</span>,
                onSelect: () => onChooseTemplate(t.id),
              })),
            ]}
            trigger={(p) => (
              <Button size="sm" trailingIcon={<ChevronDown />} {...p}>
                {templateLabel}
              </Button>
            )}
          />
        </div>

        <div className="flex items-start gap-3">
          <label htmlFor={`${uid}-subject`} className="w-16 shrink-0 pt-2 text-ui text-ink-3">
            Subject
          </label>
          <div className="min-w-0 flex-1">
            <SubjectInput
              id={`${uid}-subject`}
              value={subject}
              onChange={onSubject}
              invalid={Boolean(errors.subject)}
              placeholder="Quick question about {{company}}"
            />
            {errors.subject && (
              <p className="mt-1 text-xs text-danger" role="alert">
                {errors.subject}
              </p>
            )}
          </div>
        </div>

        <div>
          <RichTextEditor
            value={bodyHtml}
            onChange={onBody}
            minHeightClass="min-h-[340px]"
            ariaLabel="Email message"
            placeholder="Write your message. Type {{ to insert a variable."
          />
          {errors.body && (
            <p className="mt-1 text-xs text-danger" role="alert">
              {errors.body}
            </p>
          )}
        </div>

        <AttachmentField
          items={attachments.map((a) => ({ ...toMeta(a.file), id: a.id }))}
          onAddFiles={onAddFiles}
          onRemove={onRemoveAttachment}
          errors={dropErrors}
          onErrors={setDropErrors}
          emptyHint={`or drop files here · up to ${formatBytes(ATTACHMENT_LIMITS.maxFileBytes)} each`}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-ui font-medium text-ink">Email style</span>
          <div className="w-[180px]">
            <Dropdown
              label="Email style"
              size="sm"
              value={emailStyle}
              options={EMAIL_STYLES.map((s) => ({ value: s.value, label: s.label }))}
              onChange={(v) => onEmailStyle(v as EmailStyle)}
            />
          </div>
          <span className="text-xs text-ink-3">{EMAIL_STYLES.find((s) => s.value === emailStyle)?.description}</span>
        </div>

        <Switch
          checked={includeSignature && hasSignature}
          disabled={!hasSignature}
          onChange={onIncludeSignature}
          label="Append my signature"
          description={hasSignature ? undefined : 'Add a signature in Settings to use this.'}
        />
      </div>

      {/* Live preview */}
      {active && (
        <section aria-label="Live preview" className="min-w-0 space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <IconButton label="Previous recipient" size="sm" onClick={() => cycle(-1)} disabled={personalizations.length < 2}>
              <ChevronLeft />
            </IconButton>
            <div className="min-w-[150px] flex-1 sm:w-[220px] sm:flex-none">
              <Dropdown
                label="Preview as recipient"
                size="sm"
                value={active.lead.id}
                options={personalizations.map((p) => ({
                  value: p.lead.id,
                  label: p.lead.fullName,
                  // Amber dot marks recipients with missing data or an invalid email.
                  color: p.result.hasMissingFields || !p.validEmail ? 'var(--color-warning)' : undefined,
                }))}
                onChange={onActiveLeadChange}
              />
            </div>
            <IconButton label="Next recipient" size="sm" onClick={() => cycle(1)} disabled={personalizations.length < 2}>
              <ChevronRight />
            </IconButton>
            <span className="text-xs tabular-nums text-ink-3">
              {activeIndex + 1} of {personalizations.length}
            </span>
            <div className="ml-auto shrink-0 [&_label]:whitespace-nowrap">
              <Switch checked={highlight} onChange={setHighlight} label="Highlight fields" />
            </div>
          </div>

          {issues.length > 0 && (
            <div className="flex items-center justify-between gap-3 text-ui">
              <span className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {issues.length} of {personalizations.length} {personalizations.length === 1 ? 'recipient has' : 'recipients have'} issues
              </span>
              <Button variant="link" size="sm" onClick={nextIssue}>
                Next issue
              </Button>
            </div>
          )}

          {!active.validEmail && (
            <Callout tone="danger" icon={<AlertTriangle />}>
              "{active.lead.email || 'empty'}" isn't a valid address — this email will fail.
            </Callout>
          )}
          {fallbacks.length > 0 && (
            <Callout tone="warning" icon={<AlertTriangle />}>
              No {fallbacks.map((f) => f.field).join(' or ')} for {active.lead.fullName}. If sent, it will read{' '}
              {fallbacks.map((f, i) => (
                <span key={f.field}>
                  {i > 0 && ' and '}
                  <span className="font-medium text-ink">"{f.fallback}"</span>
                </span>
              ))}
              .
            </Callout>
          )}

          <EmailPreview
            highlight={highlight}
            emailStyle={emailStyle}
            attachments={attachments.map((a) => toMeta(a.file))}
            fromName={settings.senderDisplayName}
            fromEmail={settings.senderEmail}
            toName={active.lead.fullName}
            toEmail={active.lead.email}
            subjectHtml={active.result.previewSubjectHtml}
            bodyHtml={active.result.previewBodyHtml}
          />
        </section>
      )}
    </div>
  );
}

function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer.types).includes('Files');
}
