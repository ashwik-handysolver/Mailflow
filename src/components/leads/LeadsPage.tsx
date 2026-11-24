import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronsUpDown,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Lead, LeadStatus } from '../../types/outreach';
import { useNavigation, useWorkspace } from '../../app/WorkspaceContext';
import { filterAndSortLeads, isValidEmail, LeadSortOption, paginateItems } from '../../utils/leadHelpers';
import { formatRelativeTime } from '../../utils/analytics';
import { PageContainer, PageHeader } from '../layout/PageHeader';
import { LeadStatusBadge, LEAD_STATUS_COLOR } from '../common/StatusBadge';
import { Button, IconButton } from '../ui/Button';
import { Checkbox, Input } from '../ui/Field';
import { Avatar, EmptyState, Pagination } from '../ui/Misc';
import { Menu } from '../ui/Menu';
import { ConfirmDialog } from '../ui/Overlay';
import { cn } from '../../lib/cn';
import { AddLeadDialog, industryOptions, LEAD_STATUSES, STATUS_OPTIONS } from './LeadForm';
import { Dropdown } from '../ui/Dropdown';
import { Chip, FilterMenu, toggleIn } from '../common/FilterMenu';
import { CsvImportDialog } from './CsvImportDialog';
import { LeadDetailDrawer } from './LeadDetailDrawer';

const DEFAULT_SORT: LeadSortOption = 'created_desc';

const SORT_LABELS: Record<LeadSortOption, string> = {
  created_desc: 'Recently added',
  name_asc: 'Name A → Z',
  name_desc: 'Name Z → A',
  date_desc: 'Last contacted, newest',
  date_asc: 'Last contacted, oldest',
};

export function LeadsPage() {
  const ws = useWorkspace();
  const { leads } = ws;
  const { selectedLeadIds, setSelectedLeadIds, openComposer, intent, clearIntent } = useNavigation();

  const [search, setSearch] = useState('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [sortBy, setSortBy] = useState<LeadSortOption>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Lead[] | null>(null);

  // Arrivals from the dashboard: "Add lead", a pipeline status, or a specific lead.
  useEffect(() => {
    if (!intent.addLead && !intent.leadStatus && !intent.openLeadId) return;
    if (intent.addLead) setAddOpen(true);
    if (intent.leadStatus) setStatuses([intent.leadStatus]);
    if (intent.openLeadId) setDrawerId(intent.openLeadId);
    clearIntent();
  }, [intent, clearIntent]);

  useEffect(() => setPage(1), [search, industries, statuses, sortBy, pageSize]);

  const allIndustries = useMemo(
    () => Array.from(new Set(leads.map((l) => l.industry).filter(Boolean))).sort(),
    [leads]
  );
  const industryChoices = useMemo(() => industryOptions(allIndustries).map((i) => ({ value: i })), [allIndustries]);
  const emailIndex = useMemo(() => leads.map((l) => l.email.toLowerCase()), [leads]);

  const filtered = useMemo(
    () =>
      filterAndSortLeads(leads, {
        search,
        industry: 'All',
        status: 'All',
        industries,
        statuses,
        sort: sortBy,
      }),
    [leads, search, industries, statuses, sortBy]
  );
  const { items: visible, totalPages, safePage } = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const selected = useMemo(() => new Set(selectedLeadIds), [selectedLeadIds]);
  const visibleIds = visible.map((l) => l.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const filtersActive = Boolean(search.trim()) || industries.length > 0 || statuses.length > 0;
  const bulkMode = selectedLeadIds.length > 0;

  const toggleOne = (id: string) =>
    setSelectedLeadIds(selected.has(id) ? selectedLeadIds.filter((x) => x !== id) : [...selectedLeadIds, id]);

  const toggleVisible = () => {
    if (allVisibleSelected) {
      const v = new Set(visibleIds);
      setSelectedLeadIds(selectedLeadIds.filter((id) => !v.has(id)));
    } else {
      setSelectedLeadIds(Array.from(new Set([...selectedLeadIds, ...visibleIds])));
    }
  };

  const clearFilters = () => {
    setSearch('');
    setIndustries([]);
    setStatuses([]);
  };

  /** Header sort cycles: first direction → reverse → back to default. */
  const cycleSort = (column: 'name' | 'date') => {
    const [first, second]: LeadSortOption[] = column === 'name' ? ['name_asc', 'name_desc'] : ['date_desc', 'date_asc'];
    setSortBy(sortBy === first ? second : sortBy === second ? DEFAULT_SORT : first);
  };

  const drawerLead = drawerId ? leads.find((l) => l.id === drawerId) ?? null : null;
  const takenEmailsExcept = (id?: string) =>
    new Set(leads.filter((l) => l.id !== id).map((l) => l.email.toLowerCase()));

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const ids = pendingDelete.map((l) => l.id);
    if (ids.length === 1) ws.deleteLead(ids[0]);
    else ws.deleteLeads(ids);
    if (drawerId && ids.includes(drawerId)) setDrawerId(null);
    setPendingDelete(null);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Leads"
        count={leads.length}
        actions={
          <>
            <div className="hidden items-center gap-2 sm:flex">
              <Button onClick={() => setCsvOpen(true)}>
                Import CSV
              </Button>
              <Button variant="primary" leadingIcon={<Plus />} onClick={() => setAddOpen(true)}>
                Add lead
              </Button>
            </div>
            <div className="sm:hidden">
              <Menu
                align="start"
                items={[
                  { label: 'Add lead', icon: <Plus />, onSelect: () => setAddOpen(true) },
                  { label: 'Import CSV', icon: <Upload />, onSelect: () => setCsvOpen(true) },
                ]}
                trigger={(p) => (
                  <Button variant="primary" leadingIcon={<Plus />} trailingIcon={<ChevronDown />} {...p}>
                    Add
                  </Button>
                )}
              />
            </div>
          </>
        }
      />

      {/* Toolbar — swaps to bulk actions while leads are selected */}
      <div className="flex min-h-9 flex-wrap items-center gap-2 pb-2">
        {bulkMode ? (
          <div role="toolbar" aria-label="Bulk actions" className="flex flex-1 flex-wrap items-center gap-1 animate-fade-in">
            <span className="mr-1 text-ui font-medium tabular-nums text-ink" aria-live="polite">
              {selectedLeadIds.length} selected
            </span>
            {!allFilteredSelected && filtered.length > selectedLeadIds.length && (
              <Button
                variant="link"
                size="sm"
                className="mr-2"
                onClick={() => setSelectedLeadIds(Array.from(new Set([...selectedLeadIds, ...filtered.map((l) => l.id)])))}
              >
                Select all {filtered.length}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => openComposer({ leadIds: selectedLeadIds })}>
              Email {selectedLeadIds.length}
            </Button>
            <Menu
              align="start"
              items={LEAD_STATUSES.map((s) => ({
                label: s,
                icon: <span className="size-2 rounded-full" style={{ background: LEAD_STATUS_COLOR[s] }} />,
                onSelect: () => ws.updateLeadsStatus(selectedLeadIds, s),
              }))}
              trigger={(p) => (
                <Button size="sm" trailingIcon={<ChevronDown />} {...p}>
                  Set status
                </Button>
              )}
            />
            <Button
              size="sm"
              className="text-danger"
              onClick={() => setPendingDelete(leads.filter((l) => selected.has(l.id)))}
            >
              Delete
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedLeadIds([])}>
              Clear selection
            </Button>
          </div>
        ) : (
          <>
            <Input
              inputSize="sm"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company or email"
              aria-label="Search leads"
              leadingIcon={<Search />}
              className="w-full sm:w-64"
            />
            <FilterMenu
              label="Status"
              selected={statuses}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: s, color: LEAD_STATUS_COLOR[s] }))}
              onToggle={(v) => setStatuses((cur) => toggleIn(cur, v))}
            />
            <FilterMenu
              label="Industry"
              selected={industries}
              options={allIndustries.map((i) => ({ value: i, label: i }))}
              onToggle={(v) => setIndustries((cur) => toggleIn(cur, v))}
            />
          </>
        )}
      </div>

      {/* Active filter chips */}
      {!bulkMode && (filtersActive || sortBy !== DEFAULT_SORT) && (
        <div className="flex flex-wrap items-center gap-1.5 pb-3">
          {statuses.map((s) => (
            <Chip key={s} label={`Status: ${s}`} onRemove={() => setStatuses((c) => c.filter((x) => x !== s))} />
          ))}
          {industries.map((i) => (
            <Chip key={i} label={`Industry: ${i}`} onRemove={() => setIndustries((c) => c.filter((x) => x !== i))} />
          ))}
          {sortBy !== DEFAULT_SORT && <Chip label={`Sorted: ${SORT_LABELS[sortBy]}`} onRemove={() => setSortBy(DEFAULT_SORT)} />}
          <Button
            variant="link"
            size="sm"
            className="ml-1"
            onClick={() => {
              clearFilters();
              setSortBy(DEFAULT_SORT);
            }}
          >
            Clear all
          </Button>
        </div>
      )}

      <div>
        {leads.length === 0 ? (
          <EmptyState
            title="No leads yet"
            action={
              <>
                <Button onClick={() => setCsvOpen(true)}>
                  Import CSV
                </Button>
                <Button variant="primary" leadingIcon={<Plus />} onClick={() => setAddOpen(true)}>
                  Add lead
                </Button>
              </>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No leads match these filters"
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <div className="relative scrollbar-thin max-lg:overflow-x-auto">
            <table className="w-full text-ui">
              <thead>
                <tr className="text-left text-xs font-normal text-ink-3 whitespace-nowrap [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-line [&>th]:bg-canvas">
                  <th scope="col" className="w-10 pl-4 pr-1 py-2">
                    <Checkbox
                      aria-label={allVisibleSelected ? 'Deselect leads on this page' : 'Select leads on this page'}
                      checked={allVisibleSelected}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      onChange={toggleVisible}
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 font-medium"
                    aria-sort={sortBy === 'name_asc' ? 'ascending' : sortBy === 'name_desc' ? 'descending' : 'none'}
                  >
                    <SortButton
                      label="Name"
                      state={sortBy === 'name_asc' ? 'asc' : sortBy === 'name_desc' ? 'desc' : null}
                      onClick={() => cycleSort('name')}
                    />
                  </th>
                  <th scope="col" className="hidden lg:table-cell px-3 py-2 font-medium">Company</th>
                  <th scope="col" className="hidden xl:table-cell px-3 py-2 font-medium">Industry</th>
                  <th scope="col" className="hidden sm:table-cell px-3 py-2 font-medium">Status</th>
                  <th
                    scope="col"
                    className="hidden sm:table-cell px-3 py-2 font-medium"
                    aria-sort={sortBy === 'date_asc' ? 'ascending' : sortBy === 'date_desc' ? 'descending' : 'none'}
                  >
                    <SortButton
                      label="Last contacted"
                      state={sortBy === 'date_asc' ? 'asc' : sortBy === 'date_desc' ? 'desc' : null}
                      onClick={() => cycleSort('date')}
                    />
                  </th>
                  <th scope="col" className="w-16 pr-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((lead) => {
                  const isSelected = selected.has(lead.id);
                  const badEmail = !isValidEmail(lead.email);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setDrawerId(lead.id)}
                      className={cn(
                        'group cursor-pointer transition-colors',
                        isSelected ? 'bg-accent-soft/50 hover:bg-accent-soft/80' : 'hover:bg-canvas'
                      )}
                    >
                      <td className="pl-4 pr-1 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label={`Select ${lead.fullName}`} checked={isSelected} onChange={() => toggleOne(lead.id)} />
                      </td>
                      <td className="px-3 py-2.5 max-w-[320px]">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={lead.fullName} size="md" className="shrink-0" />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDrawerId(lead.id);
                              }}
                              className="block max-w-full truncate text-left font-medium text-ink hover:underline hover:underline-offset-2"
                            >
                              {lead.fullName}
                            </button>
                            <p className={cn('flex items-center gap-1 truncate text-xs', badEmail ? 'text-danger' : 'text-ink-3')}>
                              {badEmail && <AlertTriangle className="size-3 shrink-0" aria-label="Invalid email" />}
                              <span className="truncate">{lead.email || 'No email'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="mt-0.5 sm:hidden">
                          <LeadStatusBadge status={lead.status} />
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-3 py-2 max-w-[220px] truncate text-ink-2">
                        {lead.company || <span className="text-ink-4">—</span>}
                      </td>
                      <td className="hidden xl:table-cell min-w-[132px] px-1.5 py-1" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          appearance="inline"
                          label={`Industry for ${lead.fullName}`}
                          value={lead.industry}
                          options={industryChoices}
                          onChange={(industry) => ws.updateLead(lead.id, { industry })}
                          className="text-ink-2"
                        />
                      </td>
                      <td className="hidden sm:table-cell min-w-[126px] px-1.5 py-1" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          appearance="inline"
                          label={`Status for ${lead.fullName}`}
                          value={lead.status}
                          options={STATUS_OPTIONS}
                          onChange={(status) => ws.updateLead(lead.id, { status })}
                        />
                      </td>
                      <td
                        className="hidden sm:table-cell px-3 py-2 whitespace-nowrap tabular-nums text-ink-3"
                        title={lead.lastContacted ? new Date(lead.lastContacted).toLocaleString() : undefined}
                      >
                        {lead.lastContacted ? formatRelativeTime(lead.lastContacted) : 'Never'}
                      </td>
                      <td className="pr-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton
                            label={`Email ${lead.fullName}`}
                            size="sm"
                            onClick={() => openComposer({ leadIds: [lead.id] })}
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:hidden"
                          >
                            <Send />
                          </IconButton>
                          <Menu
                            items={[
                              { label: 'Send email', icon: <Send />, onSelect: () => openComposer({ leadIds: [lead.id] }) },
                              {
                                label: 'Delete',
                                icon: <Trash2 />,
                                destructive: true,
                                separated: true,
                                onSelect: () => setPendingDelete([lead]),
                              },
                            ]}
                            trigger={(p) => (
                              <IconButton
                                label={`Actions for ${lead.fullName}`}
                                size="sm"
                                className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                                {...p}
                              >
                                <MoreHorizontal />
                              </IconButton>
                            )}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="pt-3">
            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100]}
              itemLabel={filtered.length === 1 ? 'lead' : 'leads'}
            />
          </div>
        )}
      </div>

      <AddLeadDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        industries={allIndustries}
        takenEmails={takenEmailsExcept()}
        onCreate={(data) => ws.addLead(data)}
      />

      <CsvImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} existingEmails={emailIndex} onImport={ws.importLeads} />

      <LeadDetailDrawer
        lead={drawerLead}
        emailHistory={drawerLead ? ws.getLeadEmailHistory(drawerLead.id) : []}
        industries={allIndustries}
        takenEmails={takenEmailsExcept(drawerLead?.id)}
        onClose={() => setDrawerId(null)}
        onUpdate={(id, updates) => ws.updateLead(id, updates, { notify: false })}
        onDelete={(lead) => setPendingDelete([lead])}
        onCompose={(lead) => openComposer({ leadIds: [lead.id] })}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete && pendingDelete.length > 1
            ? `Delete ${pendingDelete.length} leads?`
            : `Delete ${pendingDelete?.[0]?.fullName ?? 'lead'}?`
        }
        description="Their contact details are removed from this workspace. Past campaign records are kept. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </PageContainer>
  );
}

function SortButton({ label, state, onClick }: { label: string; state: 'asc' | 'desc' | null; onClick: () => void }) {
  const Icon = state === null ? ChevronsUpDown : state === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-ink', state && 'text-ink')}
    >
      {label}
      <Icon className="size-3" aria-hidden="true" />
    </button>
  );
}
