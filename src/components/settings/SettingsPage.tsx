import { ChangeEvent, FormEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { TeamSettings } from '../../types/outreach';
import { Camera, Monitor, Moon, Sun } from 'lucide-react';
import { ThemePreference, useTheme } from '../../utils/theme';
import { useWorkspace } from '../../app/WorkspaceContext';
import { cn } from '../../lib/cn';
import { isValidEmail } from '../../utils/leadHelpers';
import { useEmailProvider } from '../../services/emailProvider';
import { PageContainer, PageHeader } from '../layout/PageHeader';
import { Button } from '../ui/Button';
import { Field, Input, Switch } from '../ui/Field';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Misc';
import { PushNotificationsSetting } from './PushNotificationsSetting';
import { SendingMailboxesSetting } from './SendingMailboxesSetting';
import { DoNotContactSetting } from './DoNotContactSetting';
import { BrandSetting } from './BrandSetting';
import { RichTextEditor } from '../common/RichTextEditor';

export function SettingsPage() {
  const { settings, updateSettings } = useWorkspace();
  const emailProvider = useEmailProvider();
  const uid = useId();
  const [draft, setDraft] = useState<TeamSettings>(settings);
  const [errors, setErrors] = useState<Partial<Record<keyof TeamSettings, string>>>({});
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const set = <K extends keyof TeamSettings>(key: K, value: TeamSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!draft.userName.trim()) next.userName = 'Enter your name.';
    if (!draft.senderDisplayName.trim()) next.senderDisplayName = 'Enter a sender name.';
    if (!isValidEmail(draft.senderEmail)) next.senderEmail = 'Enter a valid email address.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    updateSettings({
      ...draft,
      userName: draft.userName.trim(),
      senderDisplayName: draft.senderDisplayName.trim(),
      senderEmail: draft.senderEmail.trim(),
    });
  };

  const id = (k: string) => `${uid}-${k}`;

  return (
    <PageContainer>
      <PageHeader title="Settings" />

      <div className="lg:grid lg:grid-cols-[180px_minmax(0,760px)] lg:gap-10">
      <SettingsNav />
      <div className="min-w-0">
      <form onSubmit={submit} noValidate className="space-y-16">
        <Section id="profile" title="Profile">
          <div className="mb-6 flex items-center gap-4">
            <div className="relative w-fit shrink-0">
              <Avatar name={draft.userName || '?'} src={draft.avatarDataUrl} size="lg" className="size-16! text-lg!" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={draft.avatarDataUrl ? 'Change profile photo' : 'Upload profile photo'}
                className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border-2 border-surface bg-ink text-canvas transition-colors hover:bg-ink-2 focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Camera className="size-3" />
              </button>
            </div>
            <div className="min-w-0">
              <p className="truncate text-heading font-semibold text-ink">{draft.userName || 'Your name'}</p>
              <p className="truncate text-ui text-ink-3">{draft.senderEmail}</p>
              {photoError && (
                <p className="mt-1 text-xs text-danger" role="alert">
                  {photoError}
                </p>
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setPhotoError('');
                  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setPhotoError('Choose a JPG, PNG or WebP image.');
                  if (file.size > 5 * 1024 * 1024) return setPhotoError('That image is over 5 MB.');
                  try {
                    set('avatarDataUrl', await toAvatarDataUrl(file));
                  } catch {
                    setPhotoError("Couldn't read that image.");
                  }
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor={id('userName')} required error={errors.userName}>
              <Input id={id('userName')} value={draft.userName} onChange={(e) => set('userName', e.target.value)} invalid={Boolean(errors.userName)} />
            </Field>
            <Field label="Role" htmlFor={id('userRole')}>
              <Input id={id('userRole')} value={draft.userRole} onChange={(e) => set('userRole', e.target.value)} />
            </Field>
            <Field label="Team" htmlFor={id('teamName')} className="sm:col-span-2">
              <Input id={id('teamName')} value={draft.teamName} onChange={(e) => set('teamName', e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section id="appearance" title="Appearance">
          <AppearanceSetting />
        </Section>

        <Section id="sender" title="Sender" description="Shown in the From line of every email">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Sender name" htmlFor={id('senderDisplayName')} required error={errors.senderDisplayName}>
              <Input
                id={id('senderDisplayName')}
                value={draft.senderDisplayName}
                onChange={(e) => set('senderDisplayName', e.target.value)}
                invalid={Boolean(errors.senderDisplayName)}
              />
            </Field>
            <Field label="Sender email" htmlFor={id('senderEmail')} required error={errors.senderEmail}>
              <Input
                id={id('senderEmail')}
                type="email"
                value={draft.senderEmail}
                onChange={(e) => set('senderEmail', e.target.value)}
                invalid={Boolean(errors.senderEmail)}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-ui font-medium text-ink">Signature</span>
            <RichTextEditor
              value={draft.defaultSignatureHtml}
              onChange={(html) => set('defaultSignatureHtml', html)}
              minHeightClass="min-h-[96px]"
              ariaLabel="Email signature"
              allowVariables={false}
              placeholder="Your name, title and contact details"
            />
          </div>
        </Section>

        <Section id="branding" title="Email branding" description="For branded email styles">
          <BrandSetting draft={draft} set={set} />
        </Section>

        <Section id="defaults" title="Sending defaults">
          <div className="divide-y divide-line/70">
            <Row>
              <Switch
                checked={draft.includeSignatureByDefault}
                onChange={(v) => set('includeSignatureByDefault', v)}
                label="Append signature by default"
              />
            </Row>
            <Row>
              <Switch
                checked={draft.confirmBeforeBulkSend}
                onChange={(v) => set('confirmBeforeBulkSend', v)}
                label="Confirm before sending"
              />
            </Row>
            <Row>
              <Switch
                checked={emailProvider.tracksEngagement && draft.openTrackingEnabled === true}
                disabled={!emailProvider.tracksEngagement}
                onChange={(v) => set('openTrackingEnabled', v)}
                label="Track opens"
                description={
                  !emailProvider.tracksEngagement
                    ? 'Not available yet for the connected sending method.'
                    : 'Adds an invisible image to each email. Apple Mail can count opens that didn\'t happen, and it can slightly hurt inbox placement, so turn it on after warm-up.'
                }
              />
            </Row>
            <Row>
              <Switch
                checked={false}
                disabled
                onChange={(v) => set('trackClicks', v)}
                label="Track link clicks"
                description={
                  'Not available yet.'
                }
              />
            </Row>
          </div>
        </Section>

        <Section id="notifications" title="Notifications">
          <PushNotificationsSetting />
        </Section>



        {/* Sticky save bar appears only when something changed. */}
        {dirty && (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-line bg-surface py-1.5 pl-4 pr-1.5 shadow-overlay animate-slide-up">
              <span className="text-ui text-ink-2">Unsaved changes</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(settings);
                  setErrors({});
                }}
              >
                Discard
              </Button>
              <Button size="sm" variant="primary" type="submit">
                Save changes
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Outside the settings form: mailbox changes apply immediately and have their own forms. */}
      <div className="mt-16 space-y-16 pb-20">
        <Section id="mailboxes" title="Sending mailboxes">
          <div className="mb-4 flex items-center gap-2">
            <Badge tone={emailProvider.isSimulated ? 'info' : 'success'} dot>
              {emailProvider.isSimulated ? 'Simulation' : 'Sending live'}
            </Badge>
            <span className="text-ui text-ink-3">
              {emailProvider.isSimulated
                ? 'Campaigns are simulated; no emails leave MailFlow.'
                : `Campaigns send through ${emailProvider.providerName}.`}
            </span>
          </div>
          <SendingMailboxesSetting />
        </Section>
        <Section id="do-not-contact" title="Do-not-contact list" description="These addresses are never emailed">
          <DoNotContactSetting />
        </Section>
      </div>

      </div>
      </div>
    </PageContainer>
  );
}

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'sender', label: 'Sender' },
  { id: 'branding', label: 'Email branding' },
  { id: 'defaults', label: 'Sending defaults' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'mailboxes', label: 'Sending mailboxes' },
  { id: 'do-not-contact', label: 'Do-not-contact list' },
];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
      <div className="mb-5">
        <h2 id={`${id}-title`} className="text-lg font-semibold leading-7 tracking-[-0.015em] text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-ui text-ink-3">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'system', label: 'System', icon: <Monitor aria-hidden="true" /> },
  { value: 'light', label: 'Light', icon: <Sun aria-hidden="true" /> },
  { value: 'dark', label: 'Dark', icon: <Moon aria-hidden="true" /> },
];

/** Theme for this device; applies immediately, no save needed. */
function AppearanceSetting() {
  const [theme, setTheme] = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex gap-1">
      {THEME_OPTIONS.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-ui font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&_svg]:size-3.5',
              active ? 'bg-subtle text-ink' : 'text-ink-3 hover:text-ink'
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Section menu that follows your scroll position (desktop only). */
function SettingsNav() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-10% 0px -60% 0px' }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return (
    <nav aria-label="Settings sections" className="hidden lg:block">
      <ul className="sticky top-6 space-y-0.5">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              aria-current={active === s.id ? 'true' : undefined}
              className={cn(
                'relative flex h-8 w-full items-center rounded-md px-3 text-left text-ui transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active === s.id ? 'font-medium text-ink' : 'text-ink-3 hover:text-ink'
              )}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="px-4 py-3.5">{children}</div>;
}

/** Center-crops an image to a square and downsizes it to 256px JPEG, small enough to store with settings. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
