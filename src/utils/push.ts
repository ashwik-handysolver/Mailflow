import { supabase } from '../lib/supabase';

/**
 * Browser push notifications. The device subscribes with the server's VAPID
 * key and the subscription is saved to Supabase; the "push" Edge Function
 * sends follow-up reminders to it once a day.
 */
export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js');
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (!supabase) return 'unavailable';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Asks for permission, subscribes this device and saves it. Throws with a readable message on failure. */
export async function enablePush(): Promise<void> {
  if (!supabase) throw new Error('Push notifications need Supabase to be configured.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site. Allow them in your browser settings.'
        : 'Permission was not granted.'
    );
  }
  const { data, error } = await supabase.functions.invoke<{ publicKey: string }>('push', { method: 'GET' });
  if (error || !data?.publicKey) throw new Error("Couldn't reach the notification service.");

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.publicKey) }));
  const json = sub.toJSON();
  const { error: saveError } = await supabase.from('push_subscriptions').upsert(
    { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    { onConflict: 'endpoint' }
  );
  if (saveError) {
    await sub.unsubscribe().catch(() => undefined);
    throw new Error("Couldn't save this device for notifications.");
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/** Sends a test notification to all of the signed-in user's devices. */
export async function sendTestPush(): Promise<number> {
  if (!supabase) throw new Error('Push notifications need Supabase to be configured.');
  const { data, error } = await supabase.functions.invoke<{ sent: number }>('push', { body: { action: 'test' } });
  if (error) throw new Error("Couldn't send the test notification.");
  return data?.sent ?? 0;
}
