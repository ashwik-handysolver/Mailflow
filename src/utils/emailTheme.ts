/**
 * Email styles. "plain" is the personal-looking email MailFlow has always sent.
 * "light" and "card" wrap the body in email-safe HTML: table layout, inline
 * styles (Gmail and Outlook ignore most CSS), a 600px column, and colours that
 * survive dark mode reasonably well.
 *
 * The sending server replaces OPT_OUT_PLACEHOLDER with the opt-out line, so the
 * line sits inside the design instead of after the closing </html>.
 */
export type EmailStyle = 'plain' | 'light' | 'card';

export const EMAIL_STYLES: { value: EmailStyle; label: string; description: string }[] = [
  { value: 'plain', label: 'Plain', description: 'Looks like a personal email. Best for outreach.' },
  { value: 'light', label: 'Light branded', description: 'Mostly text with your brand colour and a small logo.' },
  { value: 'card', label: 'Branded card', description: 'Logo header on a soft background. For newsletters.' },
];

export const OPT_OUT_PLACEHOLDER = '<!--MAILFLOW_OPT_OUT-->';
export const OPT_OUT_TEXT = 'If you\'d rather not hear from me, just reply "unsubscribe" and I won\'t email you again.';
export const DEFAULT_BRAND_COLOR = '#F7862A';

export interface EmailBrand {
  color?: string;
  logoUrl?: string;
  name?: string;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const TEXT = '#27272a';
const MUTED = '#71717a';

function safeColor(c?: string): string {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : DEFAULT_BRAND_COLOR;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inline styles on the body's own tags, since many clients drop <style>. */
function inlineBodyStyles(html: string, accent: string): string {
  return html
    .replace(/<p(\s[^>]*)?>/gi, (_m, attrs = '') => `<p${attrs} style="margin:0 0 14px 0;">`)
    .replace(/<a\s/gi, `<a style="color:${accent};text-decoration:underline;" `)
    .replace(/<(ul|ol)(\s[^>]*)?>/gi, (_m, tag, attrs = '') => `<${tag}${attrs} style="margin:0 0 14px 0;padding-left:22px;">`)
    .replace(/<li(\s[^>]*)?>/gi, (_m, attrs = '') => `<li${attrs} style="margin:0 0 6px 0;">`);
}

function documentShell(inner: string, background: string, preview: boolean): string {
  // Preview-only CSS shows filled/missing variables the same way as the app.
  const previewCss = preview
    ? `.mf-var-filled{background:#fff1e6;color:#9a3412;border-radius:3px;padding:0 2px}
       .missing-var-highlight{background:#fff8eb;color:#92400e;box-shadow:inset 0 -1.5px 0 #e3a008;border-radius:3px;padding:0 4px;font-family:monospace;font-size:.82em}`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<style>body{margin:0;padding:0}img{border:0;display:block}a{color:inherit}${previewCss}</style></head>
<body style="margin:0;padding:0;background:${background};">${inner}</body></html>`;
}

function logoImg(brand: EmailBrand, height: number): string {
  if (!brand.logoUrl) return '';
  return `<img src="${escapeAttr(brand.logoUrl)}" alt="${escapeAttr(brand.name || 'Logo')}" height="${height}" style="height:${height}px;width:auto;max-width:200px;border:0;display:block;">`;
}

/**
 * Returns the HTML to send. For "plain" that's the body unchanged (the server
 * appends the opt-out line). With `preview`, the opt-out line is filled in
 * and variable highlights are styled.
 */
export function renderStyledEmail(opts: {
  bodyHtml: string;
  style: EmailStyle;
  brand: EmailBrand;
  preview?: boolean;
}): string {
  const { bodyHtml, style, brand, preview = false } = opts;
  if (style === 'plain') return bodyHtml;

  const accent = safeColor(brand.color);
  const body = inlineBodyStyles(bodyHtml, accent);
  const optOut = preview ? OPT_OUT_TEXT : OPT_OUT_PLACEHOLDER;

  if (style === 'light') {
    const logo = brand.logoUrl
      ? `<tr><td style="padding:22px 0 0 0;">${logoImg(brand, 28)}</td></tr>`
      : '';
    const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="border-top:3px solid ${accent};padding:24px 0 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${TEXT};">${body}</td></tr>
${logo}
<tr><td style="padding:22px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">${optOut}</td></tr>
</table></td></tr></table>`;
    return documentShell(inner, '#ffffff', preview);
  }

  // card
  const header = brand.logoUrl
    ? logoImg(brand, 34)
    : `<span style="font-family:${FONT};font-size:18px;font-weight:700;color:${TEXT};">${escapeAttr(brand.name || '')}</span>`;
  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2ee;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 4px 18px 4px;">${header}</td></tr>
<tr><td style="background:#ffffff;border-radius:10px;border:1px solid #e7e5e2;border-top:4px solid ${accent};padding:32px 32px 28px 32px;font-family:${FONT};font-size:15px;line-height:1.65;color:${TEXT};">${body}</td></tr>
<tr><td style="padding:20px 4px 0 4px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
${brand.name ? `<div style="font-weight:600;color:#52525b;">${escapeAttr(brand.name)}</div>` : ''}<div>${optOut}</div></td></tr>
</table></td></tr></table>`;
  return documentShell(inner, '#f4f2ee', preview);
}
