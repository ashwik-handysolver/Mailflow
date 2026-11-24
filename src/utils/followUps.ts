import { Lead } from '../types/outreach';

export const FOLLOW_UP_AFTER_DAYS = 7;

/** Interested or Follow-up leads with no contact in the last FOLLOW_UP_AFTER_DAYS days, oldest first. */
export function dueFollowUps(leads: Lead[], now = Date.now()): Lead[] {
  const threshold = now - FOLLOW_UP_AFTER_DAYS * 86_400_000;
  return leads
    .filter(
      (l) =>
        (l.status === 'Interested' || l.status === 'Follow-up') &&
        (!l.lastContacted || new Date(l.lastContacted).getTime() < threshold)
    )
    .sort((a, b) => new Date(a.lastContacted ?? 0).getTime() - new Date(b.lastContacted ?? 0).getTime());
}
