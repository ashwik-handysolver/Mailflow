import { KeyboardEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigation, useWorkspace } from '../../app/WorkspaceContext';
import { useDeliveryEvents } from '../../utils/deliveryEvents';
import { buildEmailLog, friendlyReason } from '../../utils/emailLog';
import { EmailStateBadge, formatWhen } from '../campaigns/EmailList';
import { Check, Copy, MoreHorizontal, Trash2, X } from 'lucide-react';
import { EmailActivityRecord, Lead, LeadStatus } from '../../types/outreach';
import { isValidEmail } from '../../utils/leadHelpers';
import { formatRelativeTime } from '../../utils/analytics';
import { Drawer } from '../ui/Overlay';
import { Button, IconButton } from '../ui/Button';
import { Textarea } from '../ui/Field';
import { Menu } from '../ui/Menu';
import { Dropdown } from '../ui/Dropdown';
import { cn } from '../../lib/cn';
import { industryOptions, STATUS_OPTIONS } from './LeadForm';

type EditableField = 'fullName' | 'email' | 'phone' | 'company' | 'roleTitle' | 'industry' | 'notes';

interface LeadDetailDrawerProps {
  lead: Lead | null;
  emailHistory: EmailActivityRecord[];
  industries: string[];
  /** Emails used by other leads (lower-cased). */
  takenEmails: Set<string>;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Pick<Lead, EditableField | 'status'>>) => void;
  onDelete: (lead: Lead) => void;
  onCompose: (lead: Lead) => void;
}

export function LeadDetailDrawer(props: LeadDetailDrawerProps) {
  const { lead, onClose } = props;
  return (
    <Drawer open={Boolean(lead)} onClose={onClose} label={lead ? `Lead: ${lead.fullName}` : 'Lead'}>
      {lead && <DrawerBody key={lead.id} {...props} lead={lead} />}
    </Drawer>
  );
}

function DrawerBody({
  lead,
  emailHistory,
  industries,
  takenEmails,
  onClose,
  onUpdate,
  onDelete,
  onCompose,
}: LeadDetailDrawerProps & { lead: Lead }) {
  const uid = useId();
  const save = (field: EditableField) => (value: string) => onUpdate(lead.id, { [field]: value });

  return (
    <>
      <div className="flex items-start gap-2 border-b border-line px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <InlineEdit
            label="Name"
            value={lead.fullName}
            onSave={save('fullName')}
            validate={(v) => (v.trim() ? null : 'Name is required.')}
            displayClassName="text-heading font-semibold text-ink"
            inputClassName="text-heading font-semibold"
          />
          <p className="truncate px-1.5 text-ui text-ink-3">
            {[lead.roleTitle, lead.company].filter(Boolean).join(' · ') || 'No company'}
          </p>
        </div>
        <Menu
          items={[{ label: 'Delete lead', icon: <Trash2 />, destructive: true, onSelect: () => onDelete(lead) }]}
          trigger={(p) => (
            <IconButton label="More actions" size="sm" {...p}>
              <MoreHorizontal />
            </IconButton>
          )}
        />
        <IconButton label="Close" size="sm" onClick={onClose}>
          <X />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Button variant="primary" size="sm" onClick={() => onCompose(lead)}>
            Send email
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor={`${uid}-status`} className="text-ui text-ink-3">
              Status
            </label>
            <div className="w-[160px]">
              <Dropdown
                id={`${uid}-status`}
                label="Status"
                size="sm"
                value={lead.status}
                options={STATUS_OPTIONS}
                onChange={(status: LeadStatus) => onUpdate(lead.id, { status })}
              />
            </div>
          </div>
        </div>

        <section className="px-5 py-4">
          <h3 className="mb-1 text-xs font-medium text-ink-3">Details</h3>
          <dl>
            <FieldRow label="Email">
              <InlineEdit
                label="Email"
                type="email"
                value={lead.email}
                onSave={save('email')}
                copyable
                validate={(v) => {
                  if (!isValidEmail(v)) return 'Enter a valid email address.';
                  if (takenEmails.has(v.trim().toLowerCase())) return 'Another lead already uses this email.';
                  return null;
                }}
              />
            </FieldRow>
            <FieldRow label="Phone">
              <InlineEdit label="Phone" type="tel" value={lead.phone} onSave={save('phone')} copyable />
            </FieldRow>
            <FieldRow label="Company">
              <InlineEdit label="Company" value={lead.company} onSave={save('company')} />
            </FieldRow>
            <FieldRow label="Job title">
              <InlineEdit label="Job title" value={lead.roleTitle ?? ''} onSave={save('roleTitle')} />
            </FieldRow>
            <FieldRow label="Industry">
              <Dropdown
                appearance="inline"
                label="Industry"
                value={lead.industry || 'Other'}
                options={industryOptions([...industries, lead.industry]).map((i) => ({ value: i }))}
                onChange={save('industry')}
              />
            </FieldRow>
            <FieldRow label="Last contacted">
              <span className="px-1.5 text-ui text-ink" title={lead.lastContacted ? new Date(lead.lastContacted).toLocaleString() : undefined}>
                {lead.lastContacted ? formatRelativeTime(lead.lastContacted) : 'Never'}
              </span>
            </FieldRow>
          </dl>
        </section>

        <section className="border-t border-line px-5 py-4">
          <NoteBox value={lead.notes ?? ''} onSave={save('notes')} />
        </section>

        <LeadEmailHistory lead={lead} fallbackCount={emailHistory.length} />
      </div>
    </>
  );
}

/** Every email sent to this lead, with what happened to it. Click one to see it in its campaign. */
function LeadEmailHistory({ lead, fallbackCount }: { lead: Lead; fallbackCount: number }) {
  const { campaigns } = useWorkspace();
  const { navigate } = useNavigation();
  const events = useDeliveryEvents();
  const rows = useMemo(() => buildEmailLog(campaigns, events).filter((r) => r.leadId === lead.id), [campaigns, events, lead.id]);
  const count = rows.length || fallbackCount;
  return (
    <section className="border-t border-line px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-ink-3">
          Emails <span className="tabular-nums">({count})</span>
        </h3>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('campaigns', { emailSearch: lead.email })}
            className="text-xs font-medium text-accent hover:underline"
          >
            View in Campaigns
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-ui text-ink-3">No emails sent yet.</p>
      ) : (
        <ul className="-mx-2">
          {rows.map((row) => {
            const problem = row.state === 'bounced' || row.state === 'failed';
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => navigate('campaigns', { openCampaignId: row.campaignId })}
                  className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 truncate text-ui font-medium text-ink">{row.subject || '(no subject)'}</span>
                    <EmailStateBadge row={row} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {row.campaignName} · {formatWhen(row.sentAt)}
                    {row.openedAt && ` · Opened ${formatWhen(row.openedAt)}`}
                  </span>
                  {problem && (
                    <span className={cn('mt-0.5 block text-xs', row.state === 'failed' ? 'text-danger' : 'text-warning')}>
                      {friendlyReason(row.reason, row.state, row.bounceType)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <dt className="w-28 shrink-0 text-ui text-ink-3">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

interface InlineEditProps {
  label: string;
  value: string;
  onSave: (value: string) => void;
  validate?: (value: string) => string | null;
  type?: 'text' | 'email' | 'tel';
  copyable?: boolean;
  suggestions?: string[];
  displayClassName?: string;
  inputClassName?: string;
}

/** Click-to-edit value. Enter or blur saves, Escape cancels. */
function InlineEdit({
  label,
  value,
  onSave,
  validate,
  type = 'text',
  copyable,
  suggestions,
  displayClassName,
  inputClassName,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next === value.trim()) {
      setEditing(false);
      setError(null);
      return;
    }
    const problem = validate?.(next) ?? null;
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    onSave(next);
    setEditing(false);
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // keep the drawer open
      setDraft(value);
      setError(null);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div>
        <input
          ref={inputRef}
          type={type}
          aria-label={label}
          aria-invalid={Boolean(error) || undefined}
          value={draft}
          list={suggestions ? listId : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className={cn(
            'h-8 w-full rounded-md border bg-surface px-1.5 text-ui text-ink outline-none focus:ring-3',
            error ? 'border-danger focus:ring-danger/15' : 'border-accent focus:ring-accent/15',
            inputClassName
          )}
        />
        {suggestions && (
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        {error && (
          <p className="mt-1 px-1.5 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={`Edit ${label.toLowerCase()}`}
        className={cn(
          'min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-ui hover:bg-subtle',
          value ? 'text-ink' : 'text-ink-4',
          displayClassName
        )}
      >
        {value || `Add ${label.toLowerCase()}`}
      </button>
      {copyable && value && (
        <IconButton
          label={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}
          size="sm"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              // Clipboard unavailable; nothing to do.
            }
          }}
        >
          {copied ? <Check className="text-success" /> : <Copy />}
        </IconButton>
      )}
    </div>
  );
}

/** Always-visible notes field that saves when it loses focus. */
function NoteBox({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-ink-3">
          Notes
        </label>
        {saved && <span className="text-xs text-ink-3">Saved</span>}
      </div>
      <Textarea
        id={id}
        rows={3}
        value={draft}
        placeholder="Context from calls, meetings or research"
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          if (draft.trim() !== value.trim()) {
            onSave(draft.trim());
            setSaved(true);
          }
        }}
      />
    </div>
  );
}
