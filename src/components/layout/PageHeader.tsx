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
  /** Accepted for callers; counts already live in the content, so the title stays clean. */
  count?: number;
  actions?: ReactNode;
  className?: string;
  /** Data-heavy pages (the dashboard) use a wider column. */
  wide?: boolean;
}

/** Page title and actions, rendered into the shared app header. */
export function PageHeader({ title, description, meta, actions, className, wide }: PageHeaderProps) {
  const slot = useContext(HeaderSlotContext);
  const content = (
    <div
      className={cn(
        'mx-auto flex w-full flex-wrap items-end justify-between gap-x-4 gap-y-2 px-4 pb-2 pt-4 sm:px-6 lg:px-10 lg:pt-8',
        wide ? 'max-w-none' : 'max-w-[1280px]',
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="truncate text-[22px] font-semibold leading-8 tracking-[-0.02em] text-ink sm:text-2xl">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-0.5 text-ui text-ink-3">{description}</p>}
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
        'mx-auto w-full px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-16',
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
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
        {description && <p className="text-ui text-ink-3 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
