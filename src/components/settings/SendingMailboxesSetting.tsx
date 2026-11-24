import { FormEvent, useId, useState } from 'react';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { SkeletonRows } from '../ui/Feedback';
import {
  addMailbox,
  removeMailbox,
  SendingMailbox,
  setMailboxPassword,
  testMailbox,
  updateMailbox,
  useMailboxes,
} from '../../utils/mailboxes';
import { isValidEmail } from '../../utils/leadHelpers';
import { checkBouncesNow, refreshDeliveryEvents } from '../../utils/deliveryEvents';
import { formatRelativeTime } from '../../utils/analytics';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { ConfirmDialog } from '../ui/Overlay';

const STATUS: Record<SendingMailbox['status'], { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'neutral' },
  error: { label: 'Needs attention', tone: 'danger' },
};

/** Gmail / Google Workspace mailboxes campaigns are sent from. Changes apply immediately. */
export function SendingMailboxesSetting() {
  const { mailboxes, error, refresh } = useMailboxes();
  const { addToast, applyDeliveryEvents } = useWorkspace();
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkNow = async () => {
    setChecking(true);
    try {
      const { bounced, errors } = await checkBouncesNow();
      applyDeliveryEvents(await refreshDeliveryEvents());
      await refresh();
      if (errors.length > 0) addToast({ type: 'error', title: "Couldn't check every inbox", description: errors.join(' ') });
      else
        addToast({
          type: bounced > 0 ? 'warning' : 'success',
          title: bounced > 0 ? `${bounced} new ${bounced === 1 ? 'bounce' : 'bounces'} found` : 'No new bounces',
        });
    } catch (e) {
      addToast({ type: 'error', title: (e as Error).message });
    } finally {
      setChecking(false);
    }
  };

  if (mailboxes === null) return <SkeletonRows rows={2} height="h-14" />;

  return (
    <div className="space-y-3">
      {error && <p className="text-ui text-danger">{error}</p>}
      {mailboxes.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {mailboxes.map((m) => (
            <MailboxRow key={m.id} mailbox={m} onChanged={refresh} />
          ))}
        </ul>
      )}
      {mailboxes.length === 0 && !adding && (
        <p className="text-ui text-ink-3">
          No mailbox connected, so campaigns run in simulation mode. Connect a Gmail or Google Workspace mailbox to send
          real emails.
        </p>
      )}
      {mailboxes.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button size="sm" variant="ghost" loading={checking} onClick={() => void checkNow()}>
            Check for bounces now
          </Button>
          <span className="text-xs text-ink-3">
            Bounce notices in these inboxes are checked automatically every 15 minutes.
          </span>
        </div>
      )}
      {adding ? (
        <AddMailboxForm
          onCancel={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      ) : (
        <Button leadingIcon={<Plus />} onClick={() => setAdding(true)}>
          Add mailbox
        </Button>
      )}
    </div>
  );
}

function MailboxRow({ mailbox: m, onChanged }: { mailbox: SendingMailbox; onChanged: () => Promise<void> }) {
  const { addToast } = useWorkspace();
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'' | 'test' | 'toggle' | 'save' | 'remove'>('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [displayName, setDisplayName] = useState(m.display_name);
  const [replyTo, setReplyTo] = useState(m.reply_to ?? '');
  const [limit, setLimit] = useState(String(m.daily_limit));
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const status = STATUS[m.status];

  const run = async (kind: typeof busy, work: () => Promise<void>) => {
    setBusy(kind);
    try {
      await work();
    } catch (e) {
      addToast({ type: 'error', title: (e as Error).message || 'Something went wrong' });
    } finally {
      setBusy('');
    }
  };

  const test = () =>
    run('test', async () => {
      const problem = await testMailbox(m.id);
      await onChanged();
      addToast(
        problem
          ? { type: 'error', title: `${m.email} couldn't sign in`, description: problem }
          : { type: 'success', title: `${m.email} is working` }
      );
    });

  const toggle = () =>
    run('toggle', async () => {
      await updateMailbox(m.id, { status: m.status === 'paused' ? 'active' : 'paused' });
      await onChanged();
    });

  const save = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 2000) return setFormError('Daily limit must be between 1 and 2000.');
    if (replyTo.trim() && !isValidEmail(replyTo)) return setFormError('Enter a valid reply-to address.');
    setFormError('');
    void run('save', async () => {
      await updateMailbox(m.id, {
        display_name: displayName.trim(),
        reply_to: replyTo.trim() ? replyTo.trim().toLowerCase() : null,
        daily_limit: n,
      });
      if (password.trim()) await setMailboxPassword(m.id, password);
      setPassword('');
      setEditing(false);
      await onChanged();
      addToast({ type: 'success', title: 'Mailbox updated' });
    });
  };

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{m.email}</p>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-ui text-ink-3">
            {m.display_name ? `Sends as "${m.display_name}" · ` : ''}
            <span className="tabular-nums">
              {m.sentToday} of {m.daily_limit}
            </span>{' '}
            sent today{m.reply_to ? ` · Replies to ${m.reply_to}` : ''}
          </p>
          {m.status !== 'active' && m.last_error && <p className="mt-1 text-ui text-danger">{m.last_error}</p>}
          {m.last_bounce_check_error ? (
            <p className="mt-1 text-xs text-danger">{m.last_bounce_check_error}</p>
          ) : m.last_bounce_check_at ? (
            <p className="mt-1 text-xs text-ink-3">Bounces last checked {formatRelativeTime(m.last_bounce_check_at)}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="ghost" loading={busy === 'test'} onClick={() => void test()}>
            Test
          </Button>
          {m.status !== 'error' && (
            <Button size="sm" variant="ghost" loading={busy === 'toggle'} onClick={() => void toggle()}>
              {m.status === 'paused' ? 'Resume' : 'Pause'}
            </Button>
          )}
          <Button size="sm" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? 'Close' : 'Edit'}
          </Button>
        </div>
      </div>

      {editing && (
        <form onSubmit={save} noValidate className="mt-4 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <Field label="Display name" htmlFor={`${uid}-name`}>
            <Input id={`${uid}-name`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Daily limit" htmlFor={`${uid}-limit`} hint="Emails per day from this mailbox.">
            <Input
              id={`${uid}-limit`}
              type="number"
              min={1}
              max={2000}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </Field>
          <Field label="Reply-to (optional)" htmlFor={`${uid}-reply`}>
            <Input
              id={`${uid}-reply`}
              type="email"
              placeholder="sales@yourcompany.com"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
            />
          </Field>
          <Field label="New app password (optional)" htmlFor={`${uid}-pw`} hint="Only if you created a new one.">
            <PasswordInput id={`${uid}-pw`} value={password} onChange={setPassword} />
          </Field>
          {formError && <p className="text-ui text-danger sm:col-span-2">{formError}</p>}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" loading={busy === 'save'}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" variant="ghost" className="ml-auto text-danger" onClick={() => setConfirmRemove(true)}>
              Remove mailbox
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${m.email}?`}
        description="MailFlow stops sending from it and deletes its stored app password. Sent-email history is kept."
        confirmLabel="Remove"
        destructive
        loading={busy === 'remove'}
        onConfirm={() =>
          void run('remove', async () => {
            await removeMailbox(m.id);
            setConfirmRemove(false);
            await onChanged();
          })
        }
        onCancel={() => setConfirmRemove(false)}
      />
    </li>
  );
}

function AddMailboxForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: () => Promise<void> }) {
  const { addToast } = useWorkspace();
  const uid = useId();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [limit, setLimit] = useState('50');
  const [replyTo, setReplyTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(limit);
    if (!isValidEmail(email)) return setError('Enter the mailbox address, e.g. alex@yourcompany.com.');
    if (password.replace(/\s+/g, '').length < 16) return setError('Paste the 16-character app password from Google.');
    if (!Number.isInteger(n) || n < 1 || n > 2000) return setError('Daily limit must be between 1 and 2000.');
    if (replyTo.trim() && !isValidEmail(replyTo)) return setError('Enter a valid reply-to address.');
    setBusy(true);
    setError('');
    try {
      const { mailbox } = await addMailbox({
        email: email.trim(),
        displayName: displayName.trim(),
        password,
        dailyLimit: n,
        replyTo: replyTo.trim() || undefined,
      });
      setPassword('');
      addToast({ type: 'success', title: `${mailbox.email} connected`, description: 'Campaigns now send real emails.' });
      await onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-lg border border-line p-4">
      <div>
        <p className="text-sm font-medium text-ink">Connect a Gmail or Google Workspace mailbox</p>
        <p className="mt-0.5 text-ui text-ink-3">
          Use an{' '}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-ink underline underline-offset-2"
          >
            app password
          </a>
          , not the account password. MailFlow checks it with Google, then stores it encrypted. It's never shown again.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mailbox address" htmlFor={`${uid}-email`} required>
          <Input
            id={`${uid}-email`}
            type="email"
            autoComplete="off"
            placeholder="alex@yourcompany.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Display name" htmlFor={`${uid}-name`} hint="Shown in the recipient's inbox.">
          <Input
            id={`${uid}-name`}
            placeholder="Alex from YourCompany"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field label="App password" htmlFor={`${uid}-pw`} required>
          <PasswordInput id={`${uid}-pw`} value={password} onChange={setPassword} />
        </Field>
        <Field label="Daily limit" htmlFor={`${uid}-limit`} hint="Start low (20–50) for a new mailbox.">
          <Input id={`${uid}-limit`} type="number" min={1} max={2000} value={limit} onChange={(e) => setLimit(e.target.value)} />
        </Field>
        <Field label="Reply-to (optional)" htmlFor={`${uid}-reply`} className="sm:col-span-2">
          <Input
            id={`${uid}-reply`}
            type="email"
            placeholder="Leave empty to get replies in this mailbox"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
          />
        </Field>
      </div>
      {error && (
        <p className="text-ui text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={busy}>
          {busy ? 'Checking with Google…' : 'Connect mailbox'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <Input
      id={id}
      type={show ? 'text' : 'password'}
      autoComplete="new-password"
      placeholder="xxxx xxxx xxxx xxxx"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      trailing={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide app password' : 'Show app password'}
          aria-pressed={show}
          className="flex size-7 items-center justify-center rounded text-ink-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}
