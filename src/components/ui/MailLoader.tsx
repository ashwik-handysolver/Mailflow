/**
 * Full-screen loading state: an envelope opens, a letter rises out of it and
 * tucks back in, on a loop. Motion is CSS only (see .mail-loader in index.css)
 * and stops for people who prefer reduced motion.
 */
export function MailLoader({ label = 'Loading…', hideLabel = false }: { label?: string; hideLabel?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas p-6" role="status" aria-live="polite">
      <svg className="mail-loader h-24 w-[120px] overflow-visible" viewBox="0 0 120 96" aria-hidden="true">
        {/* Back of the envelope */}
        <rect x="10" y="36" width="100" height="56" rx="6" className="fill-(--ml-back)" />
        {/* Open flap, behind the letter */}
        <path d="M12 37 L60 66 L108 37 Z" className="mail-loader-flap-back fill-(--ml-flap) stroke-(--ml-stroke)" strokeWidth="1.25" strokeLinejoin="round" />
        {/* Letter */}
        <g className="mail-loader-letter">
          <rect x="22" y="30" width="76" height="44" rx="4" className="fill-(--ml-paper) stroke-(--ml-stroke)" strokeWidth="1.25" />
          <rect x="32" y="39" width="26" height="4" rx="2" className="fill-accent" />
          <rect x="32" y="48" width="56" height="3" rx="1.5" className="fill-(--ml-line)" />
          <rect x="32" y="55" width="48" height="3" rx="1.5" className="fill-(--ml-line)" />
          <rect x="32" y="62" width="38" height="3" rx="1.5" className="fill-(--ml-line)" />
        </g>
        {/* Front pocket: its V meets the closed flap, so nothing shows through */}
        <path d="M10 40 L60 64 L110 40 V86 a6 6 0 0 1 -6 6 H16 a6 6 0 0 1 -6 -6 Z" className="fill-(--ml-pocket) stroke-(--ml-stroke)" strokeWidth="1.25" strokeLinejoin="round" />
        {/* Closed flap, in front: folds up to the edge, then the back flap takes over */}
        <path d="M12 37 L60 66 L108 37 Z" className="mail-loader-flap fill-(--ml-flap) stroke-(--ml-stroke)" strokeWidth="1.25" strokeLinejoin="round" />
      </svg>
      {/* Hidden labels are still announced to screen readers. */}
      <p className={hideLabel ? 'sr-only' : 'text-ui text-ink-3'}>{label}</p>
    </div>
  );
}
