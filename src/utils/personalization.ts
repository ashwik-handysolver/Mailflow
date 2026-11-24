import { Lead, TemplateVariable } from '../types/outreach';

export const SUPPORTED_VARIABLES: readonly TemplateVariable[] = [
  'name',
  'company',
  'email',
  'phone',
] as const;

export const VARIABLE_LABELS: Record<TemplateVariable, string> = {
  name: 'Full Name',
  company: 'Company',
  email: 'Email Address',
  phone: 'Contact Number',
};

export interface PersonalizeEmailInput {
  subject: string;
  bodyHtml: string;
  lead: Partial<Lead> | null | undefined;
  signatureHtml?: string;
}

export interface PersonalizedEmailResult {
  subject: string;
  bodyHtml: string;
  previewSubjectHtml: string;
  previewBodyHtml: string;
  missingFields: TemplateVariable[];
  hasMissingFields: boolean;
  usedVariables: TemplateVariable[];
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getLeadFieldValue(
  lead: Partial<Lead> | null | undefined,
  variable: TemplateVariable
): string {
  if (!lead) return '';
  let raw: unknown;
  switch (variable) {
    case 'name':
      raw = lead.fullName;
      break;
    case 'company':
      raw = lead.company;
      break;
    case 'email':
      raw = lead.email;
      break;
    case 'phone':
      raw = lead.phone;
      break;
    default:
      raw = '';
  }
  if (raw === null || raw === undefined) return '';
  const trimmed = String(raw).trim();
  if (trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
    return '';
  }
  return trimmed;
}

export function getGracefulFallback(variable: TemplateVariable): string {
  switch (variable) {
    case 'name':
      return 'there';
    case 'company':
      return 'your team';
    case 'email':
      return 'your email';
    case 'phone':
      return 'your phone number';
  }
}

const VARIABLE_REGEX = /\{\{\s*(name|company|email|phone)\s*\}\}/gi;

export function extractVariables(content: string): TemplateVariable[] {
  const found = new Set<TemplateVariable>();
  if (!content) return [];
  const matches = content.matchAll(VARIABLE_REGEX);
  for (const match of matches) {
    const key = match[1].toLowerCase() as TemplateVariable;
    found.add(key);
  }
  return Array.from(found);
}

export function personalizeEmail(
  input: PersonalizeEmailInput
): PersonalizedEmailResult {
  const { subject = '', bodyHtml = '', lead, signatureHtml } = input;
  const combinedBody = signatureHtml
    ? `${bodyHtml}<div data-mailflow-signature="true" style="margin-top: 18px; padding-top: 12px; border-top: 1px solid #e7e5e2; color: #52525b; font-size: 0.92em;">${signatureHtml}</div>`
    : bodyHtml;

  const missingSet = new Set<TemplateVariable>();
  const usedSet = new Set<TemplateVariable>();

  const replaceForPlainOrSend = (template: string, isHtml: boolean): string => {
    return template.replace(VARIABLE_REGEX, (_full, rawKey: string) => {
      const key = rawKey.toLowerCase() as TemplateVariable;
      usedSet.add(key);
      const val = getLeadFieldValue(lead, key);
      if (!val) {
        missingSet.add(key);
        const fallback = getGracefulFallback(key);
        return isHtml ? escapeHtml(fallback) : fallback;
      }
      return isHtml ? escapeHtml(val) : val;
    });
  };

  const replaceForPreviewHtml = (template: string, escapePlainBase: boolean): string => {
    if (escapePlainBase) {
      let result = '';
      let lastIdx = 0;
      for (const match of template.matchAll(VARIABLE_REGEX)) {
        const idx = match.index ?? 0;
        result += escapeHtml(template.slice(lastIdx, idx));
        const key = match[1].toLowerCase() as TemplateVariable;
        const val = getLeadFieldValue(lead, key);
        if (!val) {
          result += `<span class="missing-var-highlight" data-missing-var="${key}">[Missing ${VARIABLE_LABELS[key]}]</span>`;
        } else {
          result += `<span class="mf-var-filled" data-var="${key}">${escapeHtml(val)}</span>`;
        }
        lastIdx = idx + match[0].length;
      }
      result += escapeHtml(template.slice(lastIdx));
      return result;
    }

    return template.replace(VARIABLE_REGEX, (_full, rawKey: string) => {
      const key = rawKey.toLowerCase() as TemplateVariable;
      const val = getLeadFieldValue(lead, key);
      if (!val) {
        return `<span class="missing-var-highlight" data-missing-var="${key}">[Missing ${VARIABLE_LABELS[key]}]</span>`;
      }
      return `<span class="mf-var-filled" data-var="${key}">${escapeHtml(val)}</span>`;
    });
  };

  const renderedSubject = replaceForPlainOrSend(subject, false);
  const renderedBodyHtml = replaceForPlainOrSend(combinedBody, true);
  const previewSubjectHtml = replaceForPreviewHtml(subject, true);
  const previewBodyHtml = replaceForPreviewHtml(combinedBody, false);

  const missingFields = Array.from(missingSet);
  return {
    subject: renderedSubject,
    bodyHtml: renderedBodyHtml,
    previewSubjectHtml,
    previewBodyHtml,
    missingFields,
    hasMissingFields: missingFields.length > 0,
    usedVariables: Array.from(usedSet),
  };
}
