import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, CalendarCheck, Check, Clock, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useAuth } from "@/lib/auth-context";
import { useOrganizerStatus } from "@/hooks/use-organizer-status";
import {
  ONBOARDING_COPY as COPY,
  canRequestAccess,
  resolveOnboardingView,
} from "@/lib/organiserOnboarding";
import { profilePathFor } from "@/lib/postVerifyTarget";
import courtPhoto from "/assets/images/dynamic_tennis_ball_on_court_line_with_dramatic_lighting.png";

/*
  "Ready to organise tennis with TennisConnect?" - what a signed-in player or
  coach sees instead of the Organiser Hub until an admin approves them.

  - Desktop / tablet: centred dialog with a photo on the left.
  - Phone: bottom sheet, no photo, safe-area padding.
  - Radix Dialog supplies the focus trap, Escape, backdrop click and
    aria-modal. Closing (X, Escape, backdrop, "Back to My Profile") always
    goes to the person's own profile; nothing of the Hub is rendered behind it.
  - It reuses the existing request workflow: GET /api/organizer/requests/me
    and POST /api/organizer/requests. It never grants access itself, and an
    approval is only picked up from the server (the status poll below).
*/

interface Props {
  onDismiss: (profilePath: string) => void;
}

async function postOrganiserRequest(): Promise<{ ok: true } | { ok: false; message: string; alreadyPending: boolean }> {
  try {
    const res = await fetch("/api/organizer/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => ({}));
    const message = typeof json?.message === "string" ? json.message : "Something went wrong. Please try again.";
    return { ok: false, message, alreadyPending: res.status === 400 && /pending/i.test(message) };
  } catch {
    return { ok: false, message: "We couldn't reach TennisConnect. Check your connection and try again.", alreadyPending: false };
  }
}

export function OrganiserAccessModal({ onDismiss }: Props) {
  const { user, fetchCurrentUser } = useAuth();
  const { data: status, loading, refresh } = useOrganizerStatus(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const view = resolveOnboardingView({ status, loading, submitted });
  const profilePath = profilePathFor(user);
  const dismiss = () => onDismiss(profilePath);

  // Approved while this was open: re-read the account so the gate lets them in.
  useEffect(() => {
    if (view.kind === "approved") void fetchCurrentUser().catch(() => undefined);
  }, [view.kind, fetchCurrentUser]);

  async function requestAccess() {
    if (inFlight.current || !canRequestAccess(view)) return; // no double submit
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    const result = await postOrganiserRequest();
    if (result.ok) {
      setSubmitted(true);
      await refresh();
    } else if (result.alreadyPending) {
      await refresh(); // someone (another tab) already sent it: show "under review"
    } else {
      setError(result.message);
    }
    setSubmitting(false);
    inFlight.current = false;
  }

  const canRequest = canRequestAccess(view) && !submitting;
  const statusLine =
    view.kind === "pending" ? COPY.pending
    : view.kind === "submitted" ? COPY.submitted
    : view.kind === "rejected" ? COPY.rejected
    : view.kind === "revoked" ? COPY.revoked
    : view.kind === "error" ? COPY.statusError
    : null;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-testid="organiser-onboarding-modal"
          className={
            "fixed z-50 flex flex-col overflow-y-auto overscroll-contain bg-background shadow-2xl focus:outline-none " +
            // phone: bottom sheet
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)] " +
            // tablet / desktop: centred dialog
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,56rem)] sm:max-h-[90dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:flex-row sm:rounded-2xl sm:pb-0"
          }
        >
          <div
            aria-hidden="true"
            data-testid="organiser-onboarding-photo"
            className="hidden sm:block sm:w-2/5 sm:min-h-[26rem] shrink-0 bg-cover bg-center sm:rounded-l-2xl"
            style={{ backgroundImage: `url(${courtPhoto})` }}
          />

          <div className="relative flex-1 min-w-0 px-5 pb-6 pt-3 sm:px-8 sm:py-8">
            <span aria-hidden="true" className="mx-auto mb-4 block h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />

            <DialogPrimitive.Close
              aria-label="Close"
              data-testid="organiser-onboarding-close"
              className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-4 sm:top-4"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>

            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
              <CalendarCheck className="h-6 w-6" aria-hidden="true" />
            </span>

            <DialogPrimitive.Title className="pr-10 font-display text-2xl font-bold leading-tight sm:text-3xl">
              {COPY.heading}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-3 text-base text-muted-foreground">
              {COPY.body}
            </DialogPrimitive.Description>

            <ul className="mt-5 space-y-2.5" data-testid="organiser-onboarding-benefits">
              {COPY.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm sm:text-base">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary-text" aria-hidden="true" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div aria-live="polite" role="status" data-testid="organiser-onboarding-status" className="mt-5 empty:hidden">
              {view.kind === "loading" && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="organiser-onboarding-loading">
                  <TennisBallSpinner /> Checking your request…
                </span>
              )}
              {statusLine && (
                <p
                  data-testid={`organiser-onboarding-${view.kind}`}
                  className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm font-medium"
                >
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{statusLine}</span>
                </p>
              )}
            </div>

            {error && (
              <p role="alert" data-testid="organiser-onboarding-error" className="mt-3 rounded-lg border border-destructive/40 px-3 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              {view.kind === "error" ? (
                <Button size="lg" className="w-full" onClick={() => void refresh()} data-testid="organiser-onboarding-retry">
                  Try again
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!canRequest}
                  onClick={() => void requestAccess()}
                  data-testid="organiser-onboarding-request"
                >
                  {submitting && <TennisBallSpinner className="mr-2" />}
                  {view.kind === "rejected" || view.kind === "revoked" ? COPY.requestAgainCta : COPY.requestCta}
                  {!submitting && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={dismiss}
                data-testid="organiser-onboarding-back"
              >
                {COPY.backCta}
              </Button>
            </div>

            <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground" data-testid="organiser-onboarding-note">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{COPY.note}</span>
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
