import { friendlyApiError } from "@/lib/apiError";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { OrganiserLayout } from "@/components/organiser/ui/organiser-layout";

import { WizardStepSidebar } from "@/components/organiser/sessions/wizard/wizard-step-sidebar";
import { WizardStepIndicator } from "@/components/organiser/sessions/wizard/wizard-step-indicator";
import { Step1SessionType } from "@/components/organiser/sessions/wizard/step1-session-type";
import { Step2DateRegistration } from "@/components/organiser/sessions/wizard/step2-date-registration";
import { Step3DetailsRules } from "@/components/organiser/sessions/wizard/step3-details-rules";
import { Step4ReviewPublish } from "@/components/organiser/sessions/wizard/step4-review-publish";
import { PendingApprovalDialog } from "@/components/organiser/sessions/wizard/pending-approval-dialog";

import { ensureMyOrganization, createSession, updateSession, publishSession, getSessionById, getSessionTemplates } from "@/lib/api/organizer-sessions";
import { createDraftSaver, DraftConflictError } from "@/lib/sessionDraftSaver";
import { PUBLISHABLE_STATUSES, publishProblems } from "@shared/sessionDraft";
import {
  createEmptyDraft,
  draftToInsertSession,
  draftToSessionPayload,
  savedSessionToDraft,
  sessionToDraft,
  templateToDraft,
  SESSION_TYPE_OPTIONS,
  type NewSessionDraft,
} from "@/lib/organiser-session-wizard-types";

export default function OrganiserSessionNewPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [draft, setDraft] = useState<NewSessionDraft>(createEmptyDraft);
  const [step, setStep] = useState(1);
  const [maxReachedStep, setMaxReachedStep] = useState(1);
  const [pendingApprovalOpen, setPendingApprovalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Save as Draft: one saver for the life of the page. It creates the draft the
  // first time and updates that same row afterwards (lib/sessionDraftSaver.ts).
  const saver = useRef(
    createDraftSaver({
      ensureOrganization: () => ensureMyOrganization(`${user?.name ?? "My"}'s Sessions`),
      create: (payload) => createSession(payload as any),
      update: (id, payload) => updateSession(id, payload as any),
    }),
  ).current;
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [conflict, setConflict] = useState(false);
  const [published, setPublished] = useState(false);
  // JSON of the draft as last saved (or loaded); differs from the live draft = unsaved changes.
  const [lastSaved, setLastSaved] = useState(() => JSON.stringify(createEmptyDraft()));
  const isDirty = useMemo(() => JSON.stringify(draft) !== lastSaved, [draft, lastSaved]);

  // "Continue Setup" on a draft lands here with ?draft=<id>: load what was saved
  // (savedSessionToDraft keeps every field as saved) and keep saving to that row.
  const search = useSearch();
  const draftId = new URLSearchParams(search).get("draft");
  const [draftLoading, setDraftLoading] = useState(!!draftId);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const [draftReloadKey, setDraftReloadKey] = useState(0);
  useEffect(() => {
    if (!draftId) return;
    if (saver.id() === draftId) return; // this page just created it; nothing to load
    let cancelled = false;
    setDraftLoading(true);
    setDraftLoadError(null);
    getSessionById(draftId)
      .then((session) => {
        if (cancelled) return;
        if (!(PUBLISHABLE_STATUSES as readonly string[]).includes(session.status)) {
          // Only a draft is edited here; anything else has its own page.
          toast({ title: "This session is no longer a draft", description: "Opening it in the session workspace instead." });
          setLocation(`/organiser/sessions/${session.id}`, { replace: true });
          return;
        }
        const loaded = savedSessionToDraft(session);
        saver.adopt(session);
        setDraft(loaded);
        setLastSaved(JSON.stringify(loaded));
        setSavedAt(new Date(session.updatedAt));
        const start = loaded.type === null ? 1 : 2;
        setStep(start);
        setMaxReachedStep(4); // everything is already filled in: every step is reachable
        setDraftLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setDraftLoadError(friendlyApiError(error, "We couldn't load this draft."));
          setDraftLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, draftReloadKey]);

  // Leaving with unsaved changes: the browser's own "Leave site?" prompt.
  useEffect(() => {
    if (!isDirty || published) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, published]);

  // "Duplicate" (from the sessions list or a session's own workspace
  // page) lands here with ?duplicateFrom=<id> instead of silently
  // creating a copy server-side with no review step - loads the real
  // source session and pre-fills the draft from it (sessionToDraft),
  // so duplicating behaves exactly like starting a fresh session that
  // merely has last time's values pre-filled: reviewable, editable, and
  // going through the same publish step as any other new session
  // (which is also what actually sets a sensible status - the session
  // this replaced never called publishSession, so it sat stuck as
  // "draft" forever).
  const duplicateFromId = new URLSearchParams(search).get("duplicateFrom");
  useEffect(() => {
    if (!duplicateFromId) return;
    let cancelled = false;
    getSessionById(duplicateFromId)
      .then((source) => {
        if (!cancelled) setDraft(sessionToDraft(source));
      })
      .catch(() => {
        if (!cancelled) {
          toast({ title: "Couldn't load that session to duplicate", variant: "destructive" });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateFromId]);

  // "Use Template" (from the Templates page) lands here with
  // ?templateId=<id> - pre-fills the same way duplicateFrom does, via
  // templateToDraft instead of sessionToDraft. templateToDraft already
  // starts from createEmptyDraft() (today's date) and only ever
  // overrides the reusable fields a template actually stores, so the
  // date/registration-window fields are already fresh without any
  // extra reset logic needed here - the organiser still reviews and
  // picks a real date on Step 2 like any other new session, exactly
  // per the "template does not create a session immediately" rule.
  //
  // No single-template GET route exists - list + find is the simplest
  // correct option (an organiser typically has few templates) rather
  // than adding a route just for this one pre-fill.
  const templateId = new URLSearchParams(search).get("templateId");
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    getSessionTemplates()
      .then((templates) => {
        const template = templates.find((t) => t.id === templateId);
        if (!cancelled && template) setDraft(templateToDraft(template));
        else if (!cancelled) toast({ title: "That template couldn't be found", variant: "destructive" });
      })
      .catch(() => {
        if (!cancelled) {
          toast({ title: "Couldn't load that template", variant: "destructive" });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const updateDraft = <K extends keyof NewSessionDraft>(key: K, value: NewSessionDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const goToStep = (target: number) => {
    if (target <= maxReachedStep) setStep(target);
  };

  const canProceedFromStep1 = draft.type !== null;
  const canProceedFromStep2 =
    draft.name.trim().length > 0 &&
    draft.venue.trim().length > 0 &&
    !!draft.date &&
    (!draft.registrationCloses || draft.registrationCloses <= draft.date);

  const step2ValidationError = (): string => {
    if (!draft.name.trim() || !draft.venue.trim() || !draft.date) {
      return "Give your session a name, venue, and date to continue";
    }
    if (draft.registrationCloses && draft.registrationCloses > draft.date) {
      return "Registration can't close after the session date";
    }
    return "";
  };

  const handleNext = () => {
    if (step === 1 && !canProceedFromStep1) {
      toast({ title: "Choose a session type to continue" });
      return;
    }
    if (step === 2 && !canProceedFromStep2) {
      toast({ title: step2ValidationError(), variant: "destructive" });
      return;
    }
    const next = Math.min(step + 1, 4);
    setStep(next);
    setMaxReachedStep((prev) => Math.max(prev, next));
  };

  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1));

  const submitting = saving;

  // Save as Draft, from any step. No publish-only validation: a draft may be
  // incomplete. Resolves true only if the server confirmed the save.
  const saveDraftNow = async (options: { quiet?: boolean } = {}): Promise<boolean> => {
    if (saver.isSaving() || draftLoading || draftLoadError) return false;
    const snapshot = JSON.stringify(draft);
    setSaving(true);
    try {
      const wasNew = saver.id() === null;
      const row = await saver.save((mode) => draftToSessionPayload(draft, mode));
      setLastSaved(snapshot);
      setSavedAt(new Date(row.updatedAt));
      setConflict(false);
      // The Sessions list (All and Drafts) must show it straight away.
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", row.id] });
      if (wasNew) setLocation(`/organiser/sessions/new?draft=${row.id}`, { replace: true });
      if (!options.quiet) toast({ title: "Session saved as draft" });
      return true;
    } catch (error) {
      if (error instanceof DraftConflictError) {
        setConflict(true);
        toast({ title: "Draft changed elsewhere", description: "Reload to see the latest version before saving.", variant: "destructive" });
      } else {
        toast({ title: "Couldn't save draft", description: friendlyApiError(error), variant: "destructive" });
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = () => {
    void saveDraftNow();
  };

  // Publish the draft that already exists (saving the latest edits to it first),
  // never a second copy. The server only publishes a draft and re-checks that the
  // required fields are there.
  const handlePublish = async () => {
    if (saver.isSaving() || published || draftLoading || draftLoadError) return;
    const insert = draftToInsertSession(draft);
    const problems = publishProblems({
      title: draft.name,
      location: draft.venue,
      startAt: insert.startAt,
      endAt: insert.endAt,
      registrationOpensAt: insert.registrationOpensAt,
      registrationClosesAt: insert.registrationClosesAt,
    });
    if (problems.length > 0 || !canProceedFromStep2) {
      toast({ title: problems[0] ?? step2ValidationError(), variant: "destructive" });
      setStep(2);
      return;
    }
    if (!(await saveDraftNow({ quiet: true }))) return;
    const id = saver.id();
    if (!id) return;
    setSaving(true);
    try {
      const updated = await publishSession(id);
      saver.adopt(updated);
      setPublished(true);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", id] });
      setPendingApprovalOpen(true);
    } catch (error) {
      toast({ title: "Couldn't publish session", description: friendlyApiError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === draft.type)?.label ?? "session";

  return (
    <OrganiserLayout
      testId="organiser-session-new-page"
      seoTitle="Create New Session | Organiser Hub | TennisConnect"
      seoDescription="Create a new tennis session in just a few steps."
      mobileTitle="New Session"
    >

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-6xl mx-auto">
          {/* Desktop header row */}
          <div className="hidden xl:block">
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Create New Session</h1>
            <p className="text-muted-foreground mt-1">Create a new tennis session in just a few steps.</p>
          </div>

          {/* Tablet/mobile header */}
          <div className="xl:hidden">
            <h1 className="font-display text-xl sm:text-2xl font-bold">Create New Session</h1>
            <p className="text-muted-foreground text-sm mt-1">Create a new tennis session in just a few steps.</p>
          </div>

          {/* Tablet/mobile step indicator */}
          <div className="xl:hidden">
            <WizardStepIndicator currentStep={step} maxReachedStep={maxReachedStep} onStepClick={goToStep} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="hidden xl:block">
              <WizardStepSidebar currentStep={step} maxReachedStep={maxReachedStep} onStepClick={goToStep} />
            </div>

            <div className="xl:col-span-3 space-y-6">
              {!draftLoading && !draftLoadError && step === 1 && <Step1SessionType value={draft.type} onChange={(v) => updateDraft("type", v)} />}
              {!draftLoading && !draftLoadError && step === 2 && <Step2DateRegistration draft={draft} onChange={updateDraft} />}
              {!draftLoading && !draftLoadError && step === 3 && <Step3DetailsRules draft={draft} onChange={updateDraft} />}
              {!draftLoading && !draftLoadError && step === 4 && <Step4ReviewPublish draft={draft} />}

              {draftLoading && (
                <p className="text-sm text-muted-foreground" role="status" data-testid="organiser-wizard-draft-loading">
                  Loading your draft…
                </p>
              )}
              {draftLoadError && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm" data-testid="organiser-wizard-draft-load-error">
                  <span>{draftLoadError}</span>
                  <Button size="sm" variant="outline" className="min-h-11" onClick={() => setDraftReloadKey((k) => k + 1)} data-testid="organiser-wizard-draft-retry">
                    Try again
                  </Button>
                </div>
              )}
              {conflict && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm" data-testid="organiser-wizard-conflict">
                  <span>This draft was changed somewhere else (another tab or device). Reload to see the latest version before saving, so nothing is overwritten.</span>
                  <Button size="sm" variant="outline" className="min-h-11" onClick={() => window.location.reload()} data-testid="organiser-wizard-conflict-reload">
                    Reload latest
                  </Button>
                </div>
              )}
              {!draftLoading && !draftLoadError && (
                <p className="text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="organiser-wizard-save-status">
                  {saving
                    ? "Saving…"
                    : isDirty
                      ? savedAt ? "Unsaved changes" : "Not saved yet"
                      : savedAt
                        ? `Draft saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                        : "Not saved yet"}
                </p>
              )}

              {/* Tablet/mobile nav buttons */}
              <div className="xl:hidden flex flex-col sm:flex-row gap-2">
                {step > 1 && (
                  <Button variant="outline" onClick={handleBack} className="sm:order-1" data-testid="organiser-wizard-back">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                <Button variant="outline" onClick={handleSaveDraft} disabled={submitting || draftLoading || !!draftLoadError} className="sm:order-2" data-testid="organiser-wizard-save-draft">
                  {saving ? "Saving…" : "Save Draft"}
                </Button>
                {step < 4 ? (
                  <Button onClick={handleNext} className="sm:order-3 sm:ml-auto" data-testid="organiser-wizard-next">
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handlePublish} disabled={submitting || published || draftLoading || !!draftLoadError} className="sm:order-3 sm:ml-auto" data-testid="organiser-wizard-publish">
                    Publish Session
                  </Button>
                )}
              </div>

              {/* Desktop bottom nav row (Back appears once past step 1) */}
              <div className="hidden xl:flex items-center justify-between">
                <div>
                  {step > 1 && (
                    <Button variant="outline" onClick={handleBack} data-testid="organiser-wizard-back-bottom">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleSaveDraft} disabled={submitting || draftLoading || !!draftLoadError} data-testid="organiser-wizard-save-draft-bottom">
                    {saving ? "Saving…" : "Save as Draft"}
                  </Button>
                  {step < 4 ? (
                    <Button onClick={handleNext} data-testid="organiser-wizard-next-bottom">
                      Next Step
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button onClick={handlePublish} disabled={submitting || published || draftLoading || !!draftLoadError} data-testid="organiser-wizard-publish-bottom">
                      Publish Session
                    </Button>
                  )}
                </div>
              </div>

              {step === 1 && (
                <div className="rounded-2xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <Clock className="w-5 h-5 text-primary-text shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">You can always edit session details later</p>
                    <p className="text-xs text-muted-foreground">Everything here can be changed from Edit Session until the session starts.</p>
                  </div>
                  {/* "View example sessions" only toasted "isn't wired up yet" - removed (no examples exist). */}
                </div>
              )}
            </div>
          </div>
        </div>

      <PendingApprovalDialog open={pendingApprovalOpen} sessionName={draft.name || "Untitled Session"} sessionTypeLabel={typeLabel} />
    </OrganiserLayout>
  );
}
