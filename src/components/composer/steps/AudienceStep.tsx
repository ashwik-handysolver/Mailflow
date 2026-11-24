import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Search } from 'lucide-react';
import { Lead, LeadStatus } from '../../../types/outreach';
import { isValidEmail } from '../../../utils/leadHelpers';
import { Input } from '../../ui/Field';
import { Button } from '../../ui/Button';
import { Callout, EmptyState, SegmentedControl } from '../../ui/Misc';
import { FilterMenu, toggleIn } from '../../common/FilterMenu';
import { LEAD_STATUS_COLOR } from '../../common/StatusBadge';
import { LEAD_STATUSES } from '../../leads/LeadForm';
import { cn } from '../../../lib/cn';

interface AudienceStepProps {
  leads: Lead[];
  recipientIds: string[];
  onChange: (ids: string[]) => void;
}

export function AudienceStep({ leads, recipientIds, onChange }: AudienceStepProps) {
  const [view, setView] = useState<'all' | 'selected'>(recipientIds.length > 0 ? 'selected' : 'all');
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);

  const selected = useMemo(() => new Set(recipientIds), [recipientIds]);
  const allIndustries = useMemo(
    () => Array.from(new Set(leads.map((l) => l.industry).filter(Boolean))).sort(),
    [leads]
  );

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (view === 'selected' && !selected.has(l.id)) return false;
      if (statuses.length > 0 && !statuses.includes(l.status)) return false;
      if (industries.length > 0 && !industries.includes(l.industry)) return false;
      if (!q) return true;
      return [l.fullName, l.company, l.email].some((s) => s.toLowerCase().includes(q));
    });
  }, [leads, view, selected, statuses, industries, search]);

  const invalidSelected = leads.filter((l) => selected.has(l.id) && !isValidEmail(l.email));
  const allListed = list.length > 0 && list.every((l) => selected.has(l.id));
  const filtered = Boolean(search.trim()) || statuses.length > 0 || industries.length > 0;

  const toggle = (id: string) =>
    onChange(selected.has(id) ? recipientIds.filter((x) => x !== id) : [...recipientIds, id]);

  const toggleAllListed = () => {
    if (allListed) {
      const ids = new Set(list.map((l) => l.id));
      onChange(recipientIds.filter((id) => !ids.has(id)));
    } else {
      onChange(Array.from(new Set([...recipientIds, ...list.map((l) => l.id)])));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          ariaLabel="Show"
          value={view}
          onChange={setView}
          options={[
            { value: 'all', label: 'All leads', count: leads.length },
            { value: 'selected', label: 'Selected', count: recipientIds.length },
          ]}
        />
        <Input
          inputSize="sm"
          type="search"
          leadingIcon={<Search />}
          placeholder="Search leads"
          aria-label="Search leads"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:ml-auto sm:w-56"
        />
        <FilterMenu
          label="Status"
          selected={statuses}
          options={LEAD_STATUSES.map((s) => ({ value: s, label: s, color: LEAD_STATUS_COLOR[s] }))}
          onToggle={(v) => setStatuses((c) => toggleIn(c, v))}
        />
        <FilterMenu
          label="Industry"
          selected={industries}
          options={allIndustries.map((i) => ({ value: i, label: i }))}
          onToggle={(v) => setIndustries((c) => toggleIn(c, v))}
        />
      </div>

      {invalidSelected.length > 0 && (
        <Callout
          tone="danger"
          icon={<AlertTriangle />}
          title={`${invalidSelected.length} selected ${invalidSelected.length === 1 ? 'lead has' : 'leads have'} an invalid email`}
          action={
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-danger/10"
              onClick={() => onChange(recipientIds.filter((id) => !invalidSelected.some((l) => l.id === id)))}
            >
              Remove
            </Button>
          }
        >
          These emails would fail to send.
        </Callout>
      )}

      <div className="rounded-lg border border-line bg-surface">
        <label className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-2 text-ui text-ink-2 rounded-t-lg">
          <input type="checkbox" className="size-4" checked={allListed} disabled={list.length === 0} onChange={toggleAllListed} />
          {allListed ? 'Deselect' : 'Select'} {filtered || view === 'selected' ? 'these' : 'all'}{' '}
          <span className="tabular-nums text-ink-3">{list.length}</span>
        </label>

        {list.length === 0 ? (
          <EmptyState
            compact
            title={view === 'selected' && !filtered ? 'No recipients selected yet' : 'No leads match'}
            action={
              view === 'selected' && !filtered ? (
                <Button size="sm" onClick={() => setView('all')}>
                  Show all leads
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul aria-label="Leads" className="max-h-[calc(100dvh-20rem)] min-h-[240px] overflow-y-auto scrollbar-thin">
            {list.map((lead) => {
              const isSel = selected.has(lead.id);
              const bad = !isValidEmail(lead.email);
              return (
                <li key={lead.id} className="border-b border-line/70 last:border-b-0">
                  <button
                    type="button"
                    aria-pressed={isSel}
                    onClick={() => toggle(lead.id)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                      isSel ? 'bg-accent-soft/50 hover:bg-accent-soft/80' : 'hover:bg-canvas'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                        isSel ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface'
                      )}
                    >
                      {isSel && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui">
                        <span className="font-medium text-ink">{lead.fullName}</span>
                        {lead.company && <span className="text-ink-3"> · {lead.company}</span>}
                      </span>
                      <span className={cn('flex min-w-0 items-center gap-1 text-xs', bad ? 'text-danger' : 'text-ink-3')}>
                        {bad && <AlertTriangle className="size-3 shrink-0" aria-label="Invalid email" />}
                        <span className="truncate">{lead.email || 'No email'}</span>
                      </span>
                    </span>
                    <span className="hidden w-28 shrink-0 items-center justify-end gap-1.5 text-xs text-ink-2 md:flex">
                      <span className="size-1.5 rounded-full" style={{ background: LEAD_STATUS_COLOR[lead.status] }} aria-hidden="true" />
                      {lead.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
