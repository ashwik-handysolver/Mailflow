import { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover active:bg-accent-ink disabled:bg-accent/45',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-subtle active:bg-muted disabled:text-ink-4',
  ghost: 'text-ink-2 hover:text-ink hover:bg-subtle active:bg-muted disabled:text-ink-4',
  danger:
    'bg-danger text-white hover:bg-danger-hover disabled:bg-danger/45',
  link: 'text-accent hover:text-accent-hover hover:underline underline-offset-2 px-0! h-auto!',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-ui gap-1.5 [&_svg]:size-3.5',
  md: 'h-8 px-3 text-ui gap-1.5 [&_svg]:size-4',
  lg: 'h-9 px-4 text-sm gap-2 [&_svg]:size-4',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-100 select-none shrink-0',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  ref?: Ref<HTMLButtonElement>;
}

/** Square icon-only button. `label` is required and becomes the accessible name + tooltip. */
export function IconButton({
  label,
  size = 'md',
  className,
  children,
  type = 'button',
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-ink-3 transition-colors duration-100 shrink-0',
        'hover:text-ink hover:bg-subtle active:bg-muted disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'sm' ? 'size-7 [&_svg]:size-3.5' : 'size-8 [&_svg]:size-4',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
