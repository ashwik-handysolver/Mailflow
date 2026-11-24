import { useMemo, useState } from 'react';
import { ActivityEventType } from '../../types/outreach';
import { useNavigation, useWorkspace } from '../../app/WorkspaceContext';
import { PageContainer, PageHeader } from '../layout/PageHeader';
import { ActivityFeed } from '../dashboard/ActivityFeed';
import { FilterChips } from '../ui/Feedback';

type Filter = 'all' | 'campaigns' | 'emails' | 'leads' | 'templates';

const FILTERS: { value: Filter; label: string; types: ActivityEventType[] }[] = [
  { value: 'all', label: 'All', types: [] },
  { value: 'campaigns', label: 'Campaigns', types: ['campaign_sent'] },
  { value: 'emails', label: 'Emails', types: ['email_sent'] },
  { value: 'leads', label: 'Leads', types: ['lead_added', 'lead_updated'] },
  { value: 'templates', label: 'Templates', types: ['template_created'] },
];

export function AuditLogsPage() {
  const { activities, campaigns, leads } = useWorkspace();
  const { navigate } = useNavigation();
  const [filter, setFilter] = useState<Filter>('all');

  const countFor = (f: (typeof FILTERS)[number]) =>
    f.value === 'all' ? activities.length : activities.filter((a) => f.types.includes(a.type)).length;
  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.value === filter)!;
    return filter === 'all' ? activities : activities.filter((a) => f.types.includes(a.type));
  }, [activities, filter]);

  return (
    <PageContainer>
      <PageHeader title="Audit logs" count={activities.length} />
      <div className="max-w-3xl">
        <FilterChips
          className="mb-4"
          label="Filter events"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: countFor(f) }))}
        />
        <ActivityFeed
          full
          activities={filtered}
          onOpenCampaign={(id) => campaigns.some((c) => c.id === id) && navigate('campaigns', { openCampaignId: id })}
          onOpenLead={(id) => leads.some((l) => l.id === id) && navigate('leads', { openLeadId: id })}
        />
      </div>
    </PageContainer>
  );
}
