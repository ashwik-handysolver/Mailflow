import { DailyMetricPoint, Lead, LeadStatus } from '../types/outreach';

export type LeadSortOption =
  | 'name_asc'
  | 'name_desc'
  | 'date_desc'
  | 'date_asc'
  | 'created_desc';

export interface LeadFilterParams {
  search: string;
  industry: string;
  status: LeadStatus | 'All';
  sort: LeadSortOption;
  /** Multi-select filters; when non-empty they take precedence over `industry`/`status`. */
  industries?: string[];
  statuses?: LeadStatus[];
}

export function filterAndSortLeads(
  leads: Lead[],
  params: LeadFilterParams
): Lead[] {
  const query = params.search.trim().toLowerCase();

  const filtered = leads.filter((lead) => {
    if (params.industries && params.industries.length > 0) {
      if (!params.industries.includes(lead.industry)) return false;
    } else if (params.industry !== 'All' && lead.industry !== params.industry) {
      return false;
    }
    if (params.statuses && params.statuses.length > 0) {
      if (!params.statuses.includes(lead.status)) return false;
    } else if (params.status !== 'All' && lead.status !== params.status) {
      return false;
    }
    if (!query) return true;
    return (
      lead.fullName.toLowerCase().includes(query) ||
      lead.company.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query)
    );
  });

  return [...filtered].sort((a, b) => {
    switch (params.sort) {
      case 'name_asc':
        return a.fullName.localeCompare(b.fullName);
      case 'name_desc':
        return b.fullName.localeCompare(a.fullName);
      case 'created_desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'date_asc': {
        const tA = a.lastContacted ? new Date(a.lastContacted).getTime() : 0;
        const tB = b.lastContacted ? new Date(b.lastContacted).getTime() : 0;
        return tA - tB;
      }
      case 'date_desc':
      default: {
        const tA = a.lastContacted ? new Date(a.lastContacted).getTime() : 0;
        const tB = b.lastContacted ? new Date(b.lastContacted).getTime() : 0;
        return tB - tA;
      }
    }
  });
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; totalPages: number; safePage: number } {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    totalPages,
    safePage,
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export interface CsvParseResult {
  validLeads: Omit<Lead, 'id' | 'createdAt' | 'lastContacted'>[];
  skippedRows: number;
  errors: string[];
}

const VALID_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Follow-up',
  'Converted',
  'Not Interested',
];

export function parseLeadsCsv(csvText: string): CsvParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { validLeads: [], skippedRows: 0, errors: ['CSV input is empty.'] };
  }

  const firstRow = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader =
    firstRow.some((h) => h.includes('name')) ||
    firstRow.some((h) => h.includes('email'));

  const headers = hasHeader
    ? firstRow
    : ['name', 'company', 'email', 'phone', 'industry', 'status'];
  const startIdx = hasHeader ? 1 : 0;

  const findCol = (candidates: string[]) =>
    headers.findIndex((h) => candidates.some((c) => h.includes(c)));

  const nameCol = findCol(['full name', 'fullname', 'name']);
  const companyCol = findCol(['company', 'organization', 'org']);
  const emailCol = findCol(['email', 'e-mail']);
  const phoneCol = findCol(['phone', 'contact', 'mobile', 'tel']);
  const industryCol = findCol(['industry', 'sector']);
  const statusCol = findCol(['status', 'stage']);

  const validLeads: Omit<Lead, 'id' | 'createdAt' | 'lastContacted'>[] = [];
  const errors: string[] = [];
  let skippedRows = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const fullName = (nameCol >= 0 ? cols[nameCol] : cols[0]) ?? '';
    const company = (companyCol >= 0 ? cols[companyCol] : cols[1]) ?? '';
    const email = (emailCol >= 0 ? cols[emailCol] : cols[2]) ?? '';
    const phone = (phoneCol >= 0 ? cols[phoneCol] : cols[3]) ?? '';
    const industry =
      ((industryCol >= 0 ? cols[industryCol] : cols[4]) ?? '').trim() ||
      'SaaS';
    const rawStatus =
      ((statusCol >= 0 ? cols[statusCol] : cols[5]) ?? '').trim() || 'New';

    const matchedStatus =
      VALID_STATUSES.find(
        (s) => s.toLowerCase() === rawStatus.toLowerCase()
      ) ?? 'New';

    if (!fullName.trim() || !isValidEmail(email)) {
      skippedRows++;
      errors.push(`Row ${i + 1}: missing valid name or email.`);
      continue;
    }

    validLeads.push({
      fullName: fullName.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      industry,
      status: matchedStatus,
    });
  }

  return { validLeads, skippedRows, errors };
}

export function sliceMetricsByRange(
  metrics: DailyMetricPoint[],
  days: 7 | 30 | 90
): DailyMetricPoint[] {
  if (metrics.length <= days) return metrics;
  return metrics.slice(metrics.length - days);
}

export function formatRelativeDate(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
