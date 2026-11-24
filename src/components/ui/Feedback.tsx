import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '../../lib/cn';

/** A single loading placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4', className)} aria-hidden="true" />;
}

/** Placeholder rows shaped like the final content (never zeros while loading). */
export function SkeletonRows({ rows = 3, height = 'h-8', className }: { rows?: number; height?: string; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 font-medium hover:underline">
          <RefreshCw className="size-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

/** Small numeric chip next to a title. */
export function CountChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('text-ui tabular-nums text-ink-4', className)}>{children}</span>
  );
}

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Segmented filter chips with counts; empty options are disabled. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)} role="group" aria-label={label}>
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            disabled={o.count === 0 && i !== 0}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-35',
              active ? 'bg-subtle font-medium text-ink' : 'text-ink-3 enabled:hover:text-ink'
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="tabular-nums text-ink-4">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
