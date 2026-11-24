import { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { AttachmentMeta } from '../../types/outreach';
import { ATTACHMENT_LIMITS, formatBytes, totalBytes } from '../../utils/attachments';
import { Button } from '../ui/Button';
import { AttachmentList } from './AttachmentList';

export interface AttachmentItem extends AttachmentMeta {
  id: string;
}

interface AttachmentFieldProps {
  items: AttachmentItem[];
  /** Adds what fits within the limits; returns messages for rejected files. */
  onAddFiles: (files: File[]) => string[];
  onRemove: (id: string) => void;
  errors: string[];
  onErrors: (errors: string[]) => void;
  /** Hint shown when nothing is attached yet. */
  emptyHint?: string;
}

/** "Attach files" button, current files as removable chips, and rejection messages. */
export function AttachmentField({ items, onAddFiles, onRemove, errors, onErrors, emptyHint }: AttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const total = totalBytes(items);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" leadingIcon={<Paperclip />} onClick={() => inputRef.current?.click()}>
          Attach files
        </Button>
        <span className="text-xs text-ink-3">
          {items.length > 0
            ? `${items.length} of ${ATTACHMENT_LIMITS.maxFiles} files · ${formatBytes(total)} of ${formatBytes(ATTACHMENT_LIMITS.maxTotalBytes)}`
            : emptyHint ?? `Up to ${formatBytes(ATTACHMENT_LIMITS.maxFileBytes)} each`}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Attach files"
          tabIndex={-1}
          onChange={(e) => {
            onErrors(onAddFiles(Array.from(e.target.files ?? [])));
            e.target.value = '';
          }}
        />
      </div>

      <AttachmentList items={items} onRemove={(i) => onRemove(items[i].id)} />

      {errors.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger">
          <ul className="flex-1 space-y-0.5">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
          <button type="button" onClick={() => onErrors([])} aria-label="Dismiss" className="rounded p-0.5 hover:bg-danger/10">
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
