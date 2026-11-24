import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndSortLeads,
  paginateItems,
  parseLeadsCsv,
  sliceMetricsByRange,
} from './leadHelpers';
import { DailyMetricPoint, Lead } from '../types/outreach';

const sampleLeads: Lead[] = [
  {
    id: '1',
    fullName: 'Zara Vance',
    company: 'Northstar',
    email: 'zara@northstar.io',
    phone: '555-0101',
    industry: 'FinTech',
    status: 'New',
    lastContacted: '2026-11-10T10:00:00Z',
    createdAt: '2026-11-01T10:00:00Z',
  },
  {
    id: '2',
    fullName: 'Aaron Chen',
    company: 'BetaGrid',
    email: 'aaron@betagrid.io',
    phone: '555-0102',
    industry: 'SaaS',
    status: 'Interested',
    lastContacted: '2026-11-12T10:00:00Z',
    createdAt: '2026-11-02T10:00:00Z',
  },
];

test('filterAndSortLeads filters by query, status, industry and sorts accurately', () => {
  const byName = filterAndSortLeads(sampleLeads, {
    search: '',
    industry: 'All',
    status: 'All',
    sort: 'name_asc',
  });
  assert.equal(byName[0].fullName, 'Aaron Chen');

  const filtered = filterAndSortLeads(sampleLeads, {
    search: 'northstar',
    industry: 'FinTech',
    status: 'New',
    sort: 'date_desc',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '1');
});

test('paginateItems clamps page bounds cleanly', () => {
  const items = Array.from({ length: 15 }, (_, i) => i + 1);
  const page2 = paginateItems(items, 2, 10);
  assert.equal(page2.totalPages, 2);
  assert.deepEqual(page2.items, [11, 12, 13, 14, 15]);

  const clamped = paginateItems(items, 99, 10);
  assert.equal(clamped.safePage, 2);
});

test('parseLeadsCsv imports valid rows and skips invalid rows', () => {
  const csv = [
    'Full Name,Company,Email,Phone,Industry,Status',
    'Maya Lin,CloudPulse,maya@cloudpulse.dev,415-222-3344,SaaS,Contacted',
    'Invalid Row,NoEmail,not-an-email,555,FinTech,New',
  ].join('\n');

  const parsed = parseLeadsCsv(csv);
  assert.equal(parsed.validLeads.length, 1);
  assert.equal(parsed.skippedRows, 1);
  assert.equal(parsed.validLeads[0].fullName, 'Maya Lin');
  assert.equal(parsed.validLeads[0].status, 'Contacted');
});

test('sliceMetricsByRange returns requested day window', () => {
  const metrics: DailyMetricPoint[] = Array.from({ length: 90 }, (_, i) => ({
    date: `2026-09-${String((i % 30) + 1).padStart(2, '0')}`,
    label: `D${i + 1}`,
    sent: 10,
    delivered: 9,
    opened: 5,
    clicked: 2,
  }));
  assert.equal(sliceMetricsByRange(metrics, 7).length, 7);
  assert.equal(sliceMetricsByRange(metrics, 30).length, 30);
  assert.equal(sliceMetricsByRange(metrics, 90).length, 90);
});
