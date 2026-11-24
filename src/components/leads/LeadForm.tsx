import { FormEvent, useId, useState } from 'react';
import { Lead, LeadStatus } from '../../types/outreach';
import { isValidEmail } from '../../utils/leadHelpers';
import { NewLeadInput } from '../../utils/csvImport';
import { Field, Input, Textarea } from '../ui/Field';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Overlay';
import { Dropdown } from '../ui/Dropdown';
import { LEAD_STATUS_COLOR } from '../common/StatusBadge';

export const LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Follow-up',
  'Converted',
  'Not Interested',
];

/** Common industries offered in every industry dropdown. */
export const STANDARD_INDUSTRIES = [
  'SaaS',
  'FinTech',
  'Healthcare',
  'E-Commerce',
  'Retail',
  'Manufacturing',
  'Logistics',
  'Cybersecurity',
  'Enterprise IT',
  'CleanTech',
  'Education',
  'Media',
  'Real Estate',
  'Professional Services',
];

/** Standard industries plus any already used by leads, alphabetical, with "Other" last. */
export function industryOptions(inUse: string[] = []): string[] {
  const set = new Set([...STANDARD_INDUSTRIES, ...inUse.filter(Boolean)]);
  set.delete('Other');
  return [...Array.from(set).sort((a, b) => a.localeCompare(b)), 'Other'];
}

export const STATUS_OPTIONS = LEAD_STATUSES.map((s) => ({ value: s, color: LEAD_STATUS_COLOR[s] }));

interface LeadFormProps {
  formId: string;
  initial: Lead | null;
  industries: string[];
  /** Emails already used by other leads (lower-cased). */
  takenEmails: Set<string>;
  onSubmit: (data: NewLeadInput) => void;
}

type Errors = Partial<Record<'fullName' | 'email', string>>;

/** Lead fields + validation. Rendered inside a dialog (add) or the lead drawer (edit). */
export function LeadForm({ formId, initial, industries, takenEmails, onSubmit }: LeadFormProps) {
  const uid = useId();
  const [values, setValues] = useState({
    fullName: initial?.fullName ?? '',
    email: initial?.email ?? '',
    company: initial?.company ?? '',
    roleTitle: initial?.roleTitle ?? '',
    phone: initial?.phone ?? '',
    industry: initial?.industry || 'Other',
    status: (initial?.status ?? 'New') as LeadStatus,
    notes: initial?.notes ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!values.fullName.trim()) next.fullName = 'Enter a name.';
    const email = values.email.trim();
    if (!email) next.email = 'Enter an email address.';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address, like name@company.com.';
    else if (takenEmails.has(email.toLowerCase())) next.email = 'Another lead already uses this email.';
    return next;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const firstKey = Object.keys(next)[0];
      document.getElementById(`${uid}-${firstKey}`)?.focus();
      return;
    }
    onSubmit({
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      company: values.company.trim(),
      phone: values.phone.trim(),
      industry: values.industry.trim() || 'Other',
      status: values.status,
      roleTitle: values.roleTitle.trim() || undefined,
      notes: values.notes.trim() || undefined,
    });
  };

  const id = (k: string) => `${uid}-${k}`;

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor={id('fullName')} required error={errors.fullName}>
        <Input
          id={id('fullName')}
          data-autofocus
          value={values.fullName}
          onChange={(e) => set('fullName', e.target.value)}
          placeholder="Jordan Taylor"
          autoComplete="off"
          invalid={Boolean(errors.fullName)}
        />
      </Field>
      <Field label="Email" htmlFor={id('email')} required error={errors.email}>
        <Input
          id={id('email')}
          type="email"
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="jordan@company.com"
          autoComplete="off"
          invalid={Boolean(errors.email)}
        />
      </Field>
      <Field label="Company" htmlFor={id('company')} hint="Used by {{company}}">
        <Input
          id={id('company')}
          value={values.company}
          onChange={(e) => set('company', e.target.value)}
          placeholder="Acme Inc."
        />
      </Field>
      <Field label="Job title" htmlFor={id('roleTitle')}>
        <Input
          id={id('roleTitle')}
          value={values.roleTitle}
          onChange={(e) => set('roleTitle', e.target.value)}
          placeholder="Head of Operations"
        />
      </Field>
      <Field label="Phone" htmlFor={id('phone')}>
        <Input
          id={id('phone')}
          type="tel"
          value={values.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+1 (555) 000-0000"
        />
      </Field>
      <Field label="Industry" htmlFor={id('industry')}>
        <Dropdown
          id={id('industry')}
          label="Industry"
          value={values.industry}
          options={industryOptions([...industries, values.industry]).map((i) => ({ value: i }))}
          onChange={(v) => set('industry', v)}
        />
      </Field>
      <Field label="Status" htmlFor={id('status')}>
        <Dropdown
          id={id('status')}
          label="Status"
          value={values.status}
          options={STATUS_OPTIONS}
          onChange={(v) => set('status', v)}
        />
      </Field>
      <Field label="Notes" htmlFor={id('notes')} className="sm:col-span-2">
        <Textarea
          id={id('notes')}
          rows={3}
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Context from calls, meetings or research"
        />
      </Field>
    </form>
  );
}

interface AddLeadDialogProps {
  open: boolean;
  onClose: () => void;
  industries: string[];
  takenEmails: Set<string>;
  onCreate: (data: NewLeadInput) => void;
}

export function AddLeadDialog({ open, onClose, industries, takenEmails, onCreate }: AddLeadDialogProps) {
  const formId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add lead"
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form={formId}>
            Add lead
          </Button>
        </>
      }
    >
      <LeadForm
        formId={formId}
        initial={null}
        industries={industries}
        takenEmails={takenEmails}
        onSubmit={(data) => {
          onCreate(data);
          onClose();
        }}
      />
    </Dialog>
  );
}
