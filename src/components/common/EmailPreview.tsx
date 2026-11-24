import { ReactNode, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceContext';
import { EmailStyle, renderStyledEmail } from '../../utils/emailTheme';
import { cn } from '../../lib/cn';
import { AttachmentMeta } from '../../types/outreach';
import { AttachmentList } from './AttachmentList';

interface EmailPreviewProps {
  fromName: string;
  fromEmail: string;
  toName?: string;
  toEmail?: string;
  /** Pre-escaped HTML for the subject (may contain variable highlights). */
  subjectHtml: string;
  bodyHtml: string;
  /** Visually mark values that came from variables. */
  highlight?: boolean;
  attachments?: AttachmentMeta[];
  toolbar?: ReactNode;
  className?: string;
  /** Plain (default) renders inline; styled emails render in a frame exactly as sent. */
  emailStyle?: EmailStyle;
}

/**
 * Renders an email the way a recipient would see it: a ~600px message on an
 * inbox-like backdrop, so line length matches real mail clients.
 */
export function EmailPreview({
  fromName,
  fromEmail,
  toName,
  toEmail,
  subjectHtml,
  bodyHtml,
  highlight = false,
  attachments,
  toolbar,
  className,
  emailStyle = 'plain',
}: EmailPreviewProps) {
  const { settings } = useWorkspace();
  const styled = emailStyle !== 'plain';
  return (
    <div className={cn('rounded-lg bg-muted/60', className)}>
      {toolbar && <div className="border-b border-line/80 px-4 py-2">{toolbar}</div>}
      <div className="p-3 sm:p-5">
        <article className={cn('mx-auto w-full max-w-[600px] rounded-md border border-line bg-surface', highlight && 'mf-highlight')}>
          <header className="border-b border-line px-5 py-4">
            <h3
              className="text-[15px] font-semibold leading-snug text-ink break-words"
              dangerouslySetInnerHTML={{ __html: subjectHtml || '<span class="text-ink-4">(No subject)</span>' }}
            />
            <dl className="mt-2 grid grid-cols-[40px_1fr] gap-y-0.5 text-xs">
              <dt className="text-ink-3">From</dt>
              <dd className="min-w-0 truncate text-ink-2">
                {fromName} <span className="text-ink-3">&lt;{fromEmail}&gt;</span>
              </dd>
              <dt className="text-ink-3">To</dt>
              <dd className="min-w-0 truncate text-ink-2">
                {toName ? (
                  <>
                    {toName} <span className="text-ink-3">&lt;{toEmail || 'no email'}&gt;</span>
                  </>
                ) : (
                  <span className="text-ink-4">Sample recipient</span>
                )}
              </dd>
            </dl>
          </header>
          {styled ? (
            <StyledFrame
              html={renderStyledEmail({
                bodyHtml: bodyHtml || '<p style="color:#a1a1aa">Start writing to see the preview.</p>',
                style: emailStyle,
                brand: { color: settings.brandColor, logoUrl: settings.brandLogoUrl, name: settings.brandName || settings.teamName },
                preview: true,
              })}
            />
          ) : (
            <div
              className="mailflow-preview-body px-5 py-5 text-sm"
              dangerouslySetInnerHTML={{ __html: bodyHtml || '<p class="text-ink-4">Start writing to see the preview.</p>' }}
            />
          )}
          {attachments && attachments.length > 0 && (
            <footer className="border-t border-line px-5 py-3">
              <p className="mb-2 text-xs text-ink-3">
                {attachments.length} {attachments.length === 1 ? 'attachment' : 'attachments'}
              </p>
              <AttachmentList items={attachments} />
            </footer>
          )}
        </article>
      </div>
    </div>
  );
}

/** Sandboxed frame sized to its content, so the email's own styles can't leak into the app. */
function StyledFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(360);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const measure = () => {
      const doc = frame.contentDocument;
      if (doc?.body) setHeight(Math.max(200, doc.documentElement.scrollHeight));
    };
    frame.addEventListener('load', measure);
    measure();
    return () => frame.removeEventListener('load', measure);
  }, [html]);
  return (
    <iframe
      ref={ref}
      title="Email preview"
      srcDoc={html}
      sandbox="allow-same-origin"
      className="block w-full border-0"
      style={{ height }}
    />
  );
}
