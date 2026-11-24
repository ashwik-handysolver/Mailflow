import { useCallback, useEffect, useMemo, useState } from 'react';
import { Campaign, LeadStatus } from '../../types/outreach';
import { useNavigation, useWorkspace } from '../../app/WorkspaceContext';
import { formatRelativeTime, formatShortDate, toLocalIsoDate } from '../../utils/analytics';
import { dueFollowUps, FOLLOW_UP_AFTER_DAYS } from '../../utils/followUps';
import { useDeliveryEvents, useDeliveryEventsStatus, refreshDeliveryEvents } from '../../utils/deliveryEvents';
import { listMailboxes, SendingMailbox } from '../../utils/mailboxes';
import { buildActivity, rankLeads } from '../../utils/dashboardData';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/cn';
import {
  buildFacts,
  campaignRows,
  dailySeries,
  DateRange,
  EmailFact,
  endOfDay,
  inRange,
  pct,
  presetRange,
  RangePreset,
  startOfDay,
  summarize,
} from '../../utils/outreachAnalytics';
import { PageContainer, PageHeader } from '../layout/PageHeader';
import { CardAction } from '../ui/Card';
import { CampaignsTable } from './CampaignsTable';
import { DateRangeControl } from './DateRangeControl';
import { RecordRow, RecordsDrawer, RecordsView } from './RecordsDrawer';
import { FunnelHero, FunnelStage, LOW_SAMPLE } from './FunnelHero';
import { BOUNCE_LIMIT } from './OutreachChart';
import { EngagedLeads } from './EngagedLeads';
import {
  ActItem,
  ActNowList,
  HealthBadge,
  HealthRow,
  HealthState,
  InlineError,
  PipelineSnapshot,
  RailSection,
  RecentActivity,
  SendingHealth,
  Severity,
  SkeletonRows,
} from './DashboardModules';

const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Not Interested'];
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, task: 2 };
const INTERESTED_NUDGE_DAYS = 3;
const ACTIVITY_LIMIT = 8;

interface Unsubscribe {
  email: string;
  reason: string;
  created_at: string;
}

const shortRange = (r: DateRange) =>
  `${r.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${r.to.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`;

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/* ---------- Range in the URL (#/dashboard?range=30), so a view can be shared or bookmarked ---------- */

function readRangeFromUrl(): { preset: RangePreset; range: DateRange } {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const r = q.get('range');
  if (r === '7' || r === '30' || r === '90') return { preset: Number(r) as RangePreset, range: presetRange(Number(r)) };
  const from = q.get('from');
  const to = q.get('to');
  if (from && to) {
    const f = new Date(`${from}T00:00:00`);
    const t = new Date(`${to}T00:00:00`);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime()) && f <= t)
      return { preset: 'custom', range: { from: startOfDay(f), to: endOfDay(t) } };
  }
  return { preset: 30, range: presetRange(30) };
}

function writeRangeToUrl(preset: RangePreset, range: DateRange) {
  // Only while the dashboard is the current route; never overwrite a navigation to another page.
  if (!window.location.hash.startsWith('#/dashboard') && window.location.hash !== '' && window.location.hash !== '#/') return;
  const q = new URLSearchParams();
  if (preset === 'custom') {
    q.set('from', toLocalIsoDate(range.from));
    q.set('to', toLocalIsoDate(range.to));
  } else q.set('range', String(preset));
  // replaceState doesn't fire hashchange, so routing is unaffected.
  window.history.replaceState(null, '', `#/dashboard?${q.toString()}`);
}

export function DashboardPage() {
  const { leads, campaigns, settings } = useWorkspace();
  const { navigate, openComposer } = useNavigation();
  const events = useDeliveryEvents();
  const eventsStatus = useDeliveryEventsStatus();

  const [{ preset, range }, setView] = useState(readRangeFromUrl);
  useEffect(() => writeRangeToUrl(preset, range), [preset, range]);

  const [records, setRecords] = useState<RecordsView | null>(null);

  // ----- Server-side context (signed-in only), each with its own loading/error state -----
  const [mailboxes, setMailboxes] = useState<SendingMailbox[] | null>(supabase ? null : []);
  const [mailboxError, setMailboxError] = useState(false);
  const loadMailboxes = useCallback(() => {
    if (!supabase) return;
    setMailboxError(false);
    setMailboxes(null);
    listMailboxes().then(setMailboxes, () => setMailboxError(true));
  }, []);
  const [unsubscribes, setUnsubscribes] = useState<Unsubscribe[] | null>(supabase ? null : []);
  const [unsubError, setUnsubError] = useState(false);
  const loadUnsubscribes = useCallback(() => {
    if (!supabase) return;
    setUnsubError(false);
    setUnsubscribes(null);
    supabase
      .from('suppressions')
      .select('email, reason, created_at')
      .in('reason', ['unsubscribed', 'replied unsubscribe'])
      .then(({ data, error }) => (error ? setUnsubError(true) : setUnsubscribes((data ?? []) as Unsubscribe[])));
  }, []);
  useEffect(() => {
    loadMailboxes();
    loadUnsubscribes();
  }, [loadMailboxes, loadUnsubscribes]);

  // ----- Data (real sends only; simulated sends never count) -----
  const facts = useMemo(() => buildFacts(campaigns, events), [campaigns, events]);
  const current = useMemo(() => facts.filter((f) => inRange(f.sentAt, range)), [facts, range]);
  const cur = useMemo(() => summarize(current), [current]);
  const series = useMemo(() => dailySeries(facts, range), [facts, range]);
  const rows = useMemo(
    () => campaignRows(campaigns.filter((c) => inRange(new Date(c.sentAt).getTime(), range)), facts),
    [campaigns, facts, range]
  );
  const engaged = useMemo(() => rankLeads(leads, current), [leads, current]);
  const unsubsInRange = (unsubscribes ?? []).filter((u) => inRange(new Date(u.created_at).getTime(), range));
  const activity = useMemo(
    () => buildActivity({ campaigns, facts, events, unsubscribes: unsubscribes ?? [], leads, range }).slice(0, ACTIVITY_LIMIT),
    [campaigns, facts, events, unsubscribes, leads, range]
  );
  const weekStart = presetRange(7).from.getTime();
  const allInLastWeek = preset !== 7 && current.length > 0 && current.every((f) => f.sentAt >= weekStart);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length])) as Record<LeadStatus, number>;

  // ----- Drill-downs: every number opens the records behind it -----
  const openLead = (id: string) => {
    setRecords(null);
    navigate('leads', { openLeadId: id });
  };
  const emailLeads = (ids: string[]) => {
    setRecords(null);
    openComposer({ leadIds: ids });
  };
  const factRow = (f: EmailFact): RecordRow => ({
    id: `${f.campaignId}-${f.leadId}`,
    primary: f.leadName,
    secondary: `${f.leadEmail} · ${f.campaignName}`,
    meta: formatShortDate(new Date(f.sentAt).toISOString()),
    note: f.reason,
    noteTone: 'danger',
    onSelect: leads.some((l) => l.id === f.leadId) ? () => openLead(f.leadId) : undefined,
  });
  const showFacts = (title: string, fs: EmailFact[]) => setRecords({ title, rows: fs.map(factRow) });
  const byOutcome = (...o: EmailFact['outcome'][]) => current.filter((f) => o.includes(f.outcome));
  const showLeads = (title: string, ids: string[], meta: (id: string) => string | undefined) =>
    setRecords({
      title,
      rows: ids.map((id) => {
        const l = leads.find((x) => x.id === id)!;
        return {
          id,
          primary: l.fullName,
          secondary: [l.company, l.status].filter(Boolean).join(' · '),
          meta: meta(id),
          onSelect: () => openLead(id),
        };
      }),
      action: { label: `Email all ${ids.length}`, onClick: () => emailLeads(ids) },
    });
  const openStage = (stage: FunnelStage) => {
    if (stage === 'sent') showFacts('Sent', byOutcome('delivered', 'hard_bounce', 'soft_bounce'));
    else if (stage === 'delivered') showFacts('Delivered', byOutcome('delivered'));
    else if (stage === 'opened') showFacts('Opened', current.filter((f) => f.opened));
    else if (stage === 'bounced') showFacts('Bounced', byOutcome('hard_bounce', 'soft_bounce'));
    else showFacts('Failed to send', byOutcome('failed'));
  };
  const openCampaignById = (id: string) => {
    navigate('campaigns', { openCampaignId: id });
  };

  // ----- Act now: ordered by severity, each with why and one direct action -----
  const followUps = useMemo(() => dueFollowUps(leads), [leads]);
  const neverContacted = useMemo(() => leads.filter((l) => l.status === 'New' && !l.lastContacted), [leads]);
  const interestedWaiting = useMemo(() => {
    const overdue = new Set(followUps.map((l) => l.id));
    const cutoff = Date.now() - INTERESTED_NUDGE_DAYS * 86_400_000;
    return leads.filter((l) => l.status === 'Interested' && !overdue.has(l.id) && l.lastContacted && new Date(l.lastContacted).getTime() < cutoff);
  }, [leads, followUps]);
  const lastContact = (id: string) => {
    const l = leads.find((x) => x.id === id);
    return l?.lastContacted ? formatRelativeTime(l.lastContacted) : 'Never';
  };

  const act: ActItem[] = [];
  const broken = (mailboxes ?? []).filter((m) => m.status !== 'active');
  if (broken.length > 0)
    act.push({
      id: 'mailbox',
      severity: 'critical',
      title: broken.length === 1 ? 'Sending mailbox stopped' : `${broken.length} sending mailboxes stopped`,
      why: broken[0].last_error ?? `${broken[0].email} is paused`,
      count: broken.length,
      onOpen: () => navigate('settings'),
      openLabel: 'Open Settings',
    });
  const badCampaigns = rows.filter((r) => !r.simulated && r.bounceRate !== null && r.bounceRate >= 5 && r.summary.sent >= 5);
  if (badCampaigns.length > 0)
    act.push({
      id: 'bounce',
      severity: 'critical',
      title: 'High bounce rate',
      why: 'Over 5% bounced; hurts sender reputation',
      count: badCampaigns.length,
      openLabel: 'Review campaigns',
      onOpen: () =>
        setRecords({
          title: 'Campaigns over 5% bounce rate',
          rows: badCampaigns.map((r) => ({
            id: r.campaign.id,
            primary: r.campaign.name,
            secondary: `${r.summary.hardBounces + r.summary.softBounces} of ${r.summary.sent} bounced`,
            meta: `${r.bounceRate!.toFixed(1)}%`,
            onSelect: () => {
              setRecords(null);
              navigate('campaigns', { openCampaignId: r.campaign.id });
            },
          })),
        }),
    });
  const invalid = byOutcome('hard_bounce');
  if (invalid.length > 0)
    act.push({
      id: 'invalid',
      severity: 'warning',
      title: 'Invalid email addresses',
      why: 'Blocked from future sends',
      count: invalid.length,
      openLabel: 'Review bounced list',
      onOpen: () => showFacts('Invalid email addresses', invalid),
    });
  const failed = byOutcome('failed');
  if (failed.length > 0)
    act.push({
      id: 'failed',
      severity: 'warning',
      title: 'Failed sends',
      why: 'Rejected by the mail server',
      count: failed.length,
      openLabel: 'Review failed sends',
      onOpen: () => showFacts('Failed to send', failed),
    });
  if (followUps.length > 0)
    act.push({
      id: 'followups',
      severity: 'task',
      title: 'Follow-ups due',
      why: `No contact in ${FOLLOW_UP_AFTER_DAYS}+ days`,
      count: followUps.length,
      openLabel: 'View leads',
      onOpen: () => showLeads('Follow-ups due', followUps.map((l) => l.id), lastContact),
      action: { label: `Email ${followUps.length === 1 ? 'them' : `all ${followUps.length}`}`, onClick: () => emailLeads(followUps.map((l) => l.id)) },
    });
  if (interestedWaiting.length > 0)
    act.push({
      id: 'interested',
      severity: 'task',
      title: 'Interested leads waiting',
      why: `Last contacted ${INTERESTED_NUDGE_DAYS}+ days ago`,
      count: interestedWaiting.length,
      openLabel: 'View leads',
      onOpen: () => showLeads('Interested leads waiting', interestedWaiting.map((l) => l.id), lastContact),
      action: { label: 'Email them', onClick: () => emailLeads(interestedWaiting.map((l) => l.id)) },
    });
  if (neverContacted.length > 0)
    act.push({
      id: 'never',
      severity: 'task',
      title: 'Never contacted',
      count: neverContacted.length,
      openLabel: 'View leads',
      onOpen: () => showLeads('Never contacted', neverContacted.map((l) => l.id), (id) => `Added ${formatShortDate(leads.find((l) => l.id === id)!.createdAt)}`),
      action: { label: 'Start a campaign', onClick: () => emailLeads(neverContacted.map((l) => l.id)) },
    });
  act.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const urgent = act.filter((a) => a.severity !== 'task').length;

  // ----- Sending health -----
  const active = (mailboxes ?? []).filter((m) => m.status === 'active');
  const sentToday = active.reduce((n, m) => n + m.sentToday, 0);
  const limit = active.reduce((n, m) => n + m.daily_limit, 0);
  const hardRate = pct(cur.hardBounces, cur.sent);
  const lastCheck = active
    .map((m) => m.last_bounce_check_at)
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop();
  const checkError = active.find((m) => m.last_bounce_check_error)?.last_bounce_check_error;
  // Hard bounces drive sender reputation, so the row carries a meter against the limit.
  const hardRow: HealthRow = {
    label: 'Hard bounces',
    value:
      hardRate === null
        ? 'Nothing sent'
        : cur.sent < LOW_SAMPLE
        ? `${cur.hardBounces} of ${cur.sent} (${hardRate.toFixed(0)}%)`
        : `${hardRate.toFixed(1)}%`,
    tone: hardRate === null ? 'muted' : hardRate > BOUNCE_LIMIT ? 'bad' : cur.hardBounces > 0 ? 'warn' : 'ok',
    gauge: hardRate === null ? undefined : { value: hardRate, limit: BOUNCE_LIMIT },
  };
  const healthRows: HealthRow[] = !supabase
    ? [
        { label: 'Mode', value: 'Simulation: no real email is sent', tone: 'muted' },
        ...(hardRate === null ? [] : [hardRow]),
        { label: 'Open tracking', value: settings.openTrackingEnabled ? 'On' : 'Off', tone: 'muted' },
      ]
    : [
        {
          label: 'Mailbox',
          value: active.length === 0 ? 'Not connected' : active.length === 1 ? active[0].email : `${active.length} active`,
          tone: active.length === 0 ? 'bad' : 'ok',
          action: active.length === 0 ? { label: 'Connect', onClick: () => navigate('settings') } : undefined,
        },
        ...(active.length > 0
          ? [{ label: 'Today', value: `${sentToday} of ${limit} sent`, meter: limit > 0 ? sentToday / limit : 0, tone: (sentToday >= limit ? 'warn' : 'ok') as HealthRow['tone'] }]
          : []),
        hardRow,
        {
          label: 'Unsubscribes',
          value: unsubError ? 'Couldn\'t load' : unsubscribes === null ? '…' : String(unsubsInRange.length),
          tone: unsubError ? 'bad' : 'ok',
          action: unsubError ? { label: 'Retry', onClick: loadUnsubscribes } : undefined,
        },
        {
          label: 'Bounce checks',
          value: checkError ? 'Inbox unreadable' : lastCheck ? formatRelativeTime(lastCheck) : 'Not yet run',
          tone: checkError ? 'bad' : lastCheck ? 'ok' : 'muted',
        },
        {
          label: 'Open tracking',
          value: settings.openTrackingEnabled ? 'On' : 'Off',
          tone: settings.openTrackingEnabled ? 'ok' : 'muted',
          action: settings.openTrackingEnabled ? undefined : { label: 'Turn on', onClick: () => navigate('settings') },
        },
      ];
  const healthIssue = healthRows.some((r) => r.tone === 'bad');
  const healthState: HealthState = healthIssue
    ? 'risk'
    : healthRows.some((r) => r.tone === 'warn')
    ? 'attention'
    : supabase
    ? 'healthy'
    : 'simulation';

  // ----- Header -----
  const firstName = settings.userName.split(' ')[0] || 'there';
  const status = [
    cur.attempted === 0 ? 'Nothing sent in this period' : `${cur.sent} sent`,
    cur.sent > 0 ? `${pct(cur.delivered, cur.sent)!.toFixed(0)}% delivered` : null,
    urgent > 0 ? `${urgent} ${urgent === 1 ? 'issue' : 'issues'}` : null,
    mailboxes === null
      ? null
      : healthIssue
      ? `sending needs attention${hardRate !== null && hardRate > BOUNCE_LIMIT && cur.sent < LOW_SAMPLE ? ' (low sample)' : ''}`
      : supabase
      ? 'sending healthy'
      : 'simulation mode',
  ]
    .filter(Boolean)
    .join(' · ');

  const actNow = (
    <ActNowList items={act} />
  );

  return (
    <div className="min-h-full bg-canvas">
      <PageHeader
        wide
        title={`${greeting()}, ${firstName}`}
        description={
          <span className="inline-flex items-center gap-2">
            {status}
            {eventsStatus === 'loading' && <span className="text-ink-4">· syncing delivery data…</span>}
          </span>
        }
        actions={
          <div className="flex items-center">
            <DateRangeControl preset={preset} range={range} onChange={(p, r) => setView({ preset: p, range: r })} />
          </div>
        }
      />

      <PageContainer wide className="pt-5 lg:pt-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-12">
          {/* Briefing column */}
          <div className="min-w-0 space-y-4 sm:space-y-6 xl:col-span-8">
            {/* Below xl, Act now leads the page. */}
            <div className="xl:hidden">
              <RailSection title="Act now" meta={act.length || undefined} first>
                {actNow}
              </RailSection>
            </div>

            <FunnelHero
              cur={cur}
              series={series}
              onOpenStage={openStage}
              onEnableTracking={() => navigate('settings')}
              emptyRangeLabel={shortRange(range)}
              onCompose={() => openComposer()}
              onWiderRange={preset === 90 ? undefined : () => setView({ preset: 90, range: presetRange(90) })}
              onNarrowRange={allInLastWeek ? () => setView({ preset: 7, range: presetRange(7) }) : undefined}
            />

            {eventsStatus === 'error' && (
              <InlineError message="Couldn't load bounces and opens from the server. Numbers may be out of date." onRetry={() => void refreshDeliveryEvents()} />
            )}

            <EngagedLeads items={engaged} onOpenLead={(id) => openLead(id)} onFollowUp={emailLeads} />

            <CampaignsTable card rows={rows} onOpen={(c) => navigate('campaigns', { openCampaignId: c.id })} limit={5} onViewAll={() => navigate('campaigns')} />
          </div>

          {/* Action rail: on the canvas, divided by hairlines; scrolls with the page. */}
          <aside aria-label="Action rail" className="grid min-w-0 content-start gap-4 sm:gap-6 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
            <div className="hidden xl:block">
              <RailSection title="Act now" meta={act.length || undefined} first>
                {actNow}
              </RailSection>
            </div>

            <RailSection title="Pipeline" meta={leads.length} first>
              <PipelineSnapshot counts={counts} onSelect={(s) => navigate('leads', { leadStatus: s })} />
            </RailSection>

            <RailSection
              title="Sending health"
              tip={`Keep hard bounces under ${BOUNCE_LIMIT}%`}
              action={
                <div className="flex items-center gap-1">
                  {mailboxes !== null && !mailboxError && <HealthBadge state={healthState} />}
                  {supabase && <CardAction onClick={() => navigate('settings')}>Settings</CardAction>}
                </div>
              }
            >
              {mailboxError ? (
                <InlineError message="Couldn't load your sending mailboxes." onRetry={loadMailboxes} />
              ) : mailboxes === null ? (
                <SkeletonRows rows={4} />
              ) : (
                <SendingHealth rows={healthRows} />
              )}
            </RailSection>

            <RailSection
              title="Recent activity"
              action={
                <CardAction onClick={() => navigate('audit')}>Full log</CardAction>
              }
            >
              {eventsStatus === 'loading' && events.length === 0 && supabase ? (
                <SkeletonRows rows={4} height="h-9" />
              ) : (
                <RecentActivity
                  entries={activity}
                  onOpen={(e) => (e.campaignId && !e.leadId ? openCampaignById(e.campaignId) : e.leadId ? openLead(e.leadId) : undefined)}
                />
              )}
            </RailSection>
          </aside>
        </div>
      </PageContainer>

      <RecordsDrawer view={records} onClose={() => setRecords(null)} />
    </div>
  );
}
