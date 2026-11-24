import { useMemo, useState } from 'react';
import { EmailTemplate, Lead, TeamSettings } from '../../types/outreach';
import { personalizeEmail } from '../../utils/personalization';
import { Dialog } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { Badge } from '../ui/Badge';
import { EmailPreview } from '../common/EmailPreview';

interface TemplatePreviewDialogProps {
  template: EmailTemplate | null;
  leads: Lead[];
  settings: TeamSettings;
  onClose: () => void;
  onEdit?: (template: EmailTemplate) => void;
  /** Primary action, e.g. "Use in campaign" or "Select template". */
  primaryLabel: string;
  onPrimary: (template: EmailTemplate) => void;
}

export function TemplatePreviewDialog({
  template,
  leads,
  settings,
  onClose,
  onEdit,
  primaryLabel,
  onPrimary,
}: TemplatePreviewDialogProps) {
  const [leadId, setLeadId] = useState('');
  const lead = leads.find((l) => l.id === leadId) ?? leads[0] ?? null;

  const preview = useMemo(
    () =>
      template
        ? personalizeEmail({
            subject: template.subject,
            bodyHtml: template.bodyHtml,
            lead,
            signatureHtml: settings.includeSignatureByDefault ? settings.defaultSignatureHtml : undefined,
          })
        : null,
    [template, lead, settings]
  );

  return (
    <Dialog
      open={Boolean(template)}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          {template?.name}
          {template && <Badge>{template.category}</Badge>}
        </span>
      }
      description={template?.description}
      footer={
        template && (
          <>
            {onEdit && (
              <Button className="mr-auto" onClick={() => onEdit(template)}>
                Edit
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={() => onPrimary(template)}>
              {primaryLabel}
            </Button>
          </>
        )
      }
    >
      {template && preview && (
        <div className="space-y-3">
          {leads.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-ui text-ink-3">Previewing with real lead data</p>
              <div className="w-[220px]">
                <Dropdown
                  label="Preview as lead"
                  size="sm"
                  value={lead?.id ?? ''}
                  options={leads.map((l) => ({ value: l.id, label: l.fullName }))}
                  onChange={setLeadId}
                />
              </div>
            </div>
          )}
          <EmailPreview
            highlight
            emailStyle={template.style}
            attachments={template.attachments}
            fromName={settings.senderDisplayName}
            fromEmail={settings.senderEmail}
            toName={lead?.fullName}
            toEmail={lead?.email}
            subjectHtml={preview.previewSubjectHtml}
            bodyHtml={preview.previewBodyHtml}
          />
        </div>
      )}
    </Dialog>
  );
}
