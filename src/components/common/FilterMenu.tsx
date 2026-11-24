import { ChevronDown, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { cn } from '../../lib/cn';

/** Multi-select filter button ("Status ▾ · 2") that stays open while toggling. */
export function FilterMenu<T extends string>({
  label,
  selected,
  options,
  onToggle,
}: {
  label: string;
  selected: T[];
  options: { value: T; label: string; color?: string }[];
  onToggle: (value: T) => void;
}) {
  return (
    <Menu
      align="start"
      width={220}
      items={options.map((o) => ({
        label: o.label,
        checked: selected.includes(o.value),
        keepOpen: true,
        icon: o.color ? <span className="size-2 rounded-full" style={{ background: o.color }} /> : undefined,
        onSelect: () => onToggle(o.value),
      }))}
      trigger={(p) => (
        <Button
          size="sm"
          trailingIcon={<ChevronDown />}
          className={cn(selected.length > 0 && 'border-accent-line bg-accent-soft/60 text-accent-ink')}
          {...p}
        >
          {label}
          {selected.length > 0 && <span className="tabular-nums">· {selected.length}</span>}
        </Button>
      )}
    />
  );
}

/** Removable filter chip. */
export function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md bg-subtle pl-2 pr-0.5 text-xs text-ink-2">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="flex size-5 items-center justify-center rounded text-ink-3 hover:bg-muted hover:text-ink"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}
