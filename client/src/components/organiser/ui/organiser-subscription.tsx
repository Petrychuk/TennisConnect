import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useAuth } from "@/lib/auth-context";
import { startBillingRedirect, useOrganiserBilling, type OrganiserBillingStatus } from "@/hooks/use-organiser-billing";
import {
  ONBOARDING_COPY as COPY,
  SUBSCRIPTION_COPY as SUB,
  pricingCopy,
  resolveSubscriptionView,
  type BillingPrice,
} from "@/lib/organiserOnboarding";
import { profilePathFor } from "@/lib/postVerifyTarget";

/*
  Paid Organiser Hub subscription UI. Everything here is rendered only when the
  server reports subscriptions are ON (see resolveSubscriptionView); with the
  flag off none of it appears and the organiser flow is exactly as before.
  Approval and payment are separate: this never grants access - the server
  decides (requireOrganizer) and the Stripe webhook is what activates a plan.
*/

/** All trial and renewal terms, together and visible - no tooltip. */
export function PricingTerms({ price, testIdPrefix }: { price: BillingPrice; testIdPrefix: string }) {
  const copy = pricingCopy(price);
  return (
    <section
      aria-label="Subscription pricing"
      data-testid={`${testIdPrefix}-pricing`}
      className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm"
    >
      <p className="font-semibold text-foreground" data-testid={`${testIdPrefix}-pricing-title`}>{copy.title}</p>
      <p className="mt-1 font-medium text-foreground" data-testid={`${testIdPrefix}-pricing-trial`}>{copy.trial}</p>
      <p className="mt-1 text-muted-foreground" data-testid={`${testIdPrefix}-pricing-terms`}>{copy.terms}</p>
      <p className="mt-1 text-muted-foreground" data-testid={`${testIdPrefix}-pricing-cancel`}>{copy.cancel}</p>
    </section>
  );
}

/** The approved organiser who still has to subscribe (stage "subscribe_required"). */
export function OrganiserSubscribeModal({
  billing,
  returningFromCheckout,
  onDismiss,
}: {
  billing: OrganiserBillingStatus;
  returningFromCheckout: boolean;
  onDismiss: (profilePath: string) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profilePath = profilePathFor(user);
  const cancelled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("subscription") === "cancelled";

  async function subscribe() {
    if (busy) return; // no double submit
    setBusy(true);
    setError(null);
    const failed = await startBillingRedirect("/checkout");
    if (failed) {
      setError(failed.message);
      setBusy(false);
    } // on success the browser is already leaving for Stripe
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onDismiss(profilePath); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          data-testid="organiser-subscribe-modal"
          className="fixed z-50 flex max-h-[92dvh] flex-col overflow-y-auto bg-background p-5 shadow-2xl focus:outline-none inset-x-0 bottom-0 rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,32rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-8"
        >
          <DialogPrimitive.Close
            aria-label="Close"
            data-testid="organiser-subscribe-close"
            className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-4 sm:top-4"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>

          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
            <CreditCard className="h-6 w-6" aria-hidden="true" />
          </span>
          <DialogPrimitive.Title className="pr-10 font-display text-2xl font-bold leading-tight">{SUB.subscribeHeading}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-3 text-base text-muted-foreground">{SUB.subscribeBody}</DialogPrimitive.Description>

          {billing.price && <div className="mt-5"><PricingTerms price={billing.price} testIdPrefix="organiser-subscribe" /></div>}

          <div aria-live="polite" role="status" className="mt-4 empty:hidden">
            {returningFromCheckout && (
              <p data-testid="organiser-subscribe-confirming" className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm font-medium">
                <TennisBallSpinner />
                <span>{SUB.confirming} <span className="font-normal text-muted-foreground">{SUB.confirmingHint}</span></span>
              </p>
            )}
            {!returningFromCheckout && cancelled && (
              <p data-testid="organiser-subscribe-cancelled" className="rounded-lg bg-muted px-3 py-2.5 text-sm">{SUB.cancelled}</p>
            )}
          </div>
          {error && (
            <p role="alert" data-testid="organiser-subscribe-error" className="mt-3 rounded-lg border border-destructive/40 px-3 py-2.5 text-sm text-destructive">{error}</p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" className="w-full" disabled={busy || returningFromCheckout} onClick={() => void subscribe()} data-testid="organiser-subscribe-cta">
              {busy && <TennisBallSpinner className="mr-2" />}
              {SUB.subscribeCta}
              {!busy && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={() => onDismiss(profilePath)} data-testid="organiser-subscribe-back">
              {COPY.backCta}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Wraps the Hub: an approved organiser without a subscription sees the subscribe modal instead. */
export function useSubscriptionGate() {
  const { user } = useAuth();
  const applies = !!user?.isOrganizer && !user?.isAdmin;
  const returning = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("subscription") === "success";
  const { data, loading } = useOrganiserBilling(applies, returning ? 3000 : 0);
  return {
    loading: applies && !data && loading,
    mustSubscribe: applies && !!data && resolveSubscriptionView(data) === "subscribe",
    billing: data,
    returning,
  };
}

/** "Manage subscription" (Stripe billing portal: update card, cancel) for a paying organiser. */
export function ManageSubscriptionRow() {
  const { data } = useOrganiserBilling(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (resolveSubscriptionView(data) !== "manage") return null;

  async function open() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failed = await startBillingRedirect("/portal");
    if (failed) {
      setError(failed.message);
      setBusy(false);
    }
  }

  const note = data?.status === "trialing" ? "Free trial" : "Active";
  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between" data-testid="organiser-subscription-row">
      <span className="text-sm text-muted-foreground" data-testid="organiser-subscription-status">
        Subscription: {note}{data?.cancelAtPeriodEnd ? " · ends at the end of the period" : ""}
      </span>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void open()} data-testid="organiser-subscription-manage">
        {busy && <TennisBallSpinner className="mr-2" />}
        {SUB.manageCta}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive" data-testid="organiser-subscription-error">{error}</p>}
    </div>
  );
}
