import { ReactNode } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { Drawer } from '../ui/Overlay';
import { Button, IconButton } from '../ui/Button';
import { cn } from '../../lib/cn';

export interface RecordRow {
  id: string;
  primary: string;
  secondary?: string;
  /** Right-aligned detail, e.g. a date. */
  meta?: string;
  /** Extra line under the row, e.g. a bounce reason. */
  note?: string;
  noteTone?: 'danger' | 'muted';
  onSelect?: () => void;
}

export interface RecordsView {
  title: string;
  description?: ReactNode;
  rows: RecordRow[];
  action?: { label: string; onClick: () => void };
}

/** Side panel listing the records behind a dashboard number or alert. */
export function RecordsDrawer({ view, onClose }: { view: RecordsView | null; onClose: () => void }) {
  return (
    <Drawer open={Boolean(view)} onClose={onClose} label={view?.title ?? 'Details'} width="md">
      {view && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-heading font-semibold text-ink">
                {view.title} <span className="font-normal tabular-nums text-ink-3">{view.rows.length}</span>
              </h2>
              {view.description && <div className="mt-1 text-ui text-ink-3">{view.description}</div>}
            </div>
            <IconButton label="Close" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {view.rows.length === 0 ? (
              <p className="px-5 py-6 text-ui text-ink-3">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {view.rows.map((r) => {
                  const body = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ui font-medium text-ink">{r.primary}</span>
                        {r.secondary && <span className="block truncate text-xs text-ink-3">{r.secondary}</span>}
                        {r.note && (
                          <span className={cn('mt-1 block text-xs', r.noteTone === 'danger' ? 'text-danger' : 'text-ink-3')}>
                            {r.note}
                          </span>
                        )}
                      </span>
                      {r.meta && <span className="shrink-0 self-start text-xs tabular-nums text-ink-3">{r.meta}</span>}
                      {r.onSelect && <ChevronRight className="size-4 shrink-0 text-ink-4" aria-hidden="true" />}
                    </>
                  );
                  return (
                    <li key={r.id}>
                      {r.onSelect ? (
                        <button
                          type="button"
                          onClick={r.onSelect}
                          className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none"
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-3">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {view.action && (
            <div className="border-t border-line px-5 py-3">
              <Button variant="primary" onClick={view.action.onClick}>
                {view.action.label}
              </Button>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
