import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setRealSending } from '../services/emailProvider';

/** A connected sending mailbox. The app password is never part of this. */
export interface SendingMailbox {
  id: string;
  email: string;
  display_name: string;
  reply_to: string | null;
  daily_limit: number;
  status: 'active' | 'paused' | 'error';
  last_error: string | null;
  last_tested_at: string | null;
  created_at: string;
  last_bounce_check_at: string | null;
  last_bounce_check_error: string | null;
  /** Emails sent from it since 00:00 UTC. */
  sentToday: number;
}

const COLUMNS =
  'id, email, display_name, reply_to, daily_limit, status, last_error, last_tested_at, created_at, last_bounce_check_at, last_bounce_check_error';

function startOfUtcDay(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function listMailboxes(): Promise<SendingMailbox[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('sending_mailboxes').select(COLUMNS).order('created_at');
  if (error) throw error;
  const boxes = (data ?? []) as Omit<SendingMailbox, 'sentToday'>[];
  const counts = new Map<string, number>();
  if (boxes.length > 0) {
    const { data: sent } = await supabase
      .from('outbound_emails')
      .select('mailbox_id')
      .eq('status', 'Sent')
      .gte('sent_at', startOfUtcDay());
    for (const r of sent ?? []) counts.set(r.mailbox_id, (counts.get(r.mailbox_id) ?? 0) + 1);
  }
  return boxes.map((b) => ({ ...b, sentToday: counts.get(b.id) ?? 0 }));
}

/** Points the app at real sending when at least one mailbox is active. */
export function applyMailboxes(boxes: SendingMailbox[]) {
  const active = boxes.filter((b) => b.status === 'active').map((b) => b.email);
  setRealSending(active.length > 0 ? active : null);
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Sending mailboxes need a Supabase connection.');
  const { data, error } = await supabase.functions.invoke('mailboxes', { body });
  if (error) {
    // The function returns { error } with a 4xx status; surface that message.
    const ctx = (error as { context?: Response }).context;
    const payload = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(payload?.error ?? "Couldn't reach the mailbox service.");
  }
  if (data?.error && data?.ok !== true) throw new Error(data.error);
  return data as T;
}

export function addMailbox(input: {
  email: string;
  displayName: string;
  password: string;
  dailyLimit: number;
  replyTo?: string;
}) {
  return call<{ mailbox: SendingMailbox }>({ action: 'add', ...input });
}

/** Logs in to Gmail with the stored password. Resolves with an error message, or null when it works. */
export async function testMailbox(id: string): Promise<string | null> {
  if (!supabase) return 'Sending mailboxes need a Supabase connection.';
  const { data, error } = await supabase.functions.invoke('mailboxes', { body: { action: 'test', id } });
  if (error) return "Couldn't reach the mailbox service.";
  return data?.ok ? null : data?.error ?? 'Test failed.';
}

export function setMailboxPassword(id: string, password: string) {
  return call<{ ok: true }>({ action: 'set-password', id, password });
}

export async function updateMailbox(
  id: string,
  patch: Partial<Pick<SendingMailbox, 'display_name' | 'reply_to' | 'daily_limit' | 'status'>>
) {
  if (!supabase) return;
  const { error } = await supabase.from('sending_mailboxes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function removeMailbox(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from('sending_mailboxes').delete().eq('id', id);
  if (error) throw error;
}

/** Loads mailboxes once and keeps the app's sending mode in step with them. */
export function useMailboxes() {
  const [mailboxes, setMailboxes] = useState<SendingMailbox[] | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const boxes = await listMailboxes();
      setMailboxes(boxes);
      applyMailboxes(boxes);
      setError('');
    } catch {
      setError("Couldn't load your sending mailboxes.");
      setMailboxes((m) => m ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { mailboxes, error, refresh };
}
