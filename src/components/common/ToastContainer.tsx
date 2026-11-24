import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ToastMessage } from '../../types/outreach';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  /** Lift toasts above a sticky page footer so they never cover its actions. */
  aboveFooter?: boolean;
}

const ICONS = {
  success: <CheckCircle2 className="size-4 text-success shrink-0 mt-px" />,
  error: <XCircle className="size-4 text-danger shrink-0 mt-px" />,
  warning: <AlertTriangle className="size-4 text-warning shrink-0 mt-px" />,
  info: <Info className="size-4 text-info shrink-0 mt-px" />,
};

export function ToastContainer({ toasts, onDismiss, aboveFooter = false }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      className={`fixed right-4 left-4 sm:left-auto z-[80] flex flex-col items-end gap-2 pointer-events-none ${
        aboveFooter ? 'bottom-20' : 'bottom-4'
      }`}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            role={toast.type === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border border-line bg-surface shadow-overlay ${
              toast.action ? 'sm:w-auto sm:max-w-[360px] items-center px-3 py-2' : 'sm:w-[360px] px-3.5 py-3'
            }`}
          >
            {ICONS[toast.type]}
            <div className="flex-1 min-w-0">
              <p className="text-ui font-medium text-ink">{toast.title}</p>
              {toast.description && <p className="text-ui text-ink-3 mt-0.5">{toast.description}</p>}
            </div>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action!.onClick();
                    onDismiss(toast.id);
                  }}
                  className="shrink-0 rounded-md bg-accent px-2.5 py-0.5 text-xs font-medium text-white hover:opacity-90"
                >
                  {toast.action.label}
                </button>
              )}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="-m-1 p-1 rounded text-ink-4 hover:text-ink transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
