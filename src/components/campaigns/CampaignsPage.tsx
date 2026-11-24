import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, RefreshCw, Search } from 'lucide-react';
import { Campaign } from '../../types/outreach';
import { useNavigation, useWorkspace } from '../../app/WorkspaceContext';
import { supabase } from '../../lib/supabase';
import { checkBouncesNow, useDeliveryEvents, useDeliveryEventsStatus, refreshDeliveryEvents } from '../../utils/deliveryEvents';
import { buildFacts, campaignRows } from '../../utils/outreachAnalytics';
import { buildEmailLog, countEmails, EmailLogRow, EmailState } from '../../utils/emailLog';
import { useMailboxes } from '../../utils/mailboxes';
import { useEmailProvider } from '../../services/emailProvider';
import { PageContainer, PageHeader } from '../layout/PageHeader';
import { CampaignsTable } from '../dashboard/CampaignsTable';
import { rateText } from '../dashboard/FunnelHero';
import { CampaignStatusBadge } from '../common/StatusBadge';
import { AttachmentList } from '../common/AttachmentList';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { Callout, EmptyState } from '../ui/Misc';
import { FilterChips, InlineError, SkeletonRows } from '../ui/Feedback';
import { EmailList, EmailListActions, formatWhen } from './EmailList';
import { cn } from '../../lib/cn';

type Tab = 'campaigns' | 'emails';
type StateFilter = 'all' | 'delivered' | 'opened' | 'bounced' | 'failed' | 'simulated';

const PAGE_SIZE = 50;

function matches(row: EmailLogRow, f: StateFilter): boolean {
  if (f === 'all') return true;
  if (f === 'delivered') return row.state === 'delivered' || row.state === 'opened';
  return row.state === (f as EmailState);
}

/** Keeps the view in the URL (#/campaigns?tab=emails, ?campaign=<id>) so it can be bookmarked or shared. */
function writeUrl(tab: Tab, campaignId: string | null) {
  if (!window.location.hash.startsWith('#/campaigns')) return;
  const q = new URLSearchParams();
  if (campaignId) q.set('campaign', campaignId);
  else if (tab === 'emails') q.set('tab', 'emails');
  const next = `#/campaigns${q.toString() ? `?${q}` : ''}`;
  if (next !== window.location.hash) history.replaceState(null, '', next);
}

function readTab(): Tab {
  const query = window.location.hash.split('?')[1];
  return query && new URLSearchParams(query).get('tab') === 'emails' ? 'emails' : 'campaigns';
}

/** Addresses on the do-not-contact list, so bounced rows can show whether they are already suppressed. */
function useSuppressions() {
  const [set, setSet] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('suppressions').select('email');
    setSet(new Set((data ?? []).map((r: { email: string }) => r.email.toLowerCase())));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const add = async (email: string): Promise<boolean> => {
    if (!supabase) return false;
    const address = email.trim().toLowerCase();
    const { error } = await supabase
      .from('suppressions')
      .upsert({ email: address, reason: 'bounced' }, { onConflict: 'user_id,email', ignoreDuplicates: true });
    if (error) return false;
    setSet((s) => new Set(s).add(address));
    return true;
  };
  return { suppressed: set, add };
}

export function CampaignsPage() {
  const { campaigns, leads, addToast, applyDeliveryEvents } = useWorkspace();
  const { navigate, intent, clearIntent, openComposer } = useNavigation();
  const events = useDeliveryEvents();
  const eventsStatus = useDeliveryEventsStatus();
  const { mailboxes } = useMailboxes();
  const provider = useEmailProvider();
  const { suppressed, add } = useSuppressions();

  const [tab, setTab] = useState<Tab>(readTab);
  const [campaignId, setCampaignId] = useState<string | null>(intent.openCampaignId ?? null);
  const [checking, setChecking] = useState(false);
  const [emailSearch, setEmailSearch] = useState(intent.emailSearch ?? '');

  // Arriving from a link (dashboard, audit log, lead panel).
  useEffect(() => {
    if (intent.openCampaignId) setCampaignId(intent.openCampaignId);
    if (intent.emailSearch !== undefined) {
      setCampaignId(null);
      setTab('emails');
      setEmailSearch(intent.emailSearch);
    }
    if (intent.openCampaignId || intent.emailSearch !== undefined) clearIntent();
  }, [intent, clearIntent]);

  useEffect(() => writeUrl(tab, campaignId), [tab, campaignId]);

  // Sidebar "Campaigns" (plain #/campaigns) while a campaign is open goes back to the list.
  useEffect(() => {
    const onHash = () => {
      const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      if (!q.get('campaign')) setCampaignId(null);
      setTab(readTab());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const log = useMemo(() => buildEmailLog(campaigns, events), [campaigns, events]);
  const rows = useMemo(() => campaignRows(campaigns, buildFacts(campaigns, events)), [campaigns, events]);
  const campaign = campaignId ? campaigns.find((c) => c.id === campaignId) ?? null : null;

  const leadIds = useMemo(() => new Set(leads.map((l) => l.id)), [leads]);
  const mailboxById = useMemo(() => new Map((mailboxes ?? []).map((m) => [m.id, m.email])), [mailboxes]);

  const actions: EmailListActions = {
    leadExists: (id) => leadIds.has(id),
    onOpenLead: (id) => navigate('leads', { openLeadId: id }),
    onResend: (row) => openComposer({ leadIds: [row.leadId], templateId: row.templateId || null }),
    onSuppress: supabase
      ? async (row) => {
          const ok = await add(row.leadEmail);
          addToast(ok ? { type: 'success', title: `${row.leadEmail} won't be emailed again` } : { type: 'error', title: "Couldn't update the do-not-contact list" });
        }
      : undefined,
    suppressed,
    onOpenCampaign: (id) => {
      setCampaignId(id);
      document.getElementById('main')?.scrollTo({ top: 0 });
    },
    mailboxName: (id) => (id ? mailboxById.get(id) ?? null : null),
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      const { bounced, errors } = await checkBouncesNow();
      applyDeliveryEvents(await refreshDeliveryEvents());
      if (errors.length) addToast({ type: 'error', title: "Couldn't check every mailbox", description: errors[0] });
      else addToast({ type: 'success', title: bounced ? `Found ${bounced} new ${bounced === 1 ? 'bounce' : 'bounces'}` : 'No new bounces' });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : "Couldn't check for bounces" });
    } finally {
      setChecking(false);
    }
  };

  const refreshAction = !provider.isSimulated && (
    <Button size="sm" variant="secondary" leadingIcon={<RefreshCw className={cn(checking && 'animate-spin')} />} onClick={checkNow} disabled={checking}>
      Check bounces
    </Button>
  );

  if (campaign) {
    return (
      <PageContainer>
        <PageHeader title="Campaigns" count={campaigns.length} actions={refreshAction} />
        <CampaignDetail
          campaign={campaign}
          rows={log.filter((r) => r.campaignId === campaign.id)}
          actions={actions}
          onBack={() => setCampaignId(null)}
          onResendFailed={(ids) => openComposer({ leadIds: ids, templateId: campaign.templateId || null })}
          mailboxName={actions.mailboxName!}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Campaigns" count={campaigns.length} actions={refreshAction} />

      <div className="mb-5 flex items-center gap-5 border-b border-line" role="tablist" aria-label="Campaign views">
        {(
          [
            ['campaigns', 'Campaigns', campaigns.length],
            ['emails', 'All emails', log.length],
          ] as const
        ).map(([value, label, n]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              '-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 text-ui font-medium transition-colors focus-visible:outline-none focus-visible:text-ink',
              tab === value ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink'
            )}
          >
            {label}
            <span className="tabular-nums text-ink-4">{n}</span>
          </button>
        ))}
      </div>

      {eventsStatus === 'error' && (
        <div className="mb-4">
          <InlineError message="Couldn't load bounces and opens from the server." onRetry={() => void refreshDeliveryEvents().then(applyDeliveryEvents)} />
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Every email you send shows up here with its delivery status."
          action={
            <Button variant="primary" onClick={() => openComposer()}>
              Compose email
            </Button>
          }
        />
      ) : tab === 'campaigns' ? (
        <CampaignsTable rows={rows} onOpen={(c) => setCampaignId(c.id)} limit={25} hideTitle showSimulated emptyText="No campaigns yet" />
      ) : eventsStatus === 'loading' && log.length === 0 ? (
        <SkeletonRows rows={6} height="h-14" />
      ) : (
        <AllEmails key={emailSearch} log={log} actions={actions} initialSearch={emailSearch} mailboxes={mailboxes ?? []} />
      )}
    </PageContainer>
  );
}

/* ------------------------------------------------------------------ */

function useEmailFilters(rows: EmailLogRow[], initialSearch = '') {
  const [state, setState] = useState<StateFilter>('all');
  const [query, setQuery] = useState(initialSearch);
  const [mailbox, setMailbox] = useState<string>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const counts = useMemo(() => countEmails(rows), [rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        matches(r, state) &&
        (mailbox === 'all' || r.mailboxId === mailbox) &&
        (!q ||
          r.leadName.toLowerCase().includes(q) ||
          r.leadEmail.toLowerCase().includes(q) ||
          r.leadCompany.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          r.campaignName.toLowerCase().includes(q))
    );
  }, [rows, state, query, mailbox]);
  const options = [
    { value: 'all' as const, label: 'All', count: counts.all },
    { value: 'delivered' as const, label: 'Delivered', count: counts.delivered },
    { value: 'opened' as const, label: 'Opened', count: counts.opened },
    { value: 'bounced' as const, label: 'Bounced', count: counts.bounced },
    { value: 'failed' as const, label: 'Failed', count: counts.failed },
    ...(counts.simulated > 0 ? [{ value: 'simulated' as const, label: 'Simulated', count: counts.simulated }] : []),
  ];
  return { state, setState, query, setQuery, mailbox, setMailbox, limit, setLimit, filtered, options, counts };
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-ui text-ink placeholder:text-ink-4 transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 sm:w-64"
      />
    </label>
  );
}

function AllEmails({
  log,
  actions,
  initialSearch,
  mailboxes,
}: {
  log: EmailLogRow[];
  actions: EmailListActions;
  initialSearch: string;
  mailboxes: { id: string; email: string }[];
}) {
  const f = useEmailFilters(log, initialSearch);
  // Only offer the mailbox filter when emails actually came from more than one.
  const usedMailboxes = mailboxes.filter((m) => log.some((r) => r.mailboxId === m.id));
  const shown = f.filtered.slice(0, f.limit);

  return (
    <section aria-label="All emails">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <FilterChips label="Filter by status" value={f.state} onChange={(v) => { f.setState(v); f.setLimit(PAGE_SIZE); }} options={f.options} />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {usedMailboxes.length > 1 && (
            <Menu
              width={240}
              items={[
                { label: 'All mailboxes', selected: f.mailbox === 'all', onSelect: () => f.setMailbox('all') },
                ...usedMailboxes.map((m) => ({ label: m.email, selected: f.mailbox === m.id, onSelect: () => f.setMailbox(m.id) })),
              ]}
              trigger={(p) => (
                <button
                  type="button"
                  {...p}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-ui transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    f.mailbox !== 'all' ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2 hover:bg-subtle'
                  )}
                >
                  {f.mailbox === 'all' ? 'All mailboxes' : usedMailboxes.find((m) => m.id === f.mailbox)?.email}
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </button>
              )}
            />
          )}
          <div className="flex-1 sm:flex-none">
            <SearchBox value={f.query} onChange={f.setQuery} placeholder="Search recipient, subject or campaign" />
          </div>
        </div>
      </div>

      {f.filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState compact title={log.length === 0 ? 'No emails sent yet' : 'No emails match'} />
        </div>
      ) : (
        <>
          <EmailList rows={shown} showCampaign {...actions} />
          {f.filtered.length > shown.length && (
            <div className="mt-3 flex items-center justify-center gap-3 text-xs text-ink-3">
              <span className="tabular-nums">
                Showing {shown.length} of {f.filtered.length}
              </span>
              <Button size="sm" variant="secondary" onClick={() => f.setLimit((n) => n + PAGE_SIZE)}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function CampaignDetail({
  campaign,
  rows,
  actions,
  onBack,
  onResendFailed,
  mailboxName,
}: {
  campaign: Campaign;
  rows: EmailLogRow[];
  actions: EmailListActions;
  onBack: () => void;
  onResendFailed: (leadIds: string[]) => void;
  mailboxName: (id: string | null) => string | null;
}) {
  const f = useEmailFilters(rows);
  const c = f.counts;
  const simulated = campaign.status === 'Simulated' || (rows.length > 0 && c.simulated === rows.length);
  const sent = c.delivered + c.bounced;
  const failedIds = rows.filter((r) => r.state === 'failed' && actions.leadExists(r.leadId)).map((r) => r.leadId);
  const fromBoxes = [...new Set(rows.map((r) => mailboxName(r.mailboxId)).filter((x): x is string => Boolean(x)))];
  const shown = f.filtered.slice(0, f.limit);

  const stats: { label: string; value: string; sub?: string; tone?: string }[] = simulated
    ? [{ label: 'Recipients', value: String(rows.length || campaign.recipientCount) }]
    : [
        { label: 'Recipients', value: String(rows.length || campaign.recipientCount) },
        { label: 'Delivered', value: String(c.delivered), sub: sent ? rateText(c.delivered, sent) : undefined },
        {
          label: 'Opened',
          value: c.openTracked ? String(c.opened) : '—',
          sub: c.openTracked ? rateText(c.opened, c.openTracked) : 'Not tracked',
        },
        { label: 'Bounced', value: String(c.bounced), sub: sent && c.bounced ? rateText(c.bounced, sent) : undefined, tone: c.bounced ? 'text-warning' : undefined },
        { label: 'Failed', value: String(c.failed), tone: c.failed ? 'text-danger' : undefined },
      ];

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-ui text-ink-3 hover:text-ink focus-visible:outline-none focus-visible:underline">
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All campaigns
      </button>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-title font-semibold tracking-[-0.01em] text-ink">{campaign.name}</h2>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="mt-0.5 text-ui text-ink-3">
            {[campaign.templateName, `Sent ${formatWhen(new Date(campaign.sentAt).getTime())}`, fromBoxes.length ? `From ${fromBoxes.join(', ')}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {!simulated && failedIds.length > 0 && (
          <Button variant="secondary" onClick={() => onResendFailed(failedIds)}>
            Resend to {failedIds.length} failed
          </Button>
        )}
      </div>

      {simulated && (
        <div className="mb-5">
          <Callout tone="neutral" title="Simulated send">
            No real emails left MailFlow, so there's no delivery or open data.
          </Callout>
        </div>
      )}

      <dl className={cn('mb-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line', simulated ? 'grid-cols-1 sm:w-48' : 'grid-cols-2 sm:grid-cols-5')}>
        {stats.map((s) => (
          <div key={s.label} className="bg-surface px-4 py-3">
            <dt className="text-xs text-ink-3">{s.label}</dt>
            <dd className={cn('mt-0.5 text-metric font-semibold tabular-nums tracking-[-0.02em]', s.tone ?? 'text-ink')}>{s.value}</dd>
            {s.sub && <dd className="text-xs tabular-nums text-ink-3">{s.sub}</dd>}
          </div>
        ))}
      </dl>

      {campaign.attachments && campaign.attachments.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-heading font-semibold text-ink">Attachments</h3>
          <AttachmentList items={campaign.attachments} />
        </div>
      )}

      <section aria-label="Recipients">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-heading font-semibold text-ink">Recipients</h3>
            {!simulated && <FilterChips label="Filter recipients" value={f.state} onChange={f.setState} options={f.options.filter((o) => o.value !== 'simulated')} />}
          </div>
          {rows.length > 10 && <SearchBox value={f.query} onChange={f.setQuery} placeholder="Search recipients" />}
        </div>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface">
            <EmptyState compact title="No per-recipient records for this campaign" />
          </div>
        ) : f.filtered.length === 0 && !simulated ? (
          <div className="rounded-xl border border-line bg-surface">
            <EmptyState compact title="No recipients match" />
          </div>
        ) : (
          <>
            <EmailList rows={simulated ? rows : shown} {...actions} />
            {!simulated && f.filtered.length > shown.length && (
              <div className="mt-3 flex justify-center">
                <Button size="sm" variant="secondary" onClick={() => f.setLimit((n) => n + PAGE_SIZE)}>
                  Show more
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
