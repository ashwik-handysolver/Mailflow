import { useEffect, useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { disablePush, enablePush, getPushState, PushState, sendTestPush } from '../../utils/push';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Field';

const DESCRIPTION: Record<PushState, string> = {
  on: 'This device gets a daily reminder when follow-ups are due.',
  off: 'Get a daily reminder on this device when follow-ups are due, even with MailFlow closed.',
  denied: 'Notifications are blocked for this site. Allow them in your browser settings, then turn this on.',
  unsupported: "This browser doesn't support push notifications.",
  unavailable: 'Push notifications need a Supabase connection.',
};

/** Turns browser push on or off for this device. Applies immediately, outside the settings form. */
export function PushNotificationsSetting() {
  const { addToast } = useWorkspace();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getPushState().then(setState, () => setState('unsupported'));
  }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) await enablePush();
      else await disablePush();
      setState(await getPushState());
      addToast({ type: 'success', title: on ? 'Push notifications on' : 'Push notifications off' });
    } catch (e) {
      setState(await getPushState().catch(() => 'off' as const));
      addToast({ type: 'error', title: "Couldn't change notifications", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const sent = await sendTestPush();
      addToast(
        sent > 0
          ? { type: 'success', title: 'Test notification sent' }
          : { type: 'warning', title: 'No devices received it', description: 'Turn notifications off and on again.' }
      );
    } catch (e) {
      addToast({ type: 'error', title: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const current = state ?? 'off';
  return (
    <div className="divide-y divide-line rounded-lg border border-line">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <Switch
          checked={current === 'on'}
          disabled={state === null || busy || current === 'unsupported' || current === 'unavailable'}
          onChange={(v) => void toggle(v)}
          label="Push notifications"
          description={DESCRIPTION[current]}
        />
        {current === 'on' && (
          <Button size="sm" onClick={() => void test()} loading={testing} className="shrink-0">
            Send test
          </Button>
        )}
      </div>
    </div>
  );
}
