import { ReactNode, RefObject, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

let openOverlayCount = 0;

/**
 * Shared behaviour for modal layers: Escape to close, focus moved in and
 * restored on close, Tab trapped inside, and body scroll locked.
 */
function useModalBehaviour(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const autofocus =
      container?.querySelector<HTMLElement>('[data-autofocus]') ??
      container?.querySelector<HTMLElement>(FOCUSABLE);
    (autofocus ?? container)?.focus({ preventScroll: true });

    openOverlayCount += 1;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!container) return;
      // Only the top-most layer reacts.
      const layers = document.querySelectorAll('[data-mf-layer]');
      if (layers[layers.length - 1] !== container) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openOverlayCount = Math.max(0, openOverlayCount - 1);
      if (openOverlayCount === 0) document.body.style.overflow = '';
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, containerRef]);
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Remove the default body padding (for custom layouts). */
  bare?: boolean;
  hideClose?: boolean;
}

const DIALOG_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[1180px] h-[calc(100dvh-2rem)] sm:h-[calc(100dvh-4rem)]',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  bare = false,
  hideClose = false,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalBehaviour(open, ref, onClose);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-8">
      <div
        className="absolute inset-0 bg-scrim/45 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        data-mf-layer
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-surface shadow-dialog flex flex-col outline-none animate-scale-in',
          'rounded-t-xl sm:rounded-xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-4rem)]',
          DIALOG_SIZES[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-heading font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-ui text-ink-3 mt-0.5">
                {description}
              </p>
            )}
          </div>
          {!hideClose && (
            <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1.5">
              <X />
            </IconButton>
          )}
        </div>
        <div className={cn('flex-1 min-h-0 scrollbar-thin', bare ? 'overflow-hidden' : 'overflow-y-auto px-5 py-5')}>
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-line bg-canvas rounded-b-xl shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible label for the drawer. */
  label: string;
  children: ReactNode;
  width?: 'md' | 'lg';
}

export function Drawer({ open, onClose, label, children, width = 'md' }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useModalBehaviour(open, ref, onClose);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-scrim/35 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={ref}
        data-mf-layer
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'relative h-full w-full bg-surface border-l border-line shadow-dialog flex flex-col outline-none animate-slide-in-right',
          width === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-[480px]'
        )}
      >
        {children}
      </aside>
    </div>,
    document.body
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalBehaviour(open, ref, onCancel);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim/45 animate-fade-in" onClick={onCancel} aria-hidden="true" />
      <div
        ref={ref}
        data-mf-layer
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-xl bg-surface shadow-dialog p-5 outline-none animate-scale-in"
      >
        <h2 id={titleId} className="text-heading font-semibold text-ink">
          {title}
        </h2>
        <div className="text-ui text-ink-2 mt-1.5">{description}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className="h-8 px-3 rounded-md text-ui font-medium text-ink border border-line-strong bg-surface hover:bg-subtle"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'h-8 px-3 rounded-md text-ui font-medium text-white disabled:opacity-60',
              destructive ? 'bg-danger hover:bg-danger-hover' : 'bg-accent hover:bg-accent-hover'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
