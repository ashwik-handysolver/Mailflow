import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Menu } from './Menu';

export interface DropdownOption<T extends string> {
  value: T;
  label?: string;
  /** Optional colour dot (e.g. lead status). */
  color?: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name; also the tooltip for the inline look. */
  label: string;
  /**
   * 'inline' reads as plain text until hovered or focused (table cells);
   * 'field' looks like a form input.
   */
  appearance?: 'inline' | 'field';
  size?: 'sm' | 'md';
  id?: string;
  className?: string;
}

function Dot({ color }: { color: string }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

/** Custom single-select dropdown built on the shared Menu (portalled, keyboard-friendly). */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  appearance = 'field',
  size = 'md',
  id,
  className,
}: DropdownProps<T>) {
  const current = options.find((o) => o.value === value);
  const text = current?.label ?? current?.value ?? value;

  return (
    <Menu
      align="start"
      width={appearance === 'field' ? 'trigger' : 200}
      items={options.map((o) => ({
        label: o.label ?? o.value,
        icon: o.color ? <Dot color={o.color} /> : undefined,
        selected: o.value === value,
        onSelect: () => {
          if (o.value !== value) onChange(o.value);
        },
      }))}
      trigger={(p) => (
        <button
          type="button"
          id={id}
          {...p}
          aria-label={appearance === 'inline' ? label : undefined}
          title={appearance === 'inline' ? label : undefined}
          className={cn(
            'group/dd flex w-full min-w-0 items-center gap-1.5 rounded-md text-left outline-none transition-colors',
            appearance === 'inline'
              ? 'relative h-7 border border-transparent pl-1.5 pr-5 text-ui text-ink hover:border-line hover:bg-surface focus-visible:border-accent focus-visible:bg-surface focus-visible:ring-3 focus-visible:ring-accent/15 aria-expanded:border-line aria-expanded:bg-surface'
              : cn(
                  'border border-line-strong bg-surface px-3 text-ink hover:border-ink-4/70 focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/15 aria-expanded:border-accent aria-expanded:ring-3 aria-expanded:ring-accent/15',
                  size === 'sm' ? 'h-8 text-ui' : 'h-9 text-sm'
                ),
            className
          )}
        >
          {current?.color && <Dot color={current.color} />}
          <span className="min-w-0 flex-1 truncate">{text}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 shrink-0 text-ink-3 transition-opacity',
              // Inline: the arrow overlays the right padding so it never widens table cells.
              appearance === 'inline' &&
                'absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/dd:opacity-100 group-focus-visible/dd:opacity-100 group-aria-expanded/dd:opacity-100'
            )}
          />
        </button>
      )}
    />
  );
}
