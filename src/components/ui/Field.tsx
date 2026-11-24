import {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useId,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const CONTROL_BASE =
  'w-full rounded-md border bg-surface text-sm text-ink placeholder:text-ink-4 transition-[border-color,box-shadow] duration-100 ' +
  'focus:outline-none focus:ring-3 disabled:bg-subtle disabled:text-ink-3';

function controlBorder(invalid?: boolean) {
  return invalid
    ? 'border-danger focus:border-danger focus:ring-danger/15'
    : 'border-line-strong hover:border-ink-4/70 focus:border-accent focus:ring-accent/15';
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
  /** Visually hide the label but keep it for screen readers. */
  hideLabel?: boolean;
}

/** Label + control + hint/error wrapper used by every form in the app. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
  hideLabel,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className={cn('text-ui font-medium text-ink', hideLabel && 'sr-only')}
      >
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  inputSize?: 'sm' | 'md';
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  invalid,
  leadingIcon,
  trailing,
  inputSize = 'md',
  className,
  ref,
  ...rest
}: InputProps) {
  const control = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && rest.id ? `${rest.id}-error` : rest['aria-describedby']}
      className={cn(
        CONTROL_BASE,
        controlBorder(invalid),
        inputSize === 'sm' ? 'h-8 text-ui' : 'h-9',
        leadingIcon ? 'pl-8' : 'pl-3',
        trailing ? 'pr-9' : 'pr-3',
        !leadingIcon && !trailing && className
      )}
      {...rest}
    />
  );

  if (!leadingIcon && !trailing) return control;

  return (
    <div className={cn('relative', className)}>
      {leadingIcon && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4 [&_svg]:size-4">
          {leadingIcon}
        </span>
      )}
      {control}
      {trailing && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
          {trailing}
        </span>
      )}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, controlBorder(invalid), 'px-3 py-2 resize-y min-h-20', className)}
      {...rest}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  selectSize?: 'sm' | 'md';
  wrapperClassName?: string;
}

/** Native select (fully accessible, works on mobile) styled to match the inputs. */
export function Select({
  invalid,
  selectSize = 'md',
  className,
  wrapperClassName,
  children,
  ...rest
}: SelectProps) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          controlBorder(invalid),
          'appearance-none pl-3 pr-8 cursor-pointer',
          selectSize === 'sm' ? 'h-8 text-ui' : 'h-9',
          className
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-3"
      />
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}

/** Accessible toggle switch with label + description on the left. */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-ui text-ink-3 mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 mt-0.5',
          checked ? 'bg-accent' : 'bg-line-strong',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'inline-block size-4 rounded-full bg-white shadow-xs transition-transform duration-150',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean;
}

export function Checkbox({ indeterminate, className, ...rest }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate);
      }}
      className={cn('size-4 rounded-[4px] border-line-strong cursor-pointer align-middle', className)}
      {...rest}
    />
  );
}
