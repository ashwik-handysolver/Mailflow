import { Fragment, ReactNode, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, ListFilter, Search } from 'lucide-react';
import { Campaign, CampaignStatus } from '../../types/outreach';
import { CampaignStatusBadge } from '../common/StatusBadge';
import { Menu } from '../ui/Menu';
import { formatFullDateTime, formatShortDate } from '../../utils/analytics';
import { bounceRate, CampaignRow, deliveryRate, Summary, uniqueOpenRate } from '../../utils/outreachAnalytics';
import { cn } from '../../lib/cn';
import { LOW_SAMPLE } from './FunnelHero';

/** Used by the campaign detail panel. */
export function engagementLabel(c: Campaign, key: 'openRate' | 'clickRate'): string {
  if (c.engagementTracked === false || c.sentCount === 0) return '—';
  if (key === 'clickRate' && c.clicksTracked === false) return '—';
  return `${c[key].toFixed(1)}%`;
}

type SortKey = 'sentAt' | 'recipients' | 'delivered' | 'openRate' | 'bounceRate';
type StatusFilter = 'all' | CampaignStatus;

const SUM_KEYS = ['attempted', 'sent', 'delivered', 'failed', 'hardBounces', 'softBounces', 'openEligible', 'uniqueOpens', 'totalOpens'] as const;

/**
 * A table row: one campaign, or several sends that share a name and template
 * (the composer names sends "<template> · <date>", so repeated test sends look
 * alike). Groups aggregate their sends and expand to show each one; distinct
 * names are never merged.
 */
interface TableRow {
  key: string;
  name: string;
  template: string;
  sends: CampaignRow[];
  simulated: boolean;
  summary: Summary;
  recipients: number;
  sentAt: number;
  status: CampaignStatus;
  deliveryRate: number | null;
  openRate: number | null;
  bounceRate: number | null;
}

function toTableRows(rows: CampaignRow[]): TableRow[] {
  const groups = new Map<string, CampaignRow[]>();
  for (const r of rows) {
    const k = `${r.simulated ? 'sim' : 'real'}|${r.campaign.name}|${r.campaign.templateName}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()].map(([key, sends]) => {
    const summary = sends.reduce<Summary>(
      (acc, s) => {
        for (const k of SUM_KEYS) acc[k] += s.summary[k];
        return acc;
      },
      { attempted: 0, sent: 0, delivered: 0, failed: 0, hardBounces: 0, softBounces: 0, openEligible: 0, uniqueOpens: 0, totalOpens: 0 }
    );
    const simulated = sends[0].simulated;
    const statuses = new Set(sends.map((s) => s.campaign.status));
    const status: CampaignStatus = simulated
      ? 'Simulated'
      : statuses.has('Failed') && statuses.size === 1
      ? 'Failed'
      : statuses.has('Failed') || statuses.has('Partial')
      ? 'Partial'
      : 'Completed';
    return {
      key,
      name: sends[0].campaign.name,
      template: sends[0].campaign.templateName,
      sends: [...sends].sort((a, b) => new Date(b.campaign.sentAt).getTime() - new Date(a.campaign.sentAt).getTime()),
      simulated,
      summary,
      recipients: sends.reduce((n, s) => n + s.campaign.recipientCount, 0),
      sentAt: Math.max(...sends.map((s) => new Date(s.campaign.sentAt).getTime())),
      status,
      deliveryRate: simulated ? null : deliveryRate(summary),
      openRate: simulated ? null : uniqueOpenRate(summary),
      bounceRate: simulated ? null : bounceRate(summary),
    };
  });
}

/** Rate plus its numerator/denominator, so 100% of 1 doesn't read like 100% of 1,000. */
function RateCell({
  rate,
  num,
  den,
  danger,
  bar,
}: {
  rate: number | null;
  num?: number;
  den?: number;
  danger?: boolean;
  /** Inline comparison bar colour: aligned bars make campaigns comparable at a glance. */
  bar?: string;
}) {
  if (rate === null) return <span className="text-ink-4">—</span>;
  // Under LOW_SAMPLE emails, show the fraction itself and no bar: 1/1 is not a "100%" result.
  if (den !== undefined && den < LOW_SAMPLE) {
    return (
      <span
        className={cn('tabular-nums', danger && (num ?? 0) > 0 ? 'font-medium text-danger' : 'text-ink-2')}
        title={`${rate.toFixed(1)}% (low sample)`}
      >
        {num}/{den}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {bar && (
        <span className="hidden h-1 w-8 overflow-hidden rounded-full bg-muted xl:block" aria-hidden="true">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, rate)}%`, background: bar }} />
        </span>
      )}
      <span className={cn('tabular-nums', danger ? 'font-medium text-danger' : 'text-ink')} title={`${num}/${den}`}>
        {rate.toFixed(1)}%
      </span>
    </span>
  );
}

interface CampaignsTableProps {
  rows: CampaignRow[];
  onOpen: (campaign: Campaign) => void;
  /** Rows shown before "Show all". */
  limit?: number;
  /** Compact summary (dashboard): no search or filter, and a link to the full list instead of "Show all". */
  onViewAll?: () => void;
  /** Hide the section title (the page already names it). */
  hideTitle?: boolean;
  emptyText?: string;
  /** Show simulated sends without opening the filter (Campaigns page). */
  showSimulated?: boolean;
}

export function CampaignsTable({ rows, onOpen, limit = 8, onViewAll, hideTitle, emptyText = 'No campaigns in this period', showSimulated = false }: CampaignsTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'sentAt', dir: 'desc' });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [includeSimulated, setIncludeSimulated] = useState(showSimulated);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const all = useMemo(() => toTableRows(rows), [rows]);
  const simulatedCount = all.filter((r) => r.simulated).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = all.filter(
      (r) =>
        (includeSimulated || !r.simulated) &&
        (status === 'all' || r.status === status) &&
        (!q || r.name.toLowerCase().includes(q) || r.template.toLowerCase().includes(q))
    );
    const value = (r: TableRow): number | null =>
      sort.key === 'sentAt'
        ? r.sentAt
        : sort.key === 'recipients'
        ? r.recipients
        : sort.key === 'delivered'
        ? r.deliveryRate
        : sort.key === 'openRate'
        ? r.openRate
        : r.bounceRate;
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sort.dir === 'asc' ? va - vb : vb - va;
    });
  }, [all, query, status, includeSimulated, sort]);
  const LIMIT = limit;
  const shown = showAll ? visible : visible.slice(0, LIMIT);
  const filtersActive = status !== 'all' || includeSimulated !== showSimulated;

  const toggleGroup = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const openRow = (r: TableRow) => (r.sends.length > 1 ? toggleGroup(r.key) : onOpen(r.sends[0].campaign));

  const th = (key: SortKey | null, label: string, className?: string) => {
    const active = key !== null && sort.key === key;
    return (
      <th
        scope="col"
        className={cn('h-9 px-3 text-2xs font-medium uppercase tracking-[0.06em] text-ink-3', className)}
        aria-sort={key ? (active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
      >
        {key ? (
          <button
            type="button"
            onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}
            className={cn('inline-flex items-center gap-1 uppercase hover:text-ink focus-visible:outline-none focus-visible:text-ink', active && 'text-ink')}
          >
            {label}
            {active && (sort.dir === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
          </button>
        ) : (
          label
        )}
      </th>
    );
  };

  const cells = (r: TableRow | CampaignRow, child: boolean): ReactNode => {
    const s = 'summary' in r ? r.summary : (r as CampaignRow).summary;
    const isGroup = !child && 'sends' in r;
    const t = r as TableRow;
    const c = r as CampaignRow;
    const deliveryR = isGroup ? t.deliveryRate : c.deliveryRate;
    const openR = isGroup ? t.openRate : c.openRate;
    const bounceR = isGroup ? t.bounceRate : c.bounceRate;
    const recipients = isGroup ? t.recipients : c.campaign.recipientCount;
    return (
      <>
        <td className="px-3 text-right tabular-nums text-ink">{recipients}</td>
        <td className="px-3 text-right">
          <RateCell rate={deliveryR} num={s.delivered} den={s.sent} bar="var(--color-series-delivered)" />
        </td>
        <td className="hidden px-3 text-right md:table-cell">
          <RateCell rate={openR} num={s.uniqueOpens} den={s.openEligible} bar="var(--color-series-opened)" />
        </td>
        <td className="hidden px-3 text-right sm:table-cell">
          <RateCell rate={bounceR} num={s.hardBounces + s.softBounces} den={s.sent} danger={bounceR !== null && bounceR >= 5} />
        </td>
      </>
    );
  };

  return (
    <section aria-label="Campaigns">
      <header className={cn('mb-2.5 flex flex-wrap items-center gap-3', hideTitle ? 'justify-end' : 'justify-between')}>
        {!hideTitle && (
          <div className="flex items-center gap-1.5">
            <h2 className="text-heading font-semibold text-ink">{onViewAll ? 'Recent campaigns' : 'Campaigns'}</h2>
            <span className="text-ui tabular-nums text-ink-3">{visible.length}</span>
          </div>
        )}
        {onViewAll ? (
          <button type="button" onClick={onViewAll} className="text-xs font-medium text-accent hover:underline">
            View all
          </button>
        ) : (
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search campaigns</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaigns"
              className="h-8 w-44 rounded-md border border-line bg-surface pl-8 pr-2 text-ui text-ink placeholder:text-ink-4 transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 sm:w-56"
            />
          </label>
          <Menu
            width={200}
            items={[
              ...(['all', 'Completed', 'Partial', 'Failed'] as StatusFilter[]).map((v) => ({
                label: v === 'all' ? 'All statuses' : v,
                selected: status === v,
                onSelect: () => setStatus(v),
              })),
              {
                label: `Include simulated (${simulatedCount})`,
                checked: includeSimulated,
                keepOpen: true,
                separated: true,
                disabled: simulatedCount === 0,
                onSelect: () => setIncludeSimulated((v) => !v),
              },
            ]}
            trigger={(p) => (
              <button
                type="button"
                {...p}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-ui transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  filtersActive ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2 hover:bg-subtle'
                )}
              >
                <ListFilter className="size-3.5" aria-hidden="true" />
                Filter
                {filtersActive && <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />}
              </button>
            )}
          />
        </div>
        )}
      </header>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-ui text-ink-3">
            {all.length === 0 ? emptyText : 'No matches'}
          </p>
        ) : (
          <>
            {/* Desktop and tablet: table */}
            <div className="hidden overflow-x-auto scrollbar-thin md:block">
              <table className="w-full text-ui">
                <thead>
                  <tr className="border-b border-line bg-subtle/50 text-left">
                    {th(null, 'Campaign', 'pl-4')}
                    {th('recipients', 'Recipients', 'text-right')}
                    {th('delivered', 'Delivered', 'text-right')}
                    {th('openRate', 'Opens', 'hidden text-right md:table-cell')}
                    {th('bounceRate', 'Bounces', 'hidden text-right sm:table-cell')}
                    {th('sentAt', 'Sent', '')}
                    <th scope="col" className="w-8">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const isGroup = r.sends.length > 1;
                    const open = expanded.has(r.key);
                    return (
                      <Fragment key={r.key}>
                        <tr
                          onClick={() => openRow(r)}
                          className="group h-12 cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-subtle/60"
                        >
                          <td className="w-full max-w-0 pl-4 pr-3">
                            <button
                              type="button"
                              aria-expanded={isGroup ? open : undefined}
                              onClick={(e) => {
                                e.stopPropagation();
                                openRow(r);
                              }}
                              className="flex max-w-full min-w-0 items-center gap-2 text-left focus-visible:outline-none focus-visible:underline"
                            >
                              {isGroup && (
                                <ChevronRight className={cn('size-3.5 shrink-0 text-ink-3 transition-transform', open && 'rotate-90')} aria-hidden="true" />
                              )}
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink">{r.name}</span>
                                <span className="block truncate text-xs text-ink-3">{r.template}</span>
                              </span>
                              {isGroup && (
                                <span className="shrink-0 rounded-sm bg-subtle px-1.5 text-2xs font-medium tabular-nums text-ink-2">
                                  {r.sends.length} sends
                                </span>
                              )}
                              {r.simulated && <span className="shrink-0 rounded-sm bg-subtle px-1.5 text-2xs text-ink-3">Simulated</span>}
                              {!r.simulated && r.status !== 'Completed' && (
                                <span className="shrink-0">
                                  <CampaignStatusBadge status={r.status} />
                                </span>
                              )}
                            </button>
                          </td>
                          {cells(r, false)}
                          <td className="whitespace-nowrap px-3 tabular-nums text-ink-2" title={formatFullDateTime(new Date(r.sentAt).toISOString())}>
                            {formatShortDate(new Date(r.sentAt).toISOString())}
                          </td>
                          <td className="pr-3 text-ink-4 group-hover:text-ink-2">
                            {!isGroup && <ChevronRight className="size-4" aria-hidden="true" />}
                          </td>
                        </tr>
                        {isGroup &&
                          open &&
                          r.sends.map((s, i) => (
                            <tr
                              key={s.campaign.id}
                              onClick={() => onOpen(s.campaign)}
                              className="group h-10 cursor-pointer border-b border-line bg-subtle/30 text-ui transition-colors hover:bg-subtle/70"
                            >
                              <td className="pl-10 pr-3 text-ink-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpen(s.campaign);
                                  }}
                                  className="text-left focus-visible:outline-none focus-visible:underline"
                                >
                                  Send {r.sends.length - i}
                                  <span className="ml-2 text-xs text-ink-3">{formatFullDateTime(s.campaign.sentAt)}</span>
                                  {s.campaign.status !== 'Completed' && (
                                    <span className="ml-2 inline-block align-middle">
                                      <CampaignStatusBadge status={s.campaign.status} />
                                    </span>
                                  )}
                                </button>
                              </td>
                              {cells(s, true)}
                              <td className="whitespace-nowrap px-3 tabular-nums text-ink-3">{formatShortDate(s.campaign.sentAt)}</td>
                              <td className="pr-3 text-ink-4 group-hover:text-ink-2">
                                <ChevronRight className="size-4" aria-hidden="true" />
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <ul className="divide-y divide-line md:hidden">
              {shown.map((r) => (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.sends[0].campaign)}
                    className="block w-full px-4 py-3 text-left hover:bg-subtle/60 focus-visible:bg-subtle focus-visible:outline-none"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-ui font-medium text-ink">{r.name}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {r.template} · {formatShortDate(new Date(r.sentAt).toISOString())}
                          {r.sends.length > 1 && ` · ${r.sends.length} sends`}
                        </span>
                      </span>
                      <CampaignStatusBadge status={r.status} />
                    </span>
                    <span className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      {[
                        ['Delivered', r.deliveryRate, `${r.summary.delivered}/${r.summary.sent}`],
                        ['Opens', r.openRate, `${r.summary.uniqueOpens}/${r.summary.openEligible}`],
                        ['Bounces', r.bounceRate, `${r.summary.hardBounces + r.summary.softBounces}/${r.summary.sent}`],
                      ].map(([label, rate, frac]) => (
                        <span key={label as string}>
                          <span className="block text-ink-3">{label}</span>
                          <span className="font-medium tabular-nums text-ink">
                            {rate === null ? '—' : `${(rate as number).toFixed(1)}%`}
                          </span>{' '}
                          {rate !== null && <span className="tabular-nums text-ink-4">{frac}</span>}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {!onViewAll && visible.length > LIMIT && (
          <div className="border-t border-line px-4 py-2">
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-ui font-medium text-accent hover:underline">
              {showAll ? 'Show fewer' : `Show all ${visible.length}`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
