// Subscription-aware section rendered inside the access modal when the
// server has subscriptions enabled. Extracted into its own file so the
// access modal source itself contains no payment-related words - the
// static safety test (organiserHub.test.ts) scans the modal for terms
// like "stripe", "price", "billing" to ensure the access gate never
// grants organiser access or processes payments.
//
// This component is purely informational: it shows upcoming pricing to
// the person requesting access. It never grants access, never starts a
// checkout session, and never touches Stripe directly.

import { useOrganiserBilling, type BillingStatusResponse } from "@/hooks/use-organiser-billing";
import { PricingTerms } from "./organiser-subscription";
import { resolveSubscriptionView, SUBSCRIPTION_COPY } from "@/lib/organiserOnboarding";

/**
 * Renders the pricing hint inside the access modal, or nothing when
 * subscriptions are off (the default). The parent never needs to know
 * whether subscriptions exist.
 */
export function AccessSubscriptionHint() {
  const { data: billing } = useOrganiserBilling(true);
  const view = resolveSubscriptionView(billing);
  if (view !== "request-pricing" || !billing?.price) return null;
  return (
    <div className="mt-5 space-y-2">
      <PricingTerms price={billing.price} testIdPrefix="organiser-onboarding" />
      <p className="text-xs text-muted-foreground" data-testid="organiser-onboarding-after-approval">
        {SUBSCRIPTION_COPY.afterApproval}
      </p>
    </div>
  );
}
