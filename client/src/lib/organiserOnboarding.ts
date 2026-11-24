import type { OrganizerStatusData } from "@/hooks/use-organizer-status";
import { resolveOrganizerCardView } from "@/lib/organizer-status";

// What the "Ready to organise tennis with TennisConnect?" modal shows a
// signed-in person who is not an organiser or admin. Pure, so it is unit-tested
// without a DOM. It only chooses what to SHOW: the server still decides who
// may request or organise (POST /api/organizer/requests, requireOrganizer).

export const ONBOARDING_COPY = {
  heading: "Ready to organise tennis with TennisConnect?",
  body: "Organiser Hub is an additional feature for people who want to create and manage tennis sessions, events and competitions.",
  benefits: [
    "Create and manage tennis sessions",
    "Manage registrations and players",
    "Track scores and results",
  ],
  requestCta: "Request Organiser Access",
  requestAgainCta: "Request Access Again",
  backCta: "Back to My Profile",
  note: "Organiser access is subject to approval. You can request access whenever you're ready.",
  pending: "Your organiser request is under review",
  submitted: "Your request has been submitted. We'll review your request and let you know when there's an update.",
  rejected: "Your last request was not approved.",
  revoked: "Your organiser access was revoked.",
  statusError: "We couldn't check your request status. Please try again.",
} as const;

export type OnboardingView =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "submitted" }
  | { kind: "rejected" }
  | { kind: "revoked" }
  | { kind: "approved" };

export interface OnboardingInput {
  status: OrganizerStatusData | null;
  loading: boolean;
  /** This visit already sent a request that the server accepted. */
  submitted: boolean;
}

export function resolveOnboardingView({ status, loading, submitted }: OnboardingInput): OnboardingView {
  if (!status) return loading ? { kind: "loading" } : { kind: "error" };
  // Same rule as the profile card: real access outranks any request row.
  const card = resolveOrganizerCardView(status);
  if (card.kind === "approved") return { kind: "approved" };
  if (card.kind === "pending") return submitted ? { kind: "submitted" } : { kind: "pending" };
  if (submitted) return { kind: "submitted" };
  return card;
}

/** The request button is only live where the API would accept a request. */
export function canRequestAccess(view: OnboardingView): boolean {
  return view.kind === "none" || view.kind === "rejected" || view.kind === "revoked";
}

// ---------- Paid subscription (ORGANISER_SUBSCRIPTION_ENABLED) ----------
// Pricing and trial terms are shown ONLY when the server says subscriptions
// are on (GET /api/organizer/billing/status -> enabled), so nothing here ever
// claims a trial or a charge while billing is off. The amount comes from the
// server's price, not from this file, so the copy can't drift from what
// Stripe charges.

export type BillingStage = "disabled" | "admin" | "not_approved" | "subscribe_required" | "subscribed" | "grandfathered";

export interface BillingPrice {
  amountCents: number;
  currency: string;
  interval: string;
  trialDays: number;
}

/** "A$40" for 4000 AUD cents; "A$39.50" when there are cents. */
export function formatPrice(price: Pick<BillingPrice, "amountCents" | "currency">): string {
  const symbol = price.currency.toLowerCase() === "aud" ? "A$" : `${price.currency.toUpperCase()} `;
  const amount = price.amountCents / 100;
  return `${symbol}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function pricingCopy(price: BillingPrice) {
  const amount = formatPrice(price);
  return {
    title: `Organiser Hub — ${amount}/month`,
    trial: `Start with a ${price.trialDays}-day free trial.`,
    terms: `Try Organiser Hub free for ${price.trialDays} days. After your trial ends, your subscription will automatically renew at ${amount} per month until you cancel.`,
    cancel: "Cancel anytime before your trial ends to avoid being charged.",
  };
}

export const SUBSCRIPTION_COPY = {
  afterApproval: "Your request is reviewed first. You'll be asked to start your subscription once it's approved.",
  subscribeHeading: "Your organiser request was approved",
  subscribeBody: "Start your Organiser Hub subscription to begin creating and managing sessions.",
  subscribeCta: "Start free trial",
  confirming: "Confirming your subscription…",
  confirmingHint: "This usually takes a few seconds. This page updates on its own.",
  cancelled: "Checkout was cancelled. You have not been charged.",
  manageCta: "Manage subscription",
  checkoutError: "We couldn't start checkout. Please try again.",
  unavailable: "Subscriptions aren't available right now. Please try again later.",
} as const;

export type SubscriptionView = "hidden" | "request-pricing" | "subscribe" | "manage";

/**
 * What the subscription UI shows. "request-pricing": pricing in the
 * request-access modal (not yet approved). "subscribe": the approved
 * organiser who still has to subscribe. "manage": a paying organiser.
 * Grandfathered organisers and admins never see billing UI.
 */
export function resolveSubscriptionView(billing: { enabled: boolean; stage: BillingStage } | null | undefined): SubscriptionView {
  if (!billing?.enabled) return "hidden";
  switch (billing.stage) {
    case "not_approved": return "request-pricing";
    case "subscribe_required": return "subscribe";
    case "subscribed": return "manage";
    default: return "hidden";
  }
}
