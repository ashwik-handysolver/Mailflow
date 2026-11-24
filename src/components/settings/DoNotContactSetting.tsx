import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../app/WorkspaceContext';
import { isValidEmail } from '../../utils/leadHelpers';
import { formatShortDate } from '../../utils/analytics';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Field';
import { SkeletonRows } from '../ui/Feedback';

interface Suppression {
  email: string;
  reason: string;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = {
  unsubscribed: 'Unsubscribed',
  'replied unsubscribe': 'Replied "unsubscribe"',
  manual: 'Added manually',
  bounced: 'Bounced',
};

/**
 * Addresses MailFlow will never email. The server checks this list before every
 * send. Add people here when they reply "unsubscribe"; one-click unsubscribes
 * from Gmail's button are added automatically.
 */
export function DoNotContactSetting() {
  const { addToast } = useWorkspace();
  const uid = useId();
  const [items, setItems] = useState<Suppression[] | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return setItems([]);
    const { data, error: err } = await supabase
      .from('suppressions')
      .select('email, reason, created_at')
      .order('created_at', { ascending: false });
    if (err) {
      setError("Couldn't load the do-not-contact list.");
      setItems([]);
    } else setItems(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const address = email.trim().toLowerCase();
    if (!isValidEmail(address)) return setError('Enter a valid email address.');
    setBusy(true);
    setError('');
    const { error: err } = await supabase
      .from('suppressions')
      .upsert({ email: address, reason: 'replied unsubscribe' }, { onConflict: 'user_id,email', ignoreDuplicates: true });
    setBusy(false);
    if (err) return setError("Couldn't add that address.");
    setEmail('');
    addToast({ type: 'success', title: `${address} won't be emailed again` });
    await load();
  };

  const remove = async (address: string) => {
    if (!supabase) return;
    const { error: err } = await supabase.from('suppressions').delete().eq('email', address);
    if (err) return addToast({ type: 'error', title: "Couldn't remove that address" });
    addToast({ type: 'info', title: `${address} can be emailed again` });
    await load();
  };

  return (
    <div className="space-y-3">
      <form onSubmit={add} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <label htmlFor={`${uid}-email`} className="sr-only">
          Email address to stop contacting
        </label>
        <Input
          id={`${uid}-email`}
          type="email"
          placeholder="name@company.com"
          value={email}
          invalid={Boolean(error)}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          className="sm:max-w-[320px]"
        />
        <Button type="submit" loading={busy}>
          Add to list
        </Button>
      </form>
      {error && (
        <p className="text-ui text-danger" role="alert">
          {error}
        </p>
      )}

      {items === null ? (
        <SkeletonRows rows={3} height="h-9" />
      ) : items.length === 0 ? (
        <p className="text-ui text-ink-3">Nobody has opted out yet.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {items.map((s) => (
            <li key={s.email} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-ui text-ink">{s.email}</span>
              <span className="hidden text-xs text-ink-3 sm:inline">
                {REASON_LABEL[s.reason] ?? s.reason} · {formatShortDate(s.created_at)}
              </span>
              <IconButton
                size="sm"
                label={`Remove ${s.email} from the do-not-contact list`}
                onClick={() => void remove(s.email)}
              >
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
