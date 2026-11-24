import { Lead, LeadStatus } from '../types/outreach';
import { isValidEmail } from './leadHelpers';

export type NewLeadInput = Omit<Lead, 'id' | 'createdAt' | 'lastContacted'>;

export type ImportField =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'company'
  | 'phone'
  | 'industry'
  | 'status'
  | 'roleTitle';

export const IMPORT_FIELDS: { key: ImportField; label: string; hint?: string }[] = [
  { key: 'fullName', label: 'Full name', hint: 'Or map first + last name' },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email', hint: 'Required' },
  { key: 'company', label: 'Company' },
  { key: 'phone', label: 'Phone' },
  { key: 'industry', label: 'Industry' },
  { key: 'status', label: 'Lead status' },
  { key: 'roleTitle', label: 'Job title' },
];

/** Column index per field; -1 = not mapped. */
export type ColumnMapping = Record<ImportField, number>;

export const EMPTY_MAPPING: ColumnMapping = {
  fullName: -1,
  firstName: -1,
  lastName: -1,
  email: -1,
  company: -1,
  phone: -1,
  industry: -1,
  status: -1,
  roleTitle: -1,
};

const LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Not Interested'];

/** Splits one CSV line, honouring quoted values and escaped quotes. */
export function splitCsvLine(line: string, delimiter = ','): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export interface CsvTable {
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
}

/** Parses CSV text into a header + rows table. Detects ; or tab delimiters. */
export function parseCsvTable(text: string): CsvTable {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], hasHeader: false };

  const first = lines[0];
  const delimiter =
    first.split('\t').length > first.split(',').length
      ? '\t'
      : first.split(';').length > first.split(',').length
      ? ';'
      : ',';

  const all = lines.map((l) => splitCsvLine(l, delimiter));
  // A first row containing an email address is data, not a header.
  const hasHeader = !all[0].some((cell) => isValidEmail(cell));
  const width = Math.max(...all.map((r) => r.length));
  const headers = hasHeader
    ? all[0].map((h, i) => h || `Column ${i + 1}`)
    : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  return { headers, rows: hasHeader ? all.slice(1) : all, hasHeader };
}

const FIELD_PATTERNS: [ImportField, RegExp][] = [
  ['email', /e-?mail/],
  ['firstName', /^(first|given)[\s_-]*name|^first$/],
  ['lastName', /^(last|family|sur)[\s_-]*name|^surname$|^last$/],
  ['company', /company|organi[sz]ation|^org\b|account|business|employer/],
  ['phone', /phone|mobile|^tel|contact[\s_-]*(number|no)/],
  ['industry', /industry|sector|vertical/],
  ['status', /status|stage/],
  ['roleTitle', /title|role|position|job/],
  ['fullName', /name|contact|person|lead/],
];

/** Best-effort mapping from header names; each column is used at most once. */
export function guessColumnMapping(table: CsvTable): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING };
  if (!table.hasHeader) {
    // Positional fallback matching the documented sample format.
    const order: ImportField[] = ['fullName', 'company', 'email', 'phone', 'industry', 'status'];
    order.forEach((field, i) => {
      if (i < table.headers.length) mapping[field] = i;
    });
    return mapping;
  }

  const used = new Set<number>();
  for (const [field, pattern] of FIELD_PATTERNS) {
    const idx = table.headers.findIndex(
      (h, i) => !used.has(i) && pattern.test(h.trim().toLowerCase())
    );
    if (idx >= 0) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  // Prefer first+last when both exist and no explicit full-name column.
  if (mapping.firstName >= 0 && mapping.lastName >= 0 && mapping.fullName >= 0) {
    const header = table.headers[mapping.fullName].toLowerCase();
    if (!/full|^name$/.test(header)) mapping.fullName = -1;
  }
  return mapping;
}

export type ImportIssue = 'missing_name' | 'invalid_email' | 'duplicate_existing' | 'duplicate_in_file';

export const ISSUE_LABELS: Record<ImportIssue, string> = {
  missing_name: 'Missing name',
  invalid_email: 'Invalid email',
  duplicate_existing: 'Already in leads',
  duplicate_in_file: 'Duplicate in file',
};

export interface ImportRow {
  /** 1-based line number in the original file. */
  line: number;
  lead: NewLeadInput;
  issue: ImportIssue | null;
}

export function buildImportRows(
  table: CsvTable,
  mapping: ColumnMapping,
  existingEmails: Iterable<string>
): ImportRow[] {
  const existing = new Set(Array.from(existingEmails, (e) => e.trim().toLowerCase()));
  const seen = new Set<string>();
  const cell = (row: string[], field: ImportField) =>
    mapping[field] >= 0 ? (row[mapping[field]] ?? '').trim() : '';

  return table.rows.map((row, i) => {
    const fullName =
      cell(row, 'fullName') || [cell(row, 'firstName'), cell(row, 'lastName')].filter(Boolean).join(' ');
    const email = cell(row, 'email');
    const rawStatus = cell(row, 'status');
    const status = LEAD_STATUSES.find((s) => s.toLowerCase() === rawStatus.toLowerCase()) ?? 'New';

    const lead: NewLeadInput = {
      fullName,
      email,
      company: cell(row, 'company'),
      phone: cell(row, 'phone'),
      industry: cell(row, 'industry') || 'Other',
      status,
      roleTitle: cell(row, 'roleTitle') || undefined,
    };

    const key = email.toLowerCase();
    let issue: ImportIssue | null = null;
    if (!fullName) issue = 'missing_name';
    else if (!isValidEmail(email)) issue = 'invalid_email';
    else if (existing.has(key)) issue = 'duplicate_existing';
    else if (seen.has(key)) issue = 'duplicate_in_file';
    if (isValidEmail(email)) seen.add(key);

    return { line: i + (table.hasHeader ? 2 : 1), lead, issue };
  });
}
