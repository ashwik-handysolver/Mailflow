import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityLogItem, Campaign, DailyMetricPoint, EmailTemplate, Lead, TeamSettings } from '../types/outreach';

export interface WorkspaceData {
  leads: Lead[];
  templates: EmailTemplate[];
  campaigns: Campaign[];
  activities: ActivityLogItem[];
  dailyMetrics: DailyMetricPoint[];
  settings: TeamSettings;
}

const COLLECTIONS = ['leads', 'templates', 'campaigns', 'activities'] as const;
type Collection = (typeof COLLECTIONS)[number];

/** Loads the signed-in user's workspace, or null if they have none yet. */
export async function loadWorkspace(db: SupabaseClient): Promise<WorkspaceData | null> {
  const meta = await db.from('workspace_meta').select('settings, daily_metrics').maybeSingle();
  if (meta.error) throw meta.error;
  if (!meta.data) return null;
  const rows = await Promise.all(COLLECTIONS.map((t) => db.from(t).select('data')));
  const out: Partial<WorkspaceData> = {
    settings: meta.data.settings as TeamSettings,
    dailyMetrics: meta.data.daily_metrics as DailyMetricPoint[],
  };
  COLLECTIONS.forEach((t, i) => {
    const r = rows[i];
    if (r.error) throw r.error;
    (out as Record<string, unknown>)[t] = (r.data ?? []).map((x) => x.data);
  });
  return out as WorkspaceData;
}

/** Writes only what changed between two snapshots: upserts edited/new records, deletes removed ones. */
export async function saveChanges(db: SupabaseClient, prev: WorkspaceData | null, next: WorkspaceData) {
  const jobs: PromiseLike<{ error: unknown }>[] = [];
  for (const t of COLLECTIONS) {
    const before = new Map<string, string>((prev?.[t] ?? []).map((r: { id: string }) => [r.id, JSON.stringify(r)]));
    const after = next[t] as { id: string }[];
    const changed = after.filter((r) => before.get(r.id) !== JSON.stringify(r));
    const removed = [...before.keys()].filter((id) => !after.some((r) => r.id === id));
    if (changed.length) {
      jobs.push(db.from(t as Collection).upsert(changed.map((r) => ({ id: r.id, data: r, updated_at: new Date().toISOString() }))));
    }
    if (removed.length) jobs.push(db.from(t as Collection).delete().in('id', removed));
  }
  if (!prev || prev.settings !== next.settings || prev.dailyMetrics !== next.dailyMetrics) {
    jobs.push(
      db.from('workspace_meta').upsert({
        settings: next.settings,
        daily_metrics: next.dailyMetrics,
        updated_at: new Date().toISOString(),
      })
    );
  }
  const results = await Promise.all(jobs);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
}
