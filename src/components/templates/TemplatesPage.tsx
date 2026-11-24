import { useEffect, useMemo, useState } from 'react';
import { Copy, MoreHorizontal, Paperclip, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { deleteFiles, putFiles } from '../../utils/attachmentStore';
import { EmailTemplate, TemplateCategory } from '../../types/outreach';
import { useNavigation, useWorkspace } from '../../app/WorkspaceContext';
import { personalizeEmail, stripHtml } from '../../utils/personalization';
import { computeTemplateUsage, describeUsage } from '../../utils/templateUsage';
import { formatFullDateTime, formatShortDate } from '../../utils/analytics';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { PageContainer, PageHeader } from '../layout/PageHeader';
import { Button, IconButton } from '../ui/Button';
import { Input, Switch } from '../ui/Field';
import { EmptyState } from '../ui/Misc';
import { Menu } from '../ui/Menu';
import { Dropdown } from '../ui/Dropdown';
import { ConfirmDialog } from '../ui/Overlay';
import { EmailPreview } from '../common/EmailPreview';
import { TokenizedText } from '../common/TokenizedText';
import { cn } from '../../lib/cn';
import { TEMPLATE_CATEGORIES, TemplateEditorDialog } from './TemplateEditorDialog';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';

export function TemplatesPage() {
  const ws = useWorkspace();
  const { templates, leads, settings, campaigns } = ws;
  const { openComposer, selectedLeadIds, intent, clearIntent } = useNavigation();
  const wide = useMediaQuery('(min-width: 1024px)');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TemplateCategory | 'All'>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ template: EmailTemplate | null } | null>(null);
  const [mobilePreview, setMobilePreview] = useState<EmailTemplate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    if (intent.createTemplate) {
      setEditor({ template: null });
      clearIntent();
    }
  }, [intent.createTemplate, clearIntent]);

  const usage = useMemo(() => computeTemplateUsage(campaigns), [campaigns]);
  const categoriesInUse = useMemo(
    () => TEMPLATE_CATEGORIES.filter((c) => templates.some((t) => t.category === c)),
    [templates]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== 'All' && t.category !== category) return false;
      if (!q) return true;
      return [t.name, t.description, t.subject, stripHtml(t.bodyHtml)].some((s) => s.toLowerCase().includes(q));
    });
  }, [templates, search, category]);

  const selected = filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  const useTemplate = (t: EmailTemplate) => {
    setMobilePreview(null);
    openComposer({ leadIds: selectedLeadIds, templateId: t.id });
  };

  const actionsFor = (t: EmailTemplate) => [
    { label: 'Edit', icon: <Pencil />, onSelect: () => setEditor({ template: t }) },
    { label: 'Duplicate', icon: <Copy />, onSelect: () => ws.duplicateTemplate(t.id) },
    { label: 'Delete', icon: <Trash2 />, destructive: true, separated: true, onSelect: () => setPendingDelete(t) },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Templates"
        count={templates.length}
        actions={
          <Button variant="primary" leadingIcon={<Plus />} onClick={() => setEditor({ template: null })}>
            New template
          </Button>
        }
      />

      {templates.length === 0 ? (
        <div>
          <EmptyState
            title="No templates yet"
            action={
              <Button variant="primary" leadingIcon={<Plus />} onClick={() => setEditor({ template: null })}>
                New template
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] xl:gap-14">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 pb-3">
              <Input
                inputSize="sm"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates"
                aria-label="Search templates"
                leadingIcon={<Search />}
                className="w-full sm:w-60"
              />
              {categoriesInUse.length > 1 && (
                <div className="w-[170px]">
                  <Dropdown
                    label="Filter by category"
                    size="sm"
                    value={category}
                    options={[
                      { value: 'All' as const, label: 'All categories' },
                      ...categoriesInUse.map((c) => ({ value: c })),
                    ]}
                    onChange={(v) => setCategory(v as TemplateCategory | 'All')}
                  />
                </div>
              )}
            </div>

            {filtered.length === 0 ? (
              <div>
                <EmptyState
                  title="No templates match"
                  action={
                    <Button
                      onClick={() => {
                        setSearch('');
                        setCategory('All');
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="-mx-3 space-y-0.5" aria-label="Templates">
                {filtered.map((t) => {
                  const active = wide && selected?.id === t.id;
                  return (
                    <li
                      key={t.id}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-3 transition-colors',
                        active ? 'bg-subtle' : 'hover:bg-subtle/60'
                      )}
                    >
                      <button
                        type="button"
                        aria-current={active || undefined}
                        onClick={() => (wide ? setSelectedId(t.id) : setMobilePreview(t))}
                        className="min-w-0 flex-1 text-left after:absolute after:inset-0"
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-ui font-medium text-ink">{t.name}</span>
                          <span className="shrink-0 text-xs text-ink-3">{t.category}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-ui text-ink-2">
                          <TokenizedText text={t.subject} />
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-3" title={`Updated ${formatFullDateTime(t.lastModified)}`}>
                          {describeUsage(usage.get(t.id))}
                          {t.attachments && t.attachments.length > 0 && (
                            <>
                              {' · '}
                              <Paperclip className="inline size-3 -translate-y-px" aria-hidden="true" /> {t.attachments.length}{' '}
                              {t.attachments.length === 1 ? 'file' : 'files'}
                            </>
                          )}{' '}
                          · Updated {formatShortDate(t.lastModified)} by {t.createdBy}
                        </span>
                      </button>
                      <div className="relative z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
                        <Button variant="ghost" size="sm" onClick={() => useTemplate(t)} className="max-sm:hidden">
                          Use
                        </Button>
                        <Menu
                          items={actionsFor(t)}
                          trigger={(p) => (
                            <IconButton label={`Actions for ${t.name}`} size="sm" {...p}>
                              <MoreHorizontal />
                            </IconButton>
                          )}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {wide && selected && (
            <TemplatePane
              key={selected.id}
              template={selected}
              usageText={describeUsage(usage.get(selected.id))}
              onUse={() => useTemplate(selected)}
              onEdit={() => setEditor({ template: selected })}
              menuItems={actionsFor(selected)}
            />
          )}
        </div>
      )}

      <TemplateEditorDialog
        open={Boolean(editor)}
        template={editor?.template ?? null}
        leads={leads}
        settings={settings}
        onClose={() => setEditor(null)}
        onSave={async (draft, newFiles) => {
          // Store file contents first; if that fails the editor stays open with the error.
          await putFiles(newFiles);
          const id = ws.saveTemplate(draft);
          if (id) setSelectedId(id);
          const before = editor?.template?.attachments ?? [];
          const keep = new Set((draft.attachments ?? []).map((a) => a.id));
          releaseFiles(
            before.filter((a) => !keep.has(a.id)).map((a) => a.id),
            templates.filter((t) => t.id !== draft.id)
          );
        }}
      />

      <TemplatePreviewDialog
        template={mobilePreview}
        leads={leads}
        settings={settings}
        onClose={() => setMobilePreview(null)}
        onEdit={(t) => {
          setMobilePreview(null);
          setEditor({ template: t });
        }}
        primaryLabel="Use in campaign"
        onPrimary={useTemplate}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.name}"?`}
        description="Teammates will no longer be able to use this template. Campaigns already sent are not affected."
        confirmLabel="Delete template"
        destructive
        onConfirm={() => {
          if (pendingDelete) {
            ws.deleteTemplate(pendingDelete.id);
            releaseFiles(
              (pendingDelete.attachments ?? []).map((a) => a.id),
              templates.filter((t) => t.id !== pendingDelete.id)
            );
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </PageContainer>
  );
}

function TemplatePane({
  template,
  usageText,
  onUse,
  onEdit,
  menuItems,
}: {
  template: EmailTemplate;
  usageText: string;
  onUse: () => void;
  onEdit: () => void;
  menuItems: React.ComponentProps<typeof Menu>['items'];
}) {
  const { leads, settings } = useWorkspace();
  const [leadId, setLeadId] = useState(leads[0]?.id ?? '');
  const [highlight, setHighlight] = useState(true);
  const lead = leads.find((l) => l.id === leadId) ?? leads[0] ?? null;

  const preview = useMemo(
    () =>
      personalizeEmail({
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        lead,
        signatureHtml: settings.includeSignatureByDefault ? settings.defaultSignatureHtml : undefined,
      }),
    [template, lead, settings]
  );

  return (
    <aside aria-label={`Preview of ${template.name}`} className="lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-heading font-semibold text-ink">{template.name}</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {template.category} · {usageText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="primary" size="sm" onClick={onUse}>
            Use
          </Button>
          <Button size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Menu
            items={menuItems.filter((i) => i.label !== 'Edit')}
            trigger={(p) => (
              <IconButton label="More actions" size="sm" {...p}>
                <MoreHorizontal />
              </IconButton>
            )}
          />
        </div>
      </div>
      {template.description && <p className="mt-2 text-ui text-ink-2">{template.description}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {leads.length > 0 ? (
          <div className="w-[200px]">
            <Dropdown
              label="Preview as lead"
              size="sm"
              value={lead?.id ?? ''}
              options={leads.map((l) => ({ value: l.id, label: `As ${l.fullName}` }))}
              onChange={setLeadId}
            />
          </div>
        ) : (
          <span />
        )}
        <div className="shrink-0 [&_label]:whitespace-nowrap">
          <Switch checked={highlight} onChange={setHighlight} label="Highlight fields" />
        </div>
      </div>

      <EmailPreview
        className="mt-3"
        highlight={highlight}
        emailStyle={template.style}
        attachments={template.attachments}
        fromName={settings.senderDisplayName}
        fromEmail={settings.senderEmail}
        toName={lead?.fullName}
        toEmail={lead?.email}
        subjectHtml={preview.previewSubjectHtml}
        bodyHtml={preview.previewBodyHtml}
      />
    </aside>
  );
}

/**
 * Deletes stored files no remaining template references. Duplicated templates
 * share file ids, so a file is only removed once nothing points at it.
 */
function releaseFiles(ids: string[], otherTemplates: EmailTemplate[]) {
  if (ids.length === 0) return;
  const stillUsed = new Set(otherTemplates.flatMap((t) => (t.attachments ?? []).map((a) => a.id)));
  const orphaned = ids.filter((id) => !stillUsed.has(id));
  // Best effort: an orphaned file only costs storage, so failures are ignored.
  void deleteFiles(orphaned).catch(() => undefined);
}
