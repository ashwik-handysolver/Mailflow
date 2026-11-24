import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadWorkspace, saveChanges } from './cloudSync';
import {
  buildInitialDailyMetrics,
  DEFAULT_SETTINGS,
  INITIAL_ACTIVITIES,
  INITIAL_CAMPAIGNS,
  INITIAL_LEADS,
  INITIAL_TEMPLATES,
} from '../data/mockData';
import {
  ActivityLogItem,
  Campaign,
  DailyMetricPoint,
  EmailActivityRecord,
  EmailTemplate,
  Lead,
  LeadStatus,
  TeamSettings,
  ToastMessage,
} from '../types/outreach';
import { toLocalIsoDate } from '../utils/analytics';
import { clearFiles } from '../utils/attachmentStore';
import type { DeliveryEvent } from '../utils/deliveryEvents';

const STORAGE_KEY = 'mailflow_workspace_state_v1';

interface PersistedWorkspaceState {
  leads: Lead[];
  templates: EmailTemplate[];
  campaigns: Campaign[];
  activities: ActivityLogItem[];
  dailyMetrics: DailyMetricPoint[];
  settings: TeamSettings;
}

/**
 * Adds today's sends to the metrics series. Days between the last recorded
 * point and today are filled with zeros so the chart timeline stays honest.
 */
function addToTodaysMetrics(
  metrics: DailyMetricPoint[],
  delta: { sent: number; delivered: number; tracked?: boolean }
): DailyMetricPoint[] {
  const untrackedDelta = delta.tracked ? 0 : delta.delivered;
  const todayIso = toLocalIsoDate(new Date());
  const next = [...metrics];
  const last = next[next.length - 1];

  if (last && last.date === todayIso) {
    next[next.length - 1] = {
      ...last,
      sent: last.sent + delta.sent,
      delivered: last.delivered + delta.delivered,
      untracked: (last.untracked ?? 0) + untrackedDelta,
    };
    return next;
  }

  const cursor = last ? new Date(`${last.date}T12:00:00`) : new Date();
  if (last) cursor.setDate(cursor.getDate() + 1);
  while (toLocalIsoDate(cursor) < todayIso) {
    next.push(emptyMetricPoint(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  next.push({
    ...emptyMetricPoint(new Date()),
    sent: delta.sent,
    delivered: delta.delivered,
    untracked: untrackedDelta,
  });
  return next;
}

function emptyMetricPoint(d: Date): DailyMetricPoint {
  return {
    date: toLocalIsoDate(d),
    label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
  };
}

/** Profile and sender details for a signed-in account, in place of the demo persona. */
function accountSettings(settings: TeamSettings, email: string, fullName?: string): TeamSettings {
  const name =
    fullName?.trim() ||
    email
      .split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');
  return {
    ...settings,
    userName: name,
    userRole: '',
    teamName: '',
    senderDisplayName: name,
    senderEmail: email,
    defaultSignatureHtml: `<p>Best regards,<br/><strong>${name}</strong></p>`,
  };
}

function getDefaultState(): PersistedWorkspaceState {
  return {
    leads: INITIAL_LEADS,
    templates: INITIAL_TEMPLATES,
    campaigns: INITIAL_CAMPAIGNS,
    activities: INITIAL_ACTIVITIES,
    dailyMetrics: buildInitialDailyMetrics(),
    settings: DEFAULT_SETTINGS,
  };
}

function loadStateFromStorage(): PersistedWorkspaceState {
  if (typeof window === 'undefined') return getDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspaceState>;
    const defaults = getDefaultState();
    return {
      leads: Array.isArray(parsed.leads) && parsed.leads.length > 0 ? parsed.leads : defaults.leads,
      templates:
        Array.isArray(parsed.templates) && parsed.templates.length > 0
          ? parsed.templates
          : defaults.templates,
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : defaults.campaigns,
      activities: Array.isArray(parsed.activities) ? parsed.activities : defaults.activities,
      dailyMetrics:
        Array.isArray(parsed.dailyMetrics) && parsed.dailyMetrics.length > 0
          ? parsed.dailyMetrics
          : defaults.dailyMetrics,
      settings: parsed.settings ? { ...defaults.settings, ...parsed.settings } : defaults.settings,
    };
  } catch {
    return getDefaultState();
  }
}

export type SyncStatus = 'local' | 'loading' | 'load-error' | 'synced' | 'saving' | 'error';

/**
 * Workspace state. With a Supabase client (signed in), the cloud copy is the
 * source of truth: it is loaded on start and every change is written back.
 * Browser storage is kept as an offline cache either way.
 */
export function useOutreachStore(db: SupabaseClient | null = null) {
  const [state, setState] = useState<PersistedWorkspaceState>(() => loadStateFromStorage());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(db ? 'loading' : 'local');
  /** Last snapshot known to be in the cloud; null until the first load finishes. */
  const savedRef = useRef<PersistedWorkspaceState | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load from the cloud once. A brand-new account is seeded with this browser's data.
  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    (async () => {
      try {
        const [remote, { data: auth }] = await Promise.all([loadWorkspace(db), db.auth.getUser()]);
        if (cancelled) return;
        let current: PersistedWorkspaceState;
        if (remote) {
          current = remote;
        } else {
          current = stateRef.current;
          await saveChanges(db, null, current);
          if (cancelled) return;
        }
        savedRef.current = current;
        // Replace the demo profile with the signed-in account; the save effect writes it back.
        const email = auth.user?.email;
        const next =
          email && current.settings.senderEmail === DEFAULT_SETTINGS.senderEmail
            ? { ...current, settings: accountSettings(current.settings, email, auth.user?.user_metadata?.full_name) }
            : current;
        setState(next);
        setSyncStatus('synced');
      } catch {
        if (!cancelled) setSyncStatus('load-error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  // Write changes back, batched so quick edits become one save.
  useEffect(() => {
    if (!db || !savedRef.current || savedRef.current === state) return;
    setSyncStatus('saving');
    const timer = window.setTimeout(async () => {
      const prev = savedRef.current;
      try {
        await saveChanges(db, prev, state);
        savedRef.current = state;
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
        // Kept locally; the next change retries everything not yet saved.
        setToasts((prev) =>
          prev.some((t) => t.id === 'sync_error')
            ? prev
            : [...prev, { id: 'sync_error', type: 'error', persistent: true, title: "Couldn't save to Supabase", description: 'Your changes are kept in this browser and will retry on your next edit.' }]
        );
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [db, state]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [state]);

  const addToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      if (!toast.persistent) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4200);
      }
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addLead = useCallback(
    (input: Omit<Lead, 'id' | 'createdAt' | 'lastContacted'>) => {
      const now = new Date().toISOString();
      const newLead: Lead = {
        ...input,
        id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        createdAt: now,
        lastContacted: null,
      };
      const activity: ActivityLogItem = {
        id: `act_${Date.now()}`,
        type: 'lead_added',
        message: `Lead added: ${newLead.fullName}${newLead.company ? ` (${newLead.company})` : ''}`,
        timestamp: now,
        relatedId: newLead.id,
      };
      setState((prev) => ({
        ...prev,
        leads: [newLead, ...prev.leads],
        activities: [activity, ...prev.activities],
      }));
      addToast({
        type: 'success',
        title: 'Lead added',
        description: `${newLead.fullName} has been added to your contacts.`,
      });
      return newLead;
    },
    [addToast]
  );

  const importLeads = useCallback(
    (imported: Omit<Lead, 'id' | 'createdAt' | 'lastContacted'>[]): number => {
      if (imported.length === 0) return 0;
      const now = new Date().toISOString();
      const newLeads: Lead[] = imported.map((item, idx) => ({
        ...item,
        id: `lead_csv_${Date.now()}_${idx}`,
        createdAt: now,
        lastContacted: null,
      }));
      const activity: ActivityLogItem = {
        id: `act_csv_${Date.now()}`,
        type: 'lead_added',
        message: `Imported ${newLeads.length} ${newLeads.length === 1 ? 'lead' : 'leads'} from CSV`,
        timestamp: now,
      };
      setState((prev) => ({
        ...prev,
        leads: [...newLeads, ...prev.leads],
        activities: [activity, ...prev.activities],
      }));
      addToast({
        type: 'success',
        title: `${newLeads.length} ${newLeads.length === 1 ? 'lead' : 'leads'} imported`,
        description: 'Contacts are ready for outreach.',
      });
      return newLeads.length;
    },
    [addToast]
  );

  const updateLead = useCallback(
    (
      id: string,
      updates: Partial<Omit<Lead, 'id' | 'createdAt'>>,
      opts: { notify?: boolean } = {}
    ) => {
      const now = new Date().toISOString();
      setState((prev) => {
        const target = prev.leads.find((l) => l.id === id);
        if (!target) return prev;
        const updatedLead = { ...target, ...updates };
        const activity: ActivityLogItem = {
          id: `act_upd_${Date.now()}`,
          type: 'lead_updated',
          message: updates.status
            ? `"${updatedLead.fullName}" marked as ${updates.status}`
            : `Updated "${updatedLead.fullName}"`,
          timestamp: now,
          relatedId: id,
        };
        return {
          ...prev,
          leads: prev.leads.map((l) => (l.id === id ? updatedLead : l)),
          activities: [activity, ...prev.activities],
        };
      });
      if (opts.notify === false) return;
      addToast({
        type: 'success',
        title: 'Lead updated',
      });
    },
    [addToast]
  );

  const deleteLead = useCallback(
    (id: string) => {
      setState((prev) => {
        const target = prev.leads.find((l) => l.id === id);
        return {
          ...prev,
          leads: prev.leads.filter((l) => l.id !== id),
          activities: target
            ? [
                {
                  id: `act_del_${Date.now()}`,
                  type: 'lead_updated',
                  message: `Removed lead: ${target.fullName}`,
                  timestamp: new Date().toISOString(),
                },
                ...prev.activities,
              ]
            : prev.activities,
        };
      });
      addToast({
        type: 'info',
        title: 'Lead deleted',
      });
    },
    [addToast]
  );

  const updateLeadStatus = useCallback(
    (id: string, status: LeadStatus) => {
      updateLead(id, { status });
    },
    [updateLead]
  );

  const saveTemplate = useCallback(
    (
      templateData: Omit<EmailTemplate, 'id' | 'lastModified' | 'createdBy'> & {
        id?: string;
      }
    ) => {
      const now = new Date().toISOString();
      let savedId = templateData.id;
      setState((prev) => {
        const isEditing = Boolean(templateData.id);
        if (isEditing && templateData.id) {
          return {
            ...prev,
            templates: prev.templates.map((t) =>
              t.id === templateData.id
                ? {
                    ...t,
                    ...templateData,
                    lastModified: now,
                  }
                : t
            ),
            activities: [
              {
                id: `act_tpl_${Date.now()}`,
                type: 'template_created',
                message: `Template updated: "${templateData.name}"`,
                timestamp: now,
                relatedId: templateData.id,
              },
              ...prev.activities,
            ],
          };
        }

        const newId = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        savedId = newId;
        const created: EmailTemplate = {
          id: newId,
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          subject: templateData.subject,
          bodyHtml: templateData.bodyHtml,
          attachments: templateData.attachments,
          style: templateData.style,
          lastModified: now,
          createdBy: prev.settings.userName || 'Team Member',
        };
        return {
          ...prev,
          templates: [created, ...prev.templates],
          activities: [
            {
              id: `act_tpl_${Date.now()}`,
              type: 'template_created',
              message: `New template created: "${created.name}"`,
              timestamp: now,
              relatedId: newId,
            },
            ...prev.activities,
          ],
        };
      });

      addToast({
        type: 'success',
        title: templateData.id ? 'Template updated' : 'Template created',
        description: `"${templateData.name}" is ready to use in outreach campaigns.`,
      });
      return savedId;
    },
    [addToast]
  );

  const duplicateTemplate = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setState((prev) => {
        const source = prev.templates.find((t) => t.id === id);
        if (!source) return prev;
        const copy: EmailTemplate = {
          ...source,
          id: `tpl_${Date.now()}_copy`,
          name: `${source.name} (Copy)`,
          lastModified: now,
          createdBy: prev.settings.userName || source.createdBy,
        };
        return {
          ...prev,
          templates: [copy, ...prev.templates],
          activities: [
            {
              id: `act_dup_${Date.now()}`,
              type: 'template_created',
              message: `Duplicated template "${source.name}"`,
              timestamp: now,
              relatedId: copy.id,
            },
            ...prev.activities,
          ],
        };
      });
      addToast({
        type: 'success',
        title: 'Template duplicated',
      });
    },
    [addToast]
  );

  const deleteLeads = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setState((prev) => ({
        ...prev,
        leads: prev.leads.filter((l) => !idSet.has(l.id)),
        activities: [
          {
            id: `act_bulkdel_${Date.now()}`,
            type: 'lead_updated',
            message: `Removed ${ids.length} ${ids.length === 1 ? 'lead' : 'leads'}`,
            timestamp: new Date().toISOString(),
          },
          ...prev.activities,
        ],
      }));
      addToast({
        type: 'info',
        title: `${ids.length} ${ids.length === 1 ? 'lead' : 'leads'} deleted`,
      });
    },
    [addToast]
  );

  const updateLeadsStatus = useCallback(
    (ids: string[], status: LeadStatus) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setState((prev) => ({
        ...prev,
        leads: prev.leads.map((l) => (idSet.has(l.id) ? { ...l, status } : l)),
        activities: [
          {
            id: `act_bulkstatus_${Date.now()}`,
            type: 'lead_updated',
            message: `${ids.length} ${ids.length === 1 ? 'lead' : 'leads'} marked as ${status}`,
            timestamp: new Date().toISOString(),
          },
          ...prev.activities,
        ],
      }));
      addToast({
        type: 'success',
        title: `Status updated for ${ids.length} ${ids.length === 1 ? 'lead' : 'leads'}`,
        description: `Marked as ${status}.`,
      });
    },
    [addToast]
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      setState((prev) => {
        const target = prev.templates.find((t) => t.id === id);
        return {
          ...prev,
          templates: prev.templates.filter((t) => t.id !== id),
          activities: target
            ? [
                {
                  id: `act_tpldel_${Date.now()}`,
                  type: 'template_created' as const,
                  message: `Template deleted: "${target.name}"`,
                  timestamp: new Date().toISOString(),
                },
                ...prev.activities,
              ]
            : prev.activities,
        };
      });
      addToast({
        type: 'info',
        title: 'Template deleted',
      });
    },
    [addToast]
  );

  const recordSimulatedCampaign = useCallback(
    (params: {
      campaignId: string;
      campaignName: string;
      templateId: string;
      templateName: string;
      records: EmailActivityRecord[];
      sentCount: number;
      failedCount: number;
      /** Show a toast. Off when the caller already displays the result. */
      notify?: boolean;
      /** False when the emails really went out through a connected mailbox. */
      simulated?: boolean;
      /** Real sends with the open-tracking pixel. */
      opensTracked?: boolean;
    }) => {
      const opensTracked = params.simulated === false && params.opensTracked === true;
      const simulated = params.simulated ?? true;
      const now = new Date().toISOString();
      const total = params.records.length;
      const deliveredRate =
        total > 0 ? Number(((params.sentCount / total) * 100).toFixed(1)) : 0;

      // The simulated provider cannot observe opens or clicks, so we record
      // engagement as "not tracked" instead of inventing numbers.
      const campaign: Campaign = {
        id: params.campaignId,
        name: params.campaignName,
        templateId: params.templateId,
        templateName: params.templateName,
        recipientCount: total,
        sentCount: params.sentCount,
        failedCount: params.failedCount,
        deliveredRate,
        openRate: 0,
        clickRate: 0,
        engagementTracked: opensTracked,
        clicksTracked: opensTracked ? false : undefined,
        sentAt: now,
        status:
          params.sentCount === 0
            ? 'Failed'
            : params.failedCount > 0
            ? 'Partial'
            : simulated
            ? 'Simulated'
            : 'Completed',
        recipientRecords: params.records,
        attachments: params.records[0]?.attachments,
      };

      const sentLeadIds = new Set(
        params.records.filter((r) => r.status === 'Sent').map((r) => r.leadId)
      );

      const newActivities: ActivityLogItem[] = [
        {
          id: `act_camp_${Date.now()}`,
          type: 'campaign_sent',
          message: `Sent "${params.campaignName}" to ${params.sentCount} of ${total} ${total === 1 ? 'lead' : 'leads'}${simulated ? ' (simulated)' : ''}`,
          timestamp: now,
          relatedId: params.campaignId,
        },
      ];

      setState((prev) => {
        const updatedMetrics = addToTodaysMetrics(prev.dailyMetrics, {
          tracked: opensTracked,
          sent: total,
          delivered: params.sentCount,
        });

        return {
          ...prev,
          campaigns: [campaign, ...prev.campaigns],
          activities: [...newActivities, ...prev.activities],
          dailyMetrics: updatedMetrics,
          leads: prev.leads.map((lead) => {
            if (!sentLeadIds.has(lead.id)) return lead;
            // Status stays as is; the composer asks before moving New leads to Contacted.
            return { ...lead, lastContacted: now };
          }),
        };
      });

      if (params.notify === false) return;
      addToast({
        type: params.sentCount === 0 ? 'error' : params.failedCount > 0 ? 'warning' : 'success',
        title:
          params.sentCount === 0
            ? 'No emails were sent'
            : params.failedCount > 0
            ? `${params.sentCount} sent, ${params.failedCount} failed`
            : simulated
            ? 'Campaign sent (simulated)'
            : 'Campaign sent',
        description: `"${params.campaignName}" · ${params.sentCount} of ${total} ${
          total === 1 ? 'email' : 'emails'
        } ${simulated ? 'accepted by the simulator' : 'sent'}.`,
      });
    },
    [addToast]
  );

  /**
   * Applies what the server learned after sending: bounces mark recipients as
   * Bounced (with the reason) and lower delivery; opens set open times and the
   * open rate. Counts already applied are stored on the campaign, so only new
   * bounces/opens move the dashboard metrics.
   */
  const applyDeliveryEvents = useCallback((events: DeliveryEvent[]) => {
    if (events.length === 0) return;
    const byCampaign = new Map<string, DeliveryEvent[]>();
    for (const e of events) {
      if (!e.campaign_id) continue;
      const list = byCampaign.get(e.campaign_id) ?? [];
      list.push(e);
      byCampaign.set(e.campaign_id, list);
    }
    setState((prev) => {
      let metrics = prev.dailyMetrics;
      let changed = false;
      const campaigns = prev.campaigns.map((c) => {
        const evs = byCampaign.get(c.id);
        if (!evs || c.status === 'Simulated') return c;
        const byLead = new Map(evs.filter((e) => e.lead_id).map((e) => [e.lead_id!, e]));
        const bounced = evs.filter((e) => e.status === 'Bounced').length;
        const opened = evs.filter((e) => e.open_tracked && e.opened_at).length;
        const newBounced = bounced - (c.bouncedCount ?? 0);
        const newOpened = c.engagementTracked ? opened - (c.openedCount ?? 0) : 0;

        let recordsChanged = false;
        const recipientRecords = c.recipientRecords.map((rec) => {
          const e = byLead.get(rec.leadId);
          if (!e) return rec;
          const next = { ...rec };
          if (e.status === 'Bounced' && rec.status !== 'Bounced') {
            next.status = 'Bounced';
            next.failureReason = e.bounce_reason ?? 'Bounced';
          }
          if (e.opened_at && (rec.openedAt !== e.opened_at || rec.openCount !== e.open_count)) {
            next.openedAt = e.opened_at;
            next.openCount = e.open_count;
          }
          if (next.status !== rec.status || next.openedAt !== rec.openedAt || next.openCount !== rec.openCount) {
            recordsChanged = true;
            return next;
          }
          return rec;
        });
        if (newBounced === 0 && newOpened === 0 && !recordsChanged) return c;
        changed = true;

        if (newBounced !== 0 || newOpened !== 0) {
          const day = toLocalIsoDate(new Date(c.sentAt));
          metrics = metrics.map((p) =>
            p.date === day
              ? { ...p, delivered: Math.max(0, p.delivered - newBounced), opened: p.opened + newOpened }
              : p
          );
        }
        const delivered = Math.max(0, c.sentCount - bounced);
        return {
          ...c,
          recipientRecords,
          bouncedCount: bounced,
          openedCount: c.engagementTracked ? opened : c.openedCount,
          deliveredRate: c.recipientCount > 0 ? Number(((delivered / c.recipientCount) * 100).toFixed(1)) : 0,
          openRate: c.engagementTracked && delivered > 0 ? Number(((opened / delivered) * 100).toFixed(1)) : c.openRate,
        };
      });
      return changed ? { ...prev, campaigns, dailyMetrics: metrics } : prev;
    });
  }, []);

  const updateSettings = useCallback(
    (next: TeamSettings) => {
      setState((prev) => ({
        ...prev,
        settings: next,
      }));
      addToast({
        type: 'success',
        title: 'Settings saved',
        description: 'Your sender profile and outreach preferences have been updated.',
      });
    },
    [addToast]
  );

  const resetDemoData = useCallback(() => {
    // Template files live in IndexedDB; the demo data has none, so drop them all.
    void clearFiles().catch(() => undefined);
    const fresh = getDefaultState();
    setState(fresh);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // ignore
    }
    addToast({
      type: 'info',
      title: 'Workspace reset',
      description: 'Restored default leads, templates, and campaign history.',
    });
  }, [addToast]);

  const getLeadEmailHistory = useCallback(
    (leadId: string): EmailActivityRecord[] => {
      const records: EmailActivityRecord[] = [];
      for (const camp of state.campaigns) {
        for (const rec of camp.recipientRecords) {
          if (rec.leadId === leadId) {
            records.push(rec);
          }
        }
      }
      return records.sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
      );
    },
    [state.campaigns]
  );

  return {
    syncStatus,
    leads: state.leads,
    templates: state.templates,
    campaigns: state.campaigns,
    activities: state.activities,
    dailyMetrics: state.dailyMetrics,
    settings: state.settings,
    toasts,
    addToast,
    dismissToast,
    addLead,
    importLeads,
    updateLead,
    deleteLead,
    updateLeadStatus,
    deleteLeads,
    updateLeadsStatus,
    saveTemplate,
    duplicateTemplate,
    deleteTemplate,
    recordSimulatedCampaign,
    applyDeliveryEvents,
    updateSettings,
    resetDemoData,
    getLeadEmailHistory,
  };
}
