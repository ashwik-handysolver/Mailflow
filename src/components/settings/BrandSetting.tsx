import { ChangeEvent, useId, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TeamSettings } from '../../types/outreach';
import { DEFAULT_BRAND_COLOR } from '../../utils/emailTheme';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';

const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Brand used by the "Light branded" and "Branded card" email styles.
 * Part of the settings form: changes apply on "Save changes". The logo is
 * uploaded right away to a public URL, because email apps load images by URL.
 */
export function BrandSetting({
  draft,
  set,
}: {
  draft: TeamSettings;
  set: <K extends keyof TeamSettings>(key: K, value: TeamSettings[K]) => void;
}) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const color = draft.brandColor || DEFAULT_BRAND_COLOR;
  const [hexText, setHexText] = useState(color);

  const onLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !supabase) return;
    setLogoError('');
    if (!/^image\/(png|jpeg)$/.test(file.type)) return setLogoError('Use a PNG or JPG. SVG and WebP show up broken in some email apps.');
    if (file.size > 1024 * 1024) return setLogoError('Use an image under 1 MB.');
    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error('Sign in again to upload.');
      // A new file name each time, so email apps don't show an old cached logo.
      const path = `${userId}/logo-${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
      const { error } = await supabase.storage.from('brand').upload(path, file, { contentType: file.type });
      if (error) throw error;
      set('brandLogoUrl', supabase.storage.from('brand').getPublicUrl(path).data.publicUrl);
    } catch (err) {
      setLogoError((err as Error).message || "Couldn't upload the logo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Brand colour" htmlFor={`${uid}-color`} hint="Used for links, accents and the top bar.">
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Pick brand colour"
            value={color}
            onChange={(e) => {
              set('brandColor', e.target.value);
              setHexText(e.target.value);
            }}
            className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface p-1"
          />
          <Input
            id={`${uid}-color`}
            value={hexText}
            maxLength={7}
            invalid={!HEX_RE.test(hexText)}
            onChange={(e) => {
              const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
              setHexText(v);
              if (HEX_RE.test(v)) set('brandColor', v.toUpperCase());
            }}
            className="font-mono"
          />
        </div>
      </Field>
      <Field label="Company name" htmlFor={`${uid}-name`} hint="Shown in the branded-card header and footer.">
        <Input
          id={`${uid}-name`}
          placeholder={draft.teamName || 'Your company'}
          value={draft.brandName ?? ''}
          onChange={(e) => set('brandName', e.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-1.5 text-ui font-medium text-ink">Logo</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-14 min-w-28 items-center justify-center rounded-md border border-line bg-subtle px-3">
            {draft.brandLogoUrl ? (
              <img src={draft.brandLogoUrl} alt="Current logo" className="max-h-10 max-w-40 object-contain" />
            ) : (
              <span className="text-xs text-ink-4">No logo</span>
            )}
          </div>
          <Button
            size="sm"
            leadingIcon={<ImagePlus />}
            loading={uploading}
            disabled={!supabase}
            onClick={() => fileRef.current?.click()}
          >
            {draft.brandLogoUrl ? 'Replace logo' : 'Upload logo'}
          </Button>
          {draft.brandLogoUrl && (
            <Button size="sm" variant="ghost" onClick={() => set('brandLogoUrl', undefined)}>
              Remove
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogo} />
        </div>
        <p className={logoError ? 'mt-1.5 text-xs text-danger' : 'mt-1.5 text-xs text-ink-3'} role={logoError ? 'alert' : undefined}>
          {logoError || 'PNG or JPG, under 1 MB. A wide logo about 300×80 px looks best. Plain-style emails never include it.'}
        </p>
      </div>
    </div>
  );
}
