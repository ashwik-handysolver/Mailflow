import { useEffect, useId, useRef, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { SegmentedControl } from '../ui/Misc';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';
import { toLocalIsoDate } from '../../utils/analytics';
import { DateRange, endOfDay, presetRange, RangePreset, startOfDay } from '../../utils/outreachAnalytics';

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 'custom', label: 'Custom' },
];

const MAX_DAYS = 366;

function fmt(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** 7/30/90-day presets plus a custom from–to range (validated, up to a year). */
export function DateRangeControl({
  preset,
  range,
  onChange,
}: {
  preset: RangePreset;
  range: DateRange;
  onChange: (preset: RangePreset, range: DateRange) => void;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(toLocalIsoDate(range.from));
  const [to, setTo] = useState(toLocalIsoDate(range.to));
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const apply = () => {
    const f = new Date(`${from}T00:00:00`);
    const t = new Date(`${to}T00:00:00`);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return setError('Pick both dates.');
    if (f > t) return setError('The start date must be before the end date.');
    if (t > endOfDay(new Date())) return setError("The end date can't be in the future.");
    if ((t.getTime() - f.getTime()) / 86_400_000 + 1 > MAX_DAYS) return setError('Pick a range of up to a year.');
    setError('');
    onChange('custom', { from: startOfDay(f), to: endOfDay(t) });
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-2" ref={panelRef}>
      {/* The active dates are always visible; clicking them edits the range. */}
      <button
        type="button"
        aria-label={`Date range ${fmt(range.from)} to ${fmt(range.to)}. Change dates`}
        onClick={() => {
          setFrom(toLocalIsoDate(range.from));
          setTo(toLocalIsoDate(range.to));
          setOpen(true);
        }}
        className="hidden h-7 items-center gap-1.5 rounded-md px-2 text-xs tabular-nums text-ink-2 hover:bg-subtle sm:inline-flex"
      >
        <CalendarRange className="size-3.5" aria-hidden="true" />
        {fmt(range.from)} – {fmt(range.to)}
      </button>
      <SegmentedControl
        ariaLabel="Date range"
        size="sm"
        value={preset}
        options={PRESETS}
        onChange={(v) => {
          if (v === 'custom') {
            setFrom(toLocalIsoDate(range.from));
            setTo(toLocalIsoDate(range.to));
            setOpen(true);
          } else onChange(v, presetRange(v));
        }}
      />
      {open && (
        <div
          role="dialog"
          aria-label="Custom date range"
          className="absolute right-0 top-full z-40 mt-2 w-[280px] rounded-lg border border-line bg-surface p-4 shadow-overlay"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-ink-2" htmlFor={`${uid}-from`}>
              From
              <input
                id={`${uid}-from`}
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-ui text-ink focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
            </label>
            <label className="text-xs font-medium text-ink-2" htmlFor={`${uid}-to`}>
              To
              <input
                id={`${uid}-to`}
                type="date"
                value={to}
                min={from}
                max={toLocalIsoDate(new Date())}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-ui text-ink focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
            </label>
          </div>
          {error && (
            <p className="mt-2 text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
