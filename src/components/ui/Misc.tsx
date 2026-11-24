import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { IconButton } from './Button';
import { Dropdown } from './Dropdown';

/* ---------------- EmptyState ---------------- */

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6 px-4' : 'py-10 px-6',
        className
      )}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-ui text-ink-3">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ---------------- Pagination ---------------- */

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  itemLabel = 'items',
}: PaginationProps) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-ui text-ink-3">
      <p className="tabular-nums" aria-live="polite">
        <span className="text-ink font-medium">
          {start}–{end}
        </span>{' '}
        of <span className="text-ink font-medium">{totalItems}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="hidden sm:flex items-center gap-2">
            <span>Rows</span>
            <div className="w-[76px]">
              <Dropdown
                label="Rows per page"
                size="sm"
                value={String(pageSize)}
                options={pageSizeOptions.map((s) => ({ value: String(s) }))}
                onChange={(v) => onPageSizeChange(Number(v))}
              />
            </div>
          </label>
        )}
        <div className="flex items-center gap-1">
          <IconButton label="Previous page" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </IconButton>
          <span className="tabular-nums px-1 min-w-[64px] text-center">
            Page {page} of {totalPages}
          </span>
          <IconButton
            label="Next page"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- SegmentedControl ---------------- */

interface SegmentedControlProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  ariaLabel: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 shrink-0"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition-colors duration-100',
              size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-ui',
              active ? 'bg-subtle text-ink' : 'text-ink-3 hover:text-ink'
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={cn('tabular-nums text-xs', active ? 'text-ink-3' : 'text-ink-4')}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Avatar ---------------- */

const AVATAR_TONES = ['bg-muted text-ink-2'];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = size === 'sm' ? 'size-6 text-[10px]' : size === 'lg' ? 'size-10 text-sm' : 'size-8 text-xs';
  if (src) {
    return <img src={src} alt="" className={cn('rounded-full object-cover shrink-0', dims, className)} />;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold shrink-0',
        dims,
        AVATAR_TONES[hash % AVATAR_TONES.length],
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ---------------- Callout ---------------- */

const CALLOUT_TONES = {
  info: 'bg-info-soft border-info-line text-info',
  warning: 'bg-warning-soft border-warning-line text-warning',
  danger: 'bg-danger-soft border-danger-line text-danger',
  success: 'bg-success-soft border-success-line text-success',
  neutral: 'bg-subtle border-line text-ink-2',
};

export function Callout({
  tone = 'info',
  icon,
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof CALLOUT_TONES;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-ui',
        CALLOUT_TONES[tone],
        className
      )}
    >
      {icon && <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(Boolean(title) && 'mt-0.5', 'text-ink-2')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------------- Kbd ---------------- */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface px-1 font-sans text-[11px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}
