import { FileText, X } from 'lucide-react';
import { AttachmentMeta } from '../../types/outreach';
import { formatBytes } from '../../utils/attachments';
import { cn } from '../../lib/cn';

interface AttachmentListProps {
  items: (AttachmentMeta & { id?: string })[];
  /** When provided, each item gets a remove button. */
  onRemove?: (index: number) => void;
  className?: string;
}

/** Compact file chips: name and size, optionally removable. */
export function AttachmentList({ items, onRemove, className }: AttachmentListProps) {
  if (items.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Attachments">
      {items.map((a, i) => (
        <li
          key={a.id ?? `${a.name}-${i}`}
          className="flex h-7 max-w-full items-center gap-1.5 rounded-md border border-line bg-surface pl-2 pr-1 text-xs"
        >
          <FileText className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
          <span className="max-w-[220px] truncate text-ink" title={a.name}>
            {a.name}
          </span>
          <span className="shrink-0 tabular-nums text-ink-3">{formatBytes(a.size)}</span>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${a.name}`}
              className="flex size-5 shrink-0 items-center justify-center rounded text-ink-3 hover:bg-subtle hover:text-ink"
            >
              <X className="size-3" />
            </button>
          ) : (
            <span className="w-1" />
          )}
        </li>
      ))}
    </ul>
  );
}
