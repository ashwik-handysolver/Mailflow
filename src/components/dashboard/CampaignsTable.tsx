import { Fragment, ReactNode, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, ListFilter, Search } from 'lucide-react';
import { Campaign, CampaignStatus } from '../../types/outreach';
import { Badge, BadgeTone } from '../ui/Badge';
import { CARD } from '../ui/Card';
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

const STATUS_TONE: Record<CampaignStatus, BadgeTone> = { Completed: 'success', Partial: 'warning', Failed: 'danger', Simulated: 'neutral' };
const STATUS_HINT: Record<CampaignStatus, string> = {
  Completed: 'All emails were accepted for delivery',
  Partial: 'Some recipients failed',
  Failed: 'No emails could be sent',
  Simulated: 'Sent through the simulator; no real email left MailFlow',
};

/** Campaign status as a chip in its own column. */
export function StatusChip({ status }: { status: CampaignStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot title={STATUS_HINT[status]}>
      {status}
    </Badge>
  );
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
    <span className="inline-flex items-center justify-end gap-2" data-series={bar}>
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
  /** Render as a standalone card (dashboard). */
  card?: boolean;
}

export function CampaignsTable({ rows, onOpen, limit = 8, onViewAll, hideTitle, emptyText = 'No campaigns in this period', showSimulated = false, card = false }: CampaignsTableProps) {
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
  // Inset for the first and last columns: flush on a page, padded inside a card.
  const edgeL = card ? 'pl-5' : 'pl-0';
  const edgeR = card ? 'pr-5' : 'pr-0';
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
        className={cn('h-9 px-3 text-xs font-normal text-ink-3', className)}
        aria-sort={key ? (active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
      >
        {key ? (
          <button
            type="button"
            onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}
            className={cn('inline-flex items-center gap-1 hover:text-ink focus-visible:outline-none focus-visible:text-ink', active && 'text-ink')}
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
    <section aria-label="Campaigns" className={cn(card && cn(CARD, 'overflow-hidden'))}>
      <header className={cn('flex flex-wrap items-center gap-3', card ? 'px-5 pb-3 pt-5' : 'mb-2.5', hideTitle ? 'justify-end' : 'justify-between')}>
        {!hideTitle && (
          <div className="flex items-center gap-1.5">
            <h2 className={cn('tracking-[-0.01em] text-ink', card ? 'text-heading font-semibold' : 'text-[15px] font-medium')}>{onViewAll ? 'Recent campaigns' : 'Campaigns'}</h2>
          </div>
        )}
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-ink-2 transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
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

      <div>
        {visible.length === 0 ? (
          <p className={cn('py-6 text-ui text-ink-3', card && 'px-5')}>
            {all.length === 0 ? emptyText : 'No matches'}
          </p>
        ) : (
          <>
            {/* Desktop and tablet: table */}
            <div className="hidden overflow-x-auto scrollbar-thin md:block">
              <table className="w-full text-ui">
                <thead>
                  <tr className={cn('border-b border-line text-left', card && 'border-t bg-subtle/40')}>
                    {th(null, 'Campaign', edgeL)}
                    {th('recipients', 'Recipients', 'text-right')}
                    {th('delivered', 'Delivered', 'text-right')}
                    {th('openRate', 'Opens', 'hidden text-right md:table-cell')}
                    {th('bounceRate', 'Bounces', 'hidden text-right sm:table-cell')}
                    {th(null, 'Status', '')}
                    {th('sentAt', 'Sent', '')}
                    <th scope="col" className={cn('w-10', edgeR)}>
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
                          className="group h-14 cursor-pointer border-b border-line/70 transition-colors last:border-b-0 hover:bg-subtle/50"
                        >
                          <td className={cn('w-full max-w-0 pr-3', edgeL)}>
                            <button
                              type="button"
                              aria-expanded={isGroup ? open : undefined}
                              onClick={(e) => {
                                e.stopPropagation();
                                openRow(r);
                              }}
                              className="flex max-w-full min-w-0 items-center gap-2 text-left focus-visible:outline-none focus-visible:underline"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink">{r.name}</span>
                                <span className="block truncate text-xs text-ink-3">{r.template}</span>
                              </span>
                              {isGroup && (
                                <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-2xs font-medium tabular-nums text-ink-2">
                                  {r.sends.length} sends
                                </span>
                              )}
                            </button>
                          </td>
                          {cells(r, false)}
                          <td className="px-3">
                            <StatusChip status={r.status} />
                          </td>
                          <td className="whitespace-nowrap px-3 tabular-nums text-ink-2" title={formatFullDateTime(new Date(r.sentAt).toISOString())}>
                            {formatShortDate(new Date(r.sentAt).toISOString())}
                          </td>
                          <td className={cn('text-right text-ink-4 group-hover:text-ink-2', edgeR)}>
                            {/* Same place on every row: groups expand (chevron turns down), single sends open. */}
                            <ChevronRight className={cn('ml-auto size-4 transition-transform', isGroup && open && 'rotate-90')} aria-hidden="true" />
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
                              <td className={cn('pr-3 text-ink-2', card ? 'pl-9' : 'pl-4')}>
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
                                </button>
                              </td>
                              {cells(s, true)}
                              <td className="px-3">
                                <StatusChip status={s.campaign.status} />
                              </td>
                              <td className="whitespace-nowrap px-3 tabular-nums text-ink-3">{formatShortDate(s.campaign.sentAt)}</td>
                              <td className={cn('text-right text-ink-4 group-hover:text-ink-2', edgeR)}>
                                <ChevronRight className="ml-auto size-4" aria-hidden="true" />
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
            <ul className={cn('divide-y divide-line/70 md:hidden', card && 'border-t border-line')}>
              {shown.map((r) => (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.sends[0].campaign)}
                    className={cn('block w-full py-3 text-left focus-visible:bg-subtle focus-visible:outline-none', card && 'px-5')}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-ui font-medium text-ink">{r.name}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {r.template} · {formatShortDate(new Date(r.sentAt).toISOString())}
                          {r.sends.length > 1 && ` · ${r.sends.length} sends`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <StatusChip status={r.status} />
                        <ChevronRight className="size-4 text-ink-4" aria-hidden="true" />
                      </span>
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
          <div className={cn('pt-3', card && 'px-5 pb-4')}>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-ui font-medium text-accent hover:underline">
              {showAll ? 'Show fewer' : `Show all ${visible.length}`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
