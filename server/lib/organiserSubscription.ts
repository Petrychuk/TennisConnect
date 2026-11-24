/*
  Organiser Hub paid subscription (A$40/month, 7-day free trial) - flag and
  access rules. Pure apart from process.env; unit-tested in
  ./organiserSubscription.test.ts.

    ORGANISER_SUBSCRIPTION_ENABLED   unset / "false" / anything else -> OFF (default)
                                     "true" / "1" / "on"             -> ON

  OFF  Nothing changes: organiser access = admin approval only, no billing
       route does anything (they answer 404) and no pricing is shown.
  ON   Organiser access = admin approval AND (an active/trialing subscription
       OR a grandfathered account). Approval and payment stay separate:
       neither one alone ever grants organiser status.

  Existing organisers are grandfathered (free): rows in organiser_subscriptions
  with status "grandfathered", written by migration 0037's backfill (re-run
  it, it is idempotent, just before switching the flag on). Admins never need
  a subscription.

  Optional env:
    STRIPE_ORGANISER_PRICE_ID          a pre-created recurring AUD price; when
                                       unset an inline A$40/month price is used.
    STRIPE_ORGANISER_WEBHOOK_SECRET    signing secret of the billing webhook
                                       (falls back to STRIPE_WEBHOOK_SECRET).
*/

export const ORGANISER_PRICE = {
  amountCents: 4000,
  currency: "aud",
  interval: "month",
  trialDays: 7,
} as const;

export type SubscriptionStatus =
  | "none"
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "grandfathered";

type Env = Record<string, string | undefined>;

export function parseSubscriptionEnabled(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "on";
}

export function subscriptionEnabled(env: Env = process.env): boolean {
  return parseSubscriptionEnabled(env.ORGANISER_SUBSCRIPTION_ENABLED);
}

/** Statuses that count as a paid-up (or in-trial) subscription. */
export function isPayingStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export interface EntitlementInput {
  enabled: boolean;
  isAdmin?: boolean | null;
  /** Admin-approved organiser (users.is_organizer). */
  isOrganizer?: boolean | null;
  /** Stored subscription status, or null when the person has no row. */
  status?: string | null;
}

/** May this account use the Organiser Hub API right now? */
export function hasOrganiserEntitlement(input: EntitlementInput): boolean {
  if (input.isAdmin) return true;
  if (!input.isOrganizer) return false; // never granted by payment alone
  if (!input.enabled) return true; // flag off: approval only
  return input.status === "grandfathered" || isPayingStatus(input.status);
}

/** What the client should offer a signed-in, non-admin person. */
export type BillingStage =
  | "disabled" // flag off
  | "admin" // admins never need a subscription
  | "not_approved" // no organiser approval yet: request access first
  | "subscribe_required" // approved, no active subscription
  | "subscribed" // trialing/active
  | "grandfathered";

export function resolveBillingStage(input: EntitlementInput): BillingStage {
  if (!input.enabled) return "disabled";
  if (input.isAdmin) return "admin";
  if (!input.isOrganizer) return "not_approved";
  if (input.status === "grandfathered") return "grandfathered";
  if (isPayingStatus(input.status)) return "subscribed";
  return "subscribe_required";
}

/** Maps Stripe's subscription status to ours (unknown -> "incomplete"). */
export function normaliseStripeStatus(status: string | null | undefined): SubscriptionStatus {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "unpaid":
    case "canceled":
    case "incomplete":
      return status;
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "past_due";
    default:
      return "incomplete";
  }
}

/** A person may start a checkout only when approved and not already covered. */
export function checkoutBlockedReason(input: EntitlementInput): string | null {
  if (!input.enabled) return "Subscriptions are not enabled";
  if (input.isAdmin) return "Admins do not need a subscription";
  if (!input.isOrganizer) return "Your organiser request must be approved before you can subscribe";
  if (input.status === "grandfathered") return "Your organiser access does not require a subscription";
  if (isPayingStatus(input.status)) return "You already have an active subscription";
  return null;
}
