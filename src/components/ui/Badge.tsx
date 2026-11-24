import { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-subtle text-ink-2 border-line', dot: 'bg-ink-4' },
  accent: { badge: 'bg-accent-soft text-accent-ink border-accent-line', dot: 'bg-accent' },
  success: { badge: 'bg-success-soft text-success border-success-line', dot: 'bg-success' },
  warning: { badge: 'bg-warning-soft text-warning border-warning-line', dot: 'bg-warning' },
  danger: { badge: 'bg-danger-soft text-danger border-danger-line', dot: 'bg-danger' },
  info: { badge: 'bg-info-soft text-info border-info-line', dot: 'bg-info' },
};

interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ tone = 'neutral', dot = false, children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md border text-xs font-medium whitespace-nowrap',
        TONES[tone].badge,
        className
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', TONES[tone].dot)} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * A personalization variable, shown as a soft brand-tinted pill in the UI font.
 * `raw` shows the {{syntax}} instead, for places that teach how to type it.
 */
export function VariableToken({ name, className, raw = false }: { name: string; className?: string; raw?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 align-baseline text-[0.92em] font-medium leading-[1.35] text-accent-ink',
        className
      )}
      title={`{{${name}}}`}
    >
      <span className="size-1 rounded-full bg-accent/70" aria-hidden="true" />
      {raw ? `{{${name}}}` : name}
    </span>
  );
}
