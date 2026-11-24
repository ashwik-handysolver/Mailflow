import { DragEvent, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  buildImportRows,
  ColumnMapping,
  CsvTable,
  guessColumnMapping,
  IMPORT_FIELDS,
  ImportField,
  ImportIssue,
  ISSUE_LABELS,
  NewLeadInput,
  parseCsvTable,
} from '../../utils/csvImport';
import { Dialog } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Checkbox, Select, Textarea } from '../ui/Field';
import { Badge } from '../ui/Badge';
import { Callout } from '../ui/Misc';
import { cn } from '../../lib/cn';

const SAMPLE_CSV = `Full Name,Company,Email,Phone,Industry,Status
Lucas Meyer,VectorFlow,lucas@vectorflow.io,+1 (415) 902-1184,SaaS,New
Amelia Grant,Harbor FinTech,amelia@harborfin.com,+1 (212) 488-7730,FinTech,Interested
Noah Takahashi,Kanso Logistics,noah@kansologistics.jp,,Logistics,Follow-up`;

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Step = 'upload' | 'map' | 'review';

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  existingEmails: string[];
  /** Returns how many leads were actually added. */
  onImport: (leads: NewLeadInput[]) => number;
}

export function CsvImportDialog(props: CsvImportDialogProps) {
  // Remount on each open so every import starts clean.
  return props.open ? <CsvImportFlow {...props} /> : null;
}

function CsvImportFlow({ onClose, existingEmails, onImport }: CsvImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadText = (text: string, name: string | null) => {
    const parsed = parseCsvTable(text);
    if (parsed.rows.length === 0) {
      setError(
        parsed.headers.length > 0
          ? 'The file only contains a header row. Add at least one lead.'
          : 'No rows found. Check that the file is a comma-separated CSV.'
      );
      return;
    }
    setError(null);
    setFileName(name);
    setTable(parsed);
    setMapping(guessColumnMapping(parsed));
    setStep('map');
  };

  const readFile = (file: File) => {
    if (!/\.(csv|txt|tsv)$/i.test(file.name) && file.type && !file.type.includes('csv') && !file.type.startsWith('text/')) {
      setError('Upload a .csv file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('This file is larger than 2 MB. Split it into smaller files.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && loadText(reader.result, file.name);
    reader.onerror = () => setError('The file could not be read. Try again.');
    reader.readAsText(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const rows = useMemo(
    () => (table && mapping ? buildImportRows(table, mapping, existingEmails) : []),
    [table, mapping, existingEmails]
  );

  const counts = useMemo(() => {
    const c: Record<ImportIssue | 'ok', number> = {
      ok: 0,
      missing_name: 0,
      invalid_email: 0,
      duplicate_existing: 0,
      duplicate_in_file: 0,
    };
    rows.forEach((r) => (c[r.issue ?? 'ok'] += 1));
    return c;
  }, [rows]);

  const duplicates = counts.duplicate_existing + counts.duplicate_in_file;
  const importable = rows.filter(
    (r) => r.issue === null || (!skipDuplicates && r.issue === 'duplicate_existing')
  );
  const mappingInvalid =
    !mapping || mapping.email < 0 || (mapping.fullName < 0 && mapping.firstName < 0 && mapping.lastName < 0);

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mailflow-leads-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    const added = onImport(importable.map((r) => r.lead));
    setResult({ imported: added, skipped: rows.length - added });
  };

  const title = result ? 'Import complete' : 'Import leads';
  const stepLabel = { upload: 'Step 1 of 3 · Upload', map: 'Step 2 of 3 · Match columns', review: 'Step 3 of 3 · Review' }[step];

  let footer: React.ReactNode;
  if (result) {
    footer = (
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    );
  } else if (step === 'upload') {
    footer = <Button onClick={onClose}>Cancel</Button>;
  } else if (step === 'map') {
    footer = (
      <>
        <Button className="mr-auto" onClick={() => setStep('upload')}>
          Back
        </Button>
        <Button variant="primary" disabled={mappingInvalid} onClick={() => setStep('review')}>
          Review {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        <Button className="mr-auto" onClick={() => setStep('map')}>
          Back
        </Button>
        <Button variant="primary" disabled={importable.length === 0} onClick={doImport}>
          Import {importable.length} {importable.length === 1 ? 'lead' : 'leads'}
        </Button>
      </>
    );
  }

  return (
    <Dialog open onClose={onClose} title={title} description={result ? undefined : stepLabel} size="lg" footer={footer}>
      {result ? (
        <div className="flex flex-col items-center py-6 text-center">
          <CheckCircle2 className="size-6 text-success" />
          <p className="mt-3 text-heading font-semibold text-ink">
            {result.imported} {result.imported === 1 ? 'lead' : 'leads'} added
          </p>
          <p className="mt-1 text-ui text-ink-3">
            {result.skipped > 0
              ? `${result.skipped} ${result.skipped === 1 ? 'row was' : 'rows were'} skipped because of missing data or duplicates.`
              : 'Every row was imported.'}
          </p>
        </div>
      ) : step === 'upload' ? (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center rounded-lg border border-dashed px-6 py-6 text-center transition-colors',
              dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-canvas'
            )}
          >
            <p className="text-sm font-medium text-ink">Drop a CSV file here</p>
            <p className="mt-0.5 text-ui text-ink-3">Up to 2 MB. Any column order — you'll match columns next.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </Button>
              <Button size="sm" onClick={downloadSample}>
                Sample CSV
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="sr-only"
              aria-label="Choose CSV file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
                e.target.value = '';
              }}
            />
          </div>

          <details className="group rounded-lg border border-line">
            <summary className="flex items-center justify-between px-3.5 py-2.5 text-ui font-medium text-ink list-none">
              Or paste CSV text
              <span className="text-xs font-normal text-ink-3 group-open:hidden">Expand</span>
            </summary>
            <div className="space-y-2 border-t border-line p-3.5">
              <Textarea
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={SAMPLE_CSV}
                className="font-mono text-xs"
                aria-label="CSV text"
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={!rawText.trim()} onClick={() => loadText(rawText, null)}>
                  Continue with pasted text
                </Button>
              </div>
            </div>
          </details>

          {error && (
            <Callout tone="danger" icon={<AlertTriangle />}>
              {error}
            </Callout>
          )}
        </div>
      ) : step === 'map' && table && mapping ? (
        <div className="space-y-4">
          <p className="text-ui text-ink-2">
            {fileName ? (
              <>
                <span className="font-medium text-ink">{fileName}</span> ·{' '}
              </>
            ) : null}
            {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}, {table.headers.length} columns
            {!table.hasHeader && ' · no header row detected'}
          </p>
          <div className="divide-y divide-line rounded-lg border border-line">
            {IMPORT_FIELDS.filter((field) => {
              if (showAllFields || mapping[field.key] >= 0 || field.key === 'email') return true;
              // Full name is required unless first/last name are matched.
              return field.key === 'fullName' && mapping.firstName < 0 && mapping.lastName < 0;
            }).map((field) => {
              const idx = mapping[field.key];
              const sample = idx >= 0 ? table.rows.find((r) => (r[idx] ?? '').trim())?.[idx] : undefined;
              return (
                <div key={field.key} className="grid grid-cols-1 gap-2 px-3.5 py-2.5 sm:grid-cols-[150px_1fr_1fr] sm:items-center">
                  <div>
                    <p className="text-ui font-medium text-ink">{field.label}</p>
                    {field.hint && <p className="text-xs text-ink-3">{field.hint}</p>}
                  </div>
                  <Select
                    selectSize="sm"
                    aria-label={`Column for ${field.label}`}
                    value={idx}
                    invalid={field.key === 'email' && idx < 0}
                    onChange={(e) =>
                      setMapping((m) => (m ? { ...m, [field.key as ImportField]: Number(e.target.value) } : m))
                    }
                  >
                    <option value={-1}>Don't import</option>
                    {table.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </Select>
                  <p className="truncate text-xs text-ink-3" title={sample}>
                    {sample ? <>e.g. <span className="text-ink-2">{sample}</span></> : '—'}
                  </p>
                </div>
              );
            })}
          </div>
          {!showAllFields && (
            <Button variant="link" size="sm" onClick={() => setShowAllFields(true)}>
              Show all fields
            </Button>
          )}
          {mappingInvalid && (
            <Callout tone="warning" icon={<AlertTriangle />}>
              Match a column to <strong>Email</strong> and to <strong>Full name</strong> (or first/last name) to continue.
            </Callout>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success" dot>
              {counts.ok} ready
            </Badge>
            {duplicates > 0 && (
              <Badge tone="warning" dot>
                {duplicates} {duplicates === 1 ? 'duplicate' : 'duplicates'}
              </Badge>
            )}
            {counts.invalid_email + counts.missing_name > 0 && (
              <Badge tone="danger" dot>
                {counts.invalid_email + counts.missing_name} invalid
              </Badge>
            )}
          </div>

          {counts.duplicate_existing > 0 && (
            <label className="flex items-start gap-2.5 rounded-lg border border-line px-3.5 py-2.5 text-ui">
              <Checkbox checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} className="mt-0.5" />
              <span>
                <span className="font-medium text-ink">Skip leads that already exist</span>
                <span className="block text-ink-3">
                  {counts.duplicate_existing} {counts.duplicate_existing === 1 ? 'row matches' : 'rows match'} an existing email.
                  Unchecked, they're added as separate leads.
                </span>
              </span>
            </label>
          )}

          <div className="max-h-[320px] overflow-auto scrollbar-thin rounded-lg border border-line">
            <table className="w-full text-ui">
              <thead className="sticky top-0 bg-canvas">
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th scope="col" className="px-3 py-2 font-medium w-14">Row</th>
                  <th scope="col" className="px-3 py-2 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium">Email</th>
                  <th scope="col" className="hidden sm:table-cell px-3 py-2 font-medium">Company</th>
                  <th scope="col" className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const willImport = importable.includes(r);
                  return (
                    <tr key={r.line} className={cn(!willImport && 'text-ink-3')}>
                      <td className="px-3 py-2 tabular-nums text-ink-3">{r.line}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate">{r.lead.fullName || '—'}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{r.lead.email || '—'}</td>
                      <td className="hidden sm:table-cell px-3 py-2 max-w-[140px] truncate">{r.lead.company || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {willImport ? (
                          <Badge tone="success">Import</Badge>
                        ) : (
                          <Badge tone={r.issue?.startsWith('duplicate') ? 'warning' : 'danger'}>
                            {r.issue ? ISSUE_LABELS[r.issue] : 'Skip'}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  );
}
