import { createContext, ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

/**
 * The app shell renders one sticky header bar and exposes its DOM node here.
 * Pages declare their title and primary actions with <PageHeader>, which is
 * portalled into that bar so every page shares the same header.
 */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Small metadata next to the title. */
  meta?: ReactNode;
  /** Item count, shown as a muted chip after the title. */
  count?: number;
  actions?: ReactNode;
  className?: string;
  /** Data-heavy pages (the dashboard) use a wider column. */
  wide?: boolean;
}

/** Page title and actions, rendered into the shared app header. */
export function PageHeader({ title, description, meta, count, actions, className, wide }: PageHeaderProps) {
  const slot = useContext(HeaderSlotContext);
  const content = (
    <div
      className={cn(
        'mx-auto flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8',
        wide ? 'max-w-none' : 'max-w-[1280px]',
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="truncate text-[20px] font-semibold leading-7 tracking-[-0.02em] text-ink">{title}</h1>
          {count !== undefined && (
            <span className="rounded-md bg-muted px-1.5 text-xs font-medium leading-5 tabular-nums text-ink-2">{count}</span>
          )}
          {meta}
        </div>
        {description && <p className="text-ui text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
  // Before the shell has mounted its header (first paint) render nothing; it re-renders immediately.
  return slot ? createPortal(content, slot) : null;
}

/** Standard content container used by every page. */
export function PageContainer({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 lg:px-8 pt-5 lg:pt-6 pb-12',
        wide ? 'max-w-none' : !className?.includes('max-w-') && 'max-w-[1280px]',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Section heading used inside pages (not a card). */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className ?? 'mb-3')}>
      <div className="min-w-0">
        <h2 className="text-heading font-semibold text-ink">{title}</h2>
        {description && <p className="text-ui text-ink-3 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
