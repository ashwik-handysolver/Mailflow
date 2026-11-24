import { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { InfoTip } from './InfoTip';

/** The one card surface: white, hairline border, a whisper of shadow. */
export const CARD = 'rounded-xl border border-line-strong/60 bg-surface shadow-xs dark:border-line-strong/50';

export function Card({ children, className, as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div'; 'aria-label'?: string; 'aria-labelledby'?: string }) {
  return (
    <Tag className={cn(CARD, className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Card title row: title, optional count and tip on the left; one action on the right. */
export function CardHeader({
  title,
  id,
  icon,
  meta,
  tip,
  action,
  className,
}: {
  title: ReactNode;
  id?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  tip?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex min-h-7 items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="flex size-4 shrink-0 items-center justify-center text-ink-3 [&>svg]:size-4">{icon}</span>}
        <h2 id={id} className="truncate text-heading font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {meta !== undefined && meta !== null && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-subtle px-1.5 text-2xs font-medium tabular-nums text-ink-2">
            {meta}
          </span>
        )}
        {tip && <InfoTip>{tip}</InfoTip>}
      </div>
      {action}
    </header>
  );
}

/** Quiet text action for card headers ("View all", "Settings"). */
export function CardAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 shrink-0 items-center rounded-md px-2 text-xs font-medium text-ink-2 transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
    </button>
  );
}
