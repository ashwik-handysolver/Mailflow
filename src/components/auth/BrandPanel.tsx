/**
 * Left side of the sign-in page: brand, promise, and a quiet illustration of
 * what the product does (pick leads, personalize, send). The illustration is
 * a static depiction of the workflow, not live data, so it shows no metrics.
 */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#0b0b0c] text-white lg:flex lg:flex-col">
      {/* Fine grid, fading out toward the bottom; the only texture on the page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 85%)',
        }}
      />

      <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-16">
        <BrandMark tone="dark" />

        <div className="mt-auto max-w-[460px] pt-16">
          <h2 className="font-display text-[44px] leading-[1.05] tracking-[-0.01em] xl:text-[52px]">
            Email outreach,
            <br />
            <span className="text-[#f7862a]">without the busywork.</span>
          </h2>
          <p className="mt-5 max-w-[400px] text-[15px] leading-relaxed text-white/60">
            Keep your leads, templates and campaigns in one place. Write once, personalize for every recipient, and see
            what went out.
          </p>
        </div>

        <WorkflowIllustration />

        <p className="mt-10 text-xs text-white/35">© {new Date().getFullYear()} MailFlow</p>
      </div>
    </aside>
  );
}

export function BrandMark({ tone }: { tone: 'dark' | 'light' }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="90 84 548 548" className="size-8 rounded-md" aria-hidden="true">
        <image href="/logo.png" width="743" height="704" />
      </svg>
      <span className={tone === 'dark' ? 'text-[15px] font-semibold text-white' : 'text-[15px] font-semibold text-ink'}>
        MailFlow
      </span>
    </div>
  );
}

const STEPS = ['Audience', 'Message', 'Review & send'];

function WorkflowIllustration() {
  return (
    <div aria-hidden="true" className="relative mt-12 max-w-[500px] select-none">
      {/* Composer steps */}
      <ol className="mb-4 flex items-center gap-2 text-[11px] text-white/50">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={
                i === 1
                  ? 'flex size-4 items-center justify-center rounded-full bg-[#f7862a] text-[10px] font-semibold text-black'
                  : 'flex size-4 items-center justify-center rounded-full border border-white/20 text-[10px]'
              }
            >
              {i + 1}
            </span>
            <span className={i === 1 ? 'text-white/85' : undefined}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-white/15" />}
          </li>
        ))}
      </ol>

      {/* Message being personalized */}
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)]">
        <div className="space-y-1.5 border-b border-white/10 pb-3 text-[12px]">
          <p className="text-white/40">
            To <span className="text-white/75">Priya Nair</span> <span className="text-white/30">· Helios BioLabs</span>
          </p>
          <p className="text-white/40">
            Subject{' '}
            <span className="text-white/85">
              Quick question about <Token>{'{company}'}</Token>
            </span>
          </p>
        </div>
        <div className="space-y-2 pt-3 text-[13px] leading-relaxed text-white/70">
          <p>
            Hi <Token>{'{name}'}</Token>,
          </p>
          <p>
            I noticed <Token>{'{company}'}</Token> is growing its partnerships team and thought a short intro might be
            useful…
          </p>
        </div>
      </div>

      {/* Recipients the same message goes to */}
      <ul className="ml-6 mt-[-1px] divide-y divide-white/[0.06] rounded-b-lg border border-t-0 border-white/10 bg-white/[0.02] text-[12px]">
        {[
          ['Marcus Holloway', 'Vanguard Logistics'],
          ['Sofia Rossi', 'Northwind Studio'],
        ].map(([n, c]) => (
          <li key={n} className="flex items-center gap-2 px-4 py-2">
            <span className="size-1.5 rounded-full bg-white/30" />
            <span className="text-white/65">{n}</span>
            <span className="text-white/30">· {c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Token({ children }: { children: string }) {
  return (
    <span className="rounded-[3px] bg-[#f7862a]/15 px-1 font-mono text-[0.85em] text-[#ffb27a]">{children}</span>
  );
}
