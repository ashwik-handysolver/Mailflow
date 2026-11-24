import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';

/**
 * What happened to each real email after it was sent, as recorded by the
 * server: bounces found by the bounce checker, and opens from the tracking
 * pixel. Polled while the app is open; components subscribe with
 * useDeliveryEvents().
 */
export interface DeliveryEvent {
  id: string;
  campaign_id: string | null;
  lead_id: string | null;
  mailbox_id: string | null;
  to_email: string;
  status: 'Pending' | 'Sent' | 'Failed' | 'Bounced';
  error: string | null;
  bounce_type: 'hard' | 'soft' | null;
  bounce_reason: string | null;
  bounced_at: string | null;
  open_tracked: boolean;
  opened_at: string | null;
  open_count: number;
  sent_at: string;
}

const LOOKBACK_DAYS = 90;
let events: DeliveryEvent[] = [];
/** idle: never fetched (or no Supabase) · loading · ready · error */
export type DeliveryEventsStatus = 'idle' | 'loading' | 'ready' | 'error';
let status: DeliveryEventsStatus = 'idle';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export async function refreshDeliveryEvents(): Promise<DeliveryEvent[]> {
  if (!supabase) return events;
  if (status !== 'ready') {
    status = 'loading';
    notify();
  }
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('outbound_emails')
    .select(
      'id, campaign_id, lead_id, mailbox_id, to_email, status, error, bounce_type, bounce_reason, bounced_at, open_tracked, opened_at, open_count, sent_at'
    )
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(5000);
  if (error) {
    status = 'error';
    notify();
    return events;
  }
  events = (data ?? []) as DeliveryEvent[];
  status = 'ready';
  notify();
  return events;
}

export function clearDeliveryEvents() {
  events = [];
  status = 'idle';
  notify();
}

/** Fetch status, so screens can show loading and error states. */
export function useDeliveryEventsStatus(): DeliveryEventsStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status
  );
}

export function useDeliveryEvents(): DeliveryEvent[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => events
  );
}

/** Asks the server to check the mailboxes for bounces now (instead of waiting up to 15 minutes). */
export async function checkBouncesNow(): Promise<{ bounced: number; errors: string[] }> {
  if (!supabase) return { bounced: 0, errors: [] };
  const { data, error } = await supabase.functions.invoke<{
    results: { mailbox: string; bounced?: number; error?: string }[];
  }>('check-bounces', { body: {} });
  if (error) throw new Error("Couldn't reach the bounce checker.");
  const results = data?.results ?? [];
  await refreshDeliveryEvents();
  return {
    bounced: results.reduce((n, r) => n + (r.bounced ?? 0), 0),
    errors: results.filter((r) => r.error).map((r) => `${r.mailbox}: ${r.error}`),
  };
}
