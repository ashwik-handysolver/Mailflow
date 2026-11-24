import { ReactNode, useId, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Small "i" that explains a metric. Opens on hover and on keyboard focus,
 * and is announced to screen readers via aria-describedby.
 */
export function InfoTip({ children, align = 'start', className }: { children: ReactNode; align?: 'start' | 'end'; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-describedby={id}
        aria-label="What does this mean?"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex size-4 items-center justify-center rounded-full text-ink-4 transition-colors hover:text-ink-2 focus-visible:text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute top-full z-40 mt-1.5 w-60 rounded-md bg-ink px-2.5 py-2 text-left text-xs font-normal leading-relaxed text-canvas shadow-overlay transition-opacity duration-100',
          align === 'end' ? 'right-0' : 'left-0',
          open ? 'opacity-100' : 'opacity-0'
        )}
      >
        {children}
      </span>
    </span>
  );
}
