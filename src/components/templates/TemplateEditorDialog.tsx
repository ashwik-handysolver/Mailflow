import { FormEvent, useId, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EmailTemplate, Lead, TeamSettings, TemplateAttachment, TemplateCategory } from '../../types/outreach';
import { checkAttachments, toMeta } from '../../utils/attachments';
import { newAttachmentId } from '../../utils/attachmentStore';
import { AttachmentField } from '../common/AttachmentField';
import { extractVariables, personalizeEmail, stripHtml, VARIABLE_LABELS } from '../../utils/personalization';
import { Dialog, ConfirmDialog } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { EMAIL_STYLES, EmailStyle } from '../../utils/emailTheme';
import { Field, Input } from '../ui/Field';
import { Callout, SegmentedControl } from '../ui/Misc';
import { RichTextEditor } from '../common/RichTextEditor';
import { SubjectInput } from '../common/SubjectInput';
import { EmailPreview } from '../common/EmailPreview';
import { cn } from '../../lib/cn';

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Outreach',
  'Pitch',
  'Follow-up',
  'Meeting',
  'Proposal',
  'Relationship',
];

const NEW_TEMPLATE = {
  subject: "Let's explore an opportunity with {{company}}",
  bodyHtml:
    "<p>Hi {{name}},</p><p>I hope you're doing well. I wanted to reach out to explore how our team could work with <strong>{{company}}</strong>.</p><p>Would you be open to a short call this week?</p>",
};

export type TemplateDraft = Omit<EmailTemplate, 'id' | 'lastModified' | 'createdBy'> & { id?: string };

/** Newly added files whose contents must be stored before the template is saved. */
export type NewTemplateFile = { id: string; file: File };

interface TemplateEditorDialogProps {
  open: boolean;
  template: EmailTemplate | null;
  leads: Lead[];
  settings: TeamSettings;
  onClose: () => void;
  /** Rejects if the files can't be stored; the editor then stays open and shows the error. */
  onSave: (draft: TemplateDraft, newFiles: NewTemplateFile[]) => Promise<void>;
}

interface EditorFile {
  att: TemplateAttachment;
  /** Present only for files added in this session (not yet stored). */
  file?: File;
}

export function TemplateEditorDialog(props: TemplateEditorDialogProps) {
  return props.open ? <Editor key={props.template?.id ?? 'new'} {...props} /> : null;
}

function Editor({ template, leads, settings, onClose, onSave }: TemplateEditorDialogProps) {
  const uid = useId();
  const initial = useMemo(
    () => ({
      name: template?.name ?? '',
      category: template?.category ?? ('Outreach' as TemplateCategory),
      description: template?.description ?? '',
      subject: template?.subject ?? NEW_TEMPLATE.subject,
      bodyHtml: template?.bodyHtml ?? NEW_TEMPLATE.bodyHtml,
      style: (template?.style ?? 'plain') as EmailStyle,
    }),
    [template]
  );
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'subject' | 'body', string>>>({});
  const [sampleLeadId, setSampleLeadId] = useState(leads[0]?.id ?? '');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showDescription, setShowDescription] = useState(Boolean(template?.description));
  const [files, setFiles] = useState<EditorFile[]>(() => (template?.attachments ?? []).map((att) => ({ att })));
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const initialFileIds = (template?.attachments ?? []).map((a) => a.id).join(',');
  const dirty =
    JSON.stringify(values) !== JSON.stringify(initial) || files.map((f) => f.att.id).join(',') !== initialFileIds;

  const addFiles = (incoming: File[]): string[] => {
    const { accepted, errors: rejected } = checkAttachments(
      files.map((f) => f.att),
      incoming
    );
    if (accepted.length > 0) {
      setFiles((cur) => [...cur, ...accepted.map((file) => ({ att: { id: newAttachmentId(), ...toMeta(file) }, file }))]);
    }
    return rejected;
  };
  const sampleLead = leads.find((l) => l.id === sampleLeadId) ?? leads[0] ?? null;

  const preview = useMemo(
    () =>
      personalizeEmail({
        subject: values.subject,
        bodyHtml: values.bodyHtml,
        lead: sampleLead,
        signatureHtml: settings.includeSignatureByDefault ? settings.defaultSignatureHtml : undefined,
      }),
    [values.subject, values.bodyHtml, sampleLead, settings]
  );

  const usedVariables = useMemo(
    () => extractVariables(`${values.subject} ${values.bodyHtml}`),
    [values.subject, values.bodyHtml]
  );

  const set = <K extends keyof typeof values>(key: K, v: (typeof values)[K]) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    const errKey = key === 'bodyHtml' ? 'body' : key;
    if (errKey in errors) setErrors((e) => ({ ...e, [errKey]: undefined }));
  };

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = 'Give the template a name.';
    if (!values.subject.trim()) next.subject = 'Add a subject line.';
    if (!stripHtml(values.bodyHtml)) next.body = 'Write the email body.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setMobileView('edit');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(
        {
          id: template?.id,
          name: values.name.trim(),
          category: values.category,
          description: values.description.trim(),
          subject: values.subject.trim(),
          bodyHtml: values.bodyHtml,
          attachments: files.map((f) => f.att),
          style: values.style,
        },
        files.filter((f) => f.file).map((f) => ({ id: f.att.id, file: f.file! }))
      );
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'The attachments could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open
        onClose={requestClose}
        size="full"
        bare
        title={template ? 'Edit template' : 'New template'}
        footer={
          <>
            <span className="mr-auto hidden text-xs text-ink-3 sm:inline">
              {dirty ? 'Unsaved changes' : template ? 'No changes' : ''}
            </span>
            <Button onClick={requestClose}>Cancel</Button>
            <Button variant="primary" type="submit" form={`${uid}-form`} loading={saving}>
              {template ? 'Save template' : 'Create template'}
            </Button>
          </>
        }
      >
        <div className="flex h-full flex-col">
        <div className="border-b border-line px-5 py-2 lg:hidden">
          <SegmentedControl
            ariaLabel="Editor view"
            size="sm"
            value={mobileView}
            onChange={setMobileView}
            options={[
              { value: 'edit', label: 'Edit' },
              { value: 'preview', label: 'Preview' },
            ]}
          />
        </div>
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form
            id={`${uid}-form`}
            onSubmit={submit}
            noValidate
            className={cn(
              'space-y-4 overflow-y-auto scrollbar-thin px-5 py-5 lg:border-r lg:border-line',
              mobileView === 'preview' && 'hidden lg:block'
            )}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Template name" htmlFor={`${uid}-name`} required error={errors.name}>
                <Input
                  id={`${uid}-name`}
                  data-autofocus
                  value={values.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Webinar follow-up"
                  invalid={Boolean(errors.name)}
                />
              </Field>
              <Field label="Category" htmlFor={`${uid}-category`}>
                <Dropdown
                  id={`${uid}-category`}
                  label="Category"
                  value={values.category}
                  options={TEMPLATE_CATEGORIES.map((c) => ({ value: c }))}
                  onChange={(v) => set('category', v)}
                />
              </Field>
            </div>
            <Field
              label="Email style"
              htmlFor={`${uid}-style`}
              hint={EMAIL_STYLES.find((s) => s.value === values.style)?.description}
            >
              <Dropdown
                id={`${uid}-style`}
                label="Email style"
                value={values.style}
                options={EMAIL_STYLES.map((s) => ({ value: s.value, label: s.label }))}
                onChange={(v) => set('style', v as EmailStyle)}
              />
            </Field>
            {showDescription ? (
              <Field label="Description" htmlFor={`${uid}-desc`} hint="Optional. Helps teammates pick the right template.">
                <Input
                  id={`${uid}-desc`}
                  value={values.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="When to use this template"
                />
              </Field>
            ) : (
              <Button variant="link" size="sm" onClick={() => setShowDescription(true)}>
                + Add a description
              </Button>
            )}
            <Field label="Subject" htmlFor={`${uid}-subject`} required error={errors.subject}>
              <SubjectInput
                id={`${uid}-subject`}
                value={values.subject}
                onChange={(v) => set('subject', v)}
                invalid={Boolean(errors.subject)}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-ui font-medium text-ink">
                Body<span className="text-danger ml-0.5" aria-hidden="true">*</span>
              </span>
              <RichTextEditor
                value={values.bodyHtml}
                onChange={(html) => set('bodyHtml', html)}
                minHeightClass="min-h-[260px]"
              />
              {errors.body && (
                <p className="text-xs text-danger" role="alert">
                  {errors.body}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-ui font-medium text-ink">Attachments</span>
              <AttachmentField
                items={files.map((f) => f.att)}
                onAddFiles={addFiles}
                onRemove={(id) => setFiles((cur) => cur.filter((f) => f.att.id !== id))}
                errors={fileErrors}
                onErrors={setFileErrors}
                emptyHint="Sent with every email that uses this template"
              />
            </div>
            {saveError && (
              <Callout tone="danger" icon={<AlertTriangle />}>
                {saveError}
              </Callout>
            )}
          </form>

          <div
            className={cn(
              'overflow-y-auto scrollbar-thin bg-canvas px-5 py-5 space-y-3',
              mobileView === 'edit' && 'hidden lg:block'
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ui font-medium text-ink">Live preview</p>
              {leads.length > 0 && (
                <div className="w-[220px]">
                  <Dropdown
                    label="Preview as lead"
                    size="sm"
                    value={sampleLead?.id ?? ''}
                    options={leads.map((l) => ({ value: l.id, label: `Preview as ${l.fullName}` }))}
                    onChange={setSampleLeadId}
                  />
                </div>
              )}
            </div>
            {preview.hasMissingFields && (
              <Callout tone="warning" icon={<AlertTriangle />}>
                {sampleLead?.fullName ?? 'This lead'} is missing{' '}
                {preview.missingFields.map((f) => VARIABLE_LABELS[f].toLowerCase()).join(', ')} — highlighted below.
              </Callout>
            )}
            <EmailPreview
              highlight
              emailStyle={values.style}
              attachments={files.map((f) => f.att)}
              fromName={settings.senderDisplayName}
              fromEmail={settings.senderEmail}
              toName={sampleLead?.fullName}
              toEmail={sampleLead?.email}
              subjectHtml={preview.previewSubjectHtml}
              bodyHtml={preview.previewBodyHtml}
            />
            <p className="text-xs text-ink-3">
              {usedVariables.length > 0
                ? `Uses ${usedVariables.map((v) => `{{${v}}}`).join(', ')}.`
                : 'This template has no personalization variables.'}
              {settings.includeSignatureByDefault && ' Your default signature is appended.'}
            </p>
          </div>
        </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        description="Your edits to this template haven't been saved."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
