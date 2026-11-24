import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Send, X } from 'lucide-react';
import { EmailTemplate, Lead } from '../../types/outreach';
import { getFiles } from '../../utils/attachmentStore';
import { EmailStyle } from '../../utils/emailTheme';
import { refreshDeliveryEvents } from '../../utils/deliveryEvents';
import { ComposeRequest, useNavigation, useWorkspace } from '../../app/WorkspaceContext';
import { personalizeEmail, stripHtml } from '../../utils/personalization';
import { isValidEmail } from '../../utils/leadHelpers';
import { checkAttachments, PendingAttachment, toMeta } from '../../utils/attachments';
import { useEmailProvider } from '../../services/emailProvider';
import { Button, IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/Overlay';
import { cn } from '../../lib/cn';
import { Logo } from '../layout/Sidebar';
import { ComposerStep, RecipientPersonalization, STEPS, TemplateChoice } from './composerTypes';
import { AudienceStep } from './steps/AudienceStep';
import { MessageErrors, MessageStep } from './steps/MessageStep';
import { ReviewStep, SendState, SendStatusView } from './steps/ReviewStep';

function dateLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ComposerPage({ request }: { request: ComposeRequest }) {
  const ws = useWorkspace();
  const emailProvider = useEmailProvider();
  const { leads, templates, settings } = ws;
  const { navigate, returnPage, openComposer, setSelectedLeadIds } = useNavigation();

  // Initial state from the request; the page is keyed per request.
  const [initial] = useState(() => {
    const ids = request.leadIds.filter((id) => leads.some((l) => l.id === id));
    const tpl = request.templateId ? templates.find((t) => t.id === request.templateId) : undefined;
    return {
      recipientIds: ids,
      choice: (tpl?.id ?? null) as TemplateChoice,
      campaignName: tpl ? `${tpl.name} · ${dateLabel()}` : '',
      subject: tpl?.subject ?? '',
      bodyHtml: tpl?.bodyHtml ?? '',
      step: (ids.length > 0 && tpl ? 2 : 1) as ComposerStep,
    };
  });

  const hasSignature = stripHtml(settings.defaultSignatureHtml).length > 0;
  const [step, setStep] = useState<ComposerStep>(initial.step);
  const [recipientIds, setRecipientIds] = useState<string[]>(initial.recipientIds);
  const [choice, setChoice] = useState<TemplateChoice>(initial.choice);
  const [emailStyle, setEmailStyle] = useState<EmailStyle>(
    () => templates.find((t) => t.id === initial.choice)?.style ?? 'plain'
  );
  const [campaignName, setCampaignName] = useState(initial.campaignName);
  const [nameEdited, setNameEdited] = useState(false);
  const [subject, setSubject] = useState(initial.subject);
  const [bodyHtml, setBodyHtml] = useState(initial.bodyHtml);
  const [baseContent, setBaseContent] = useState({ subject: initial.subject, bodyHtml: initial.bodyHtml });
  const [includeSignature, setIncludeSignature] = useState(settings.includeSignatureByDefault && hasSignature);
  const [previewLeadId, setPreviewLeadId] = useState(initial.recipientIds[0] ?? '');
  const [attempted, setAttempted] = useState<Partial<Record<ComposerStep, boolean>>>({});
  const [sendState, setSendState] = useState<SendState>({ phase: 'idle' });
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  /** Signature of the attachments that came from the chosen template (for unsaved-changes checks). */
  const [baseAttachmentKey, setBaseAttachmentKey] = useState('');
  const loadSeq = useRef(0);

  const attachmentKey = (list: PendingAttachment[]) => list.map((a) => `${a.file.name}:${a.file.size}`).join('|');

  /** Replaces the attachments with the template's stored files (none for a blank email). */
  const loadTemplateAttachments = async (tpl: EmailTemplate | null) => {
    const seq = ++loadSeq.current;
    const metas = tpl?.attachments ?? [];
    if (metas.length === 0) {
      setAttachments([]);
      setBaseAttachmentKey('');
      return;
    }
    try {
      const stored = await getFiles(metas);
      if (seq !== loadSeq.current) return; // a newer template was picked meanwhile
      const loaded = metas
        .filter((m) => stored.has(m.id))
        .map((m) => ({ id: `att_${m.id}_${seq}`, file: stored.get(m.id)! }));
      setAttachments(loaded);
      setBaseAttachmentKey(attachmentKey(loaded));
      const missing = metas.length - loaded.length;
      if (missing > 0) {
        ws.addToast({
          type: 'warning',
          title: `${missing} template ${missing === 1 ? 'attachment was' : 'attachments were'} not found`,
          description: 'They may have been cleared from this browser. Re-attach them in the template.',
        });
      }
    } catch {
      if (seq !== loadSeq.current) return;
      setAttachments([]);
      setBaseAttachmentKey('');
      ws.addToast({ type: 'error', title: "Couldn't load the template's attachments" });
    }
  };

  // Opening the composer from a template: bring its files along.
  useEffect(() => {
    if (initial.choice && initial.choice !== 'scratch') {
      void loadTemplateAttachments(templates.find((t) => t.id === initial.choice) ?? null);
    }
    // Runs once for the request this page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Adds files within the limits and returns messages for anything rejected. */
  const addAttachments = (files: File[]): string[] => {
    const { accepted, errors } = checkAttachments(
      attachments.map((a) => a.file),
      files
    );
    if (accepted.length > 0) {
      setAttachments((cur) => [
        ...cur,
        ...accepted.map((file) => ({ id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, file })),
      ]);
    }
    return errors;
  };

  const [pendingChoice, setPendingChoice] = useState<Exclude<TemplateChoice, null> | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const sendingRef = useRef(false);

  // ----- Derived data -----
  const recipients = useMemo(
    () => recipientIds.map((id) => leads.find((l) => l.id === id)).filter((l): l is Lead => Boolean(l)),
    [recipientIds, leads]
  );
  const selectedTemplate = choice && choice !== 'scratch' ? templates.find((t) => t.id === choice) ?? null : null;
  const signatureHtml = includeSignature && hasSignature ? settings.defaultSignatureHtml : undefined;
  const effectiveName = campaignName.trim() || `${selectedTemplate?.name ?? 'Campaign'} · ${dateLabel()}`;

  const personalizations = useMemo<RecipientPersonalization[]>(
    () =>
      recipients.map((lead) => ({
        lead,
        result: personalizeEmail({ subject, bodyHtml, lead, signatureHtml }),
        validEmail: isValidEmail(lead.email),
      })),
    [recipients, subject, bodyHtml, signatureHtml]
  );

  const messageErrors: MessageErrors = attempted[2]
    ? {
        subject: subject.trim() ? undefined : 'Add a subject line.',
        body: stripHtml(bodyHtml) ? undefined : 'Write the message.',
      }
    : {};

  const isStepValid = (s: ComposerStep): boolean => {
    if (s === 1) return recipients.length > 0;
    if (s === 2) return Boolean(subject.trim() && stripHtml(bodyHtml));
    return true;
  };

  const dirty =
    sendState.phase !== 'done' &&
    (JSON.stringify(recipientIds) !== JSON.stringify(initial.recipientIds) ||
      choice !== initial.choice ||
      subject !== initial.subject ||
      bodyHtml !== initial.bodyHtml ||
      campaignName !== initial.campaignName ||
      attachmentKey(attachments) !== baseAttachmentKey);

  // ----- Step navigation -----
  const goTo = (target: ComposerStep) => {
    if (target > step) {
      for (let s = step; s < target; s++) {
        if (!isStepValid(s as ComposerStep)) {
          setAttempted((a) => ({ ...a, [s]: true }));
          setStep(s as ComposerStep);
          return;
        }
      }
    }
    if (target >= 2 && !recipients.some((r) => r.id === previewLeadId)) {
      setPreviewLeadId(recipients[0]?.id ?? '');
    }
    setStep(target);
    window.scrollTo({ top: 0 });
  };

  const exit = () => navigate(returnPage === 'compose' ? 'dashboard' : returnPage);
  const requestExit = () => (dirty ? setConfirmExit(true) : exit());

  // ----- Template choice -----
  const applyChoice = (next: Exclude<TemplateChoice, null>) => {
    const tpl = next === 'scratch' ? null : templates.find((t) => t.id === next) ?? null;
    const nextSubject = tpl?.subject ?? '';
    const nextBody = tpl?.bodyHtml ?? '';
    setChoice(next);
    setEmailStyle(tpl?.style ?? 'plain');
    setSubject(nextSubject);
    setBodyHtml(nextBody);
    setBaseContent({ subject: nextSubject, bodyHtml: nextBody });
    if (!nameEdited) setCampaignName(tpl ? `${tpl.name} · ${dateLabel()}` : '');
    void loadTemplateAttachments(tpl);
  };

  const chooseTemplate = (next: Exclude<TemplateChoice, null>) => {
    if (next === choice) return;
    const textChanged =
      (subject !== baseContent.subject || bodyHtml !== baseContent.bodyHtml) && Boolean(subject.trim() || stripHtml(bodyHtml));
    const filesChanged = attachmentKey(attachments) !== baseAttachmentKey;
    if (textChanged || filesChanged) setPendingChoice(next);
    else applyChoice(next);
  };

  // ----- Sending -----
  const send = async () => {
    if (sendingRef.current || recipients.length === 0) return;
    sendingRef.current = true;
    setConfirmSend(false);

    const campaignId = `camp_${Date.now()}`;
    const name = effectiveName;
    const templateName = selectedTemplate?.name ?? 'Custom email';
    const templateId = selectedTemplate?.id ?? 'custom';

    setSendState({ phase: 'sending', completed: 0, total: recipients.length, sent: 0, failed: 0, records: [] });
    try {
      const response = await emailProvider.sendPersonalizedBatch({
        campaignId,
        campaignName: name,
        templateId,
        templateName,
        subjectTemplate: subject,
        bodyHtmlTemplate: bodyHtml,
        recipients,
        attachments: attachments.map((a) => a.file),
        emailStyle,
        settings: { ...settings, includeSignatureByDefault: Boolean(signatureHtml) },
        onProgress: (p) =>
          setSendState((prev) =>
            prev.phase === 'sending'
              ? { ...prev, completed: p.completed, total: p.total, sent: p.sent, failed: p.failed, records: [...prev.records, p.latestRecord] }
              : prev
          ),
      });
      // Recorded only after the provider has returned its results.
      ws.recordSimulatedCampaign({
        campaignId,
        campaignName: name,
        templateId,
        templateName,
        records: response.records,
        sentCount: response.sentCount,
        failedCount: response.failedCount,
        notify: false, // this page shows the result itself
        simulated: response.simulated,
        opensTracked: !response.simulated && settings.openTrackingEnabled === true,
      });
      setSelectedLeadIds([]);
      if (!response.simulated) void refreshDeliveryEvents().then(ws.applyDeliveryEvents);
      const delivered = new Set(response.records.filter((r) => r.status === 'Sent').map((r) => r.leadId));
      const fresh = recipients.filter((l) => delivered.has(l.id) && l.status === 'New');
      if (fresh.length > 0) {
        ws.addToast({
          type: 'info',
          persistent: true,
          title: fresh.length === 1 ? `Mark ${fresh[0].fullName} as Contacted?` : `Mark ${fresh.length} new leads as Contacted?`,
          action: {
            label: 'Yes',
            onClick: () => ws.updateLeadsStatus(fresh.map((l) => l.id), 'Contacted'),
          },
        });
      }
      setSendState({ phase: 'done', sent: response.sentCount, failed: response.failedCount, records: response.records, campaignName: name });
    } catch (err) {
      setSendState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'The email provider returned an unexpected error.',
      });
    } finally {
      sendingRef.current = false;
    }
  };

  const onSendClick = () => (settings.confirmBeforeBulkSend ? setConfirmSend(true) : void send());
  const deliverableCount = personalizations.filter((p) => p.validEmail).length;
  const sending = sendState.phase === 'sending';
  const inSendFlow = sendState.phase !== 'idle';

  const footerError =
    attempted[step] && !isStepValid(step)
      ? step === 1
        ? 'Select at least one recipient to continue.'
        : 'Add a subject and a message to continue.'
      : null;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <IconButton label="Exit composer" onClick={requestExit} disabled={sending}>
            <X />
          </IconButton>
          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
          <span className="hidden sm:block">
            <Logo collapsed />
          </span>
          <div className="min-w-0 flex-1 lg:w-64 lg:flex-none">
            <label htmlFor="campaign-name" className="sr-only">
              Campaign name
            </label>
            <input
              id="campaign-name"
              value={campaignName}
              disabled={inSendFlow}
              onChange={(e) => {
                setCampaignName(e.target.value);
                setNameEdited(true);
              }}
              placeholder={effectiveName}
              title="Campaign name — only your team sees it"
              className="w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-ui font-semibold text-ink outline-none placeholder:text-ink-3 hover:border-line focus:border-accent focus:ring-3 focus:ring-accent/15 disabled:hover:border-transparent"
            />
          </div>

          <nav aria-label="Campaign steps" className="hidden flex-1 justify-center md:flex">
            <ol className="flex items-center gap-1">
              {STEPS.map(({ step: s, label }, i) => {
                const current = s === step && !inSendFlow;
                const complete = (s < step && isStepValid(s)) || sendState.phase === 'done';
                return (
                  <li key={s} className="flex items-center gap-1">
                    {i > 0 && <span className="h-px w-6 bg-line-strong" aria-hidden="true" />}
                    <button
                      type="button"
                      onClick={() => goTo(s)}
                      disabled={inSendFlow}
                      aria-current={current ? 'step' : undefined}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1 text-ui transition-colors disabled:cursor-default',
                        current ? 'font-medium text-ink' : 'text-ink-3 enabled:hover:bg-subtle enabled:hover:text-ink'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                          current
                            ? 'bg-accent text-white'
                            : complete
                            ? 'bg-accent-soft text-accent-ink'
                            : 'border border-line-strong text-ink-3'
                        )}
                      >
                        {complete && !current ? <Check className="size-3" strokeWidth={3} /> : s}
                      </span>
                      <span className={cn('whitespace-nowrap', !current && 'hidden lg:inline')}>{label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex shrink-0 items-center justify-end lg:w-64">
            {emailProvider.isSimulated && (
              <Badge tone="info" title="No email provider is connected. Sends are simulated.">
                Simulation
              </Badge>
            )}
          </div>
        </div>
        <div className="md:hidden">
          <p className="px-4 pb-2 text-xs text-ink-3">
            Step {step} of 3 · <span className="font-medium text-ink">{STEPS[step - 1].label}</span>
          </p>
          <div className="h-0.5 bg-muted">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6">
        {inSendFlow ? (
          <SendStatusView
            state={sendState as Exclude<SendState, { phase: 'idle' }>}
            isSimulated={emailProvider.isSimulated}
            onRetry={() => void send()}
            onBackToReview={() => setSendState({ phase: 'idle' })}
            onDashboard={() => navigate('dashboard')}
            onNewCampaign={() => openComposer()}
          />
        ) : (
          <>
            {step === 1 && <AudienceStep leads={leads} recipientIds={recipientIds} onChange={setRecipientIds} />}
            {step === 2 && (
              <MessageStep
                templates={templates}
                choice={choice}
                onChooseTemplate={chooseTemplate}
                subject={subject}
                bodyHtml={bodyHtml}
                onSubject={setSubject}
                onBody={setBodyHtml}
                includeSignature={includeSignature}
                hasSignature={hasSignature}
                onIncludeSignature={setIncludeSignature}
                errors={messageErrors}
                personalizations={personalizations}
                activeLeadId={previewLeadId}
                onActiveLeadChange={setPreviewLeadId}
                settings={settings}
                attachments={attachments}
                onAddFiles={addAttachments}
                onRemoveAttachment={(id) => setAttachments((cur) => cur.filter((a) => a.id !== id))}
                emailStyle={emailStyle}
                onEmailStyle={setEmailStyle}
              />
            )}
            {step === 3 && (
              <ReviewStep
                campaignName={effectiveName}
                templateName={selectedTemplate?.name ?? 'Custom email'}
                subject={subject}
                includeSignature={Boolean(signatureHtml)}
                attachments={attachments.map((a) => toMeta(a.file))}
                settings={settings}
                personalizations={personalizations}
                isSimulated={emailProvider.isSimulated}
                providerName={emailProvider.providerName}
                onEditStep={(s) => goTo(s)}
                onRemoveInvalid={() =>
                  setRecipientIds((ids) => ids.filter((id) => isValidEmail(leads.find((l) => l.id === id)?.email ?? '')))
                }
              />
            )}
          </>
        )}
      </main>

      {!inSendFlow && (
        <footer className="sticky bottom-0 z-20 border-t border-line bg-surface">
          <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
            <Button
              onClick={() => (step === 1 ? requestExit() : goTo((step - 1) as ComposerStep))}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            <p className="min-w-0 flex-1 truncate text-center text-xs text-danger sm:text-ui" role="status" aria-live="polite">
              {footerError}
            </p>
            {step < 3 ? (
              <Button variant="primary" onClick={() => goTo((step + 1) as ComposerStep)}>
                {step === 1
                  ? recipients.length > 0
                    ? `Continue with ${recipients.length}`
                    : 'Continue'
                  : 'Review'}
              </Button>
            ) : (
              <Button variant="primary" leadingIcon={<Send />} disabled={deliverableCount === 0} loading={sending} onClick={onSendClick}>
                Send to {deliverableCount} {deliverableCount === 1 ? 'recipient' : 'recipients'}
              </Button>
            )}
          </div>
        </footer>
      )}

      <ConfirmDialog
        open={pendingChoice !== null}
        title="Replace your edits?"
        description="Switching templates replaces the subject, message and attachments you've set."
        confirmLabel="Replace"
        destructive
        onConfirm={() => {
          if (pendingChoice) applyChoice(pendingChoice);
          setPendingChoice(null);
        }}
        onCancel={() => setPendingChoice(null)}
      />

      <ConfirmDialog
        open={confirmSend}
        title={`Send to ${deliverableCount} ${deliverableCount === 1 ? 'recipient' : 'recipients'}?`}
        description={
          <>
            <p>"{effectiveName}" goes out immediately and can't be recalled.</p>
            {emailProvider.isSimulated ? (
              <p className="mt-2 text-ink-3">Simulation mode: no real emails will be delivered.</p>
            ) : (
              <p className="mt-2 text-ink-3">
                Sending through {emailProvider.providerName}, a few seconds apart (about{' '}
                {Math.max(1, Math.ceil((deliverableCount * 3) / 60))} min). Keep this page open until it finishes.
              </p>
            )}
          </>
        }
        confirmLabel="Send now"
        loading={sending}
        onConfirm={() => void send()}
        onCancel={() => setConfirmSend(false)}
      />

      <ConfirmDialog
        open={confirmExit}
        title="Discard this campaign?"
        description="Your recipients and email content will be lost. Drafts aren't saved yet."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmExit(false);
          exit();
        }}
        onCancel={() => setConfirmExit(false)}
      />
    </div>
  );
}
