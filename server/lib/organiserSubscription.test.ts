// npx tsx --test server/lib/organiserSubscription.test.ts
//
// Organiser Hub paid subscription: the flag, the access rule ("approval AND
// subscription", grandfathered organisers, admins) and Stripe status mapping.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ORGANISER_PRICE,
  checkoutBlockedReason,
  hasOrganiserEntitlement,
  isPayingStatus,
  normaliseStripeStatus,
  parseSubscriptionEnabled,
  resolveBillingStage,
  subscriptionEnabled,
} from "./organiserSubscription";

test("price: A$40 a month with a 7-day trial", () => {
  assert.deepEqual({ ...ORGANISER_PRICE }, { amountCents: 4000, currency: "aud", interval: "month", trialDays: 7 });
});

test("the flag is OFF unless explicitly turned on", () => {
  for (const raw of [undefined, "", "false", "0", "off", "no", "maybe", "internal"]) {
    assert.equal(parseSubscriptionEnabled(raw), false, `value ${String(raw)}`);
  }
  for (const raw of ["true", "TRUE", " 1 ", "on", "On"]) {
    assert.equal(parseSubscriptionEnabled(raw), true, `value ${raw}`);
  }
  assert.equal(subscriptionEnabled({}), false);
  assert.equal(subscriptionEnabled({ ORGANISER_SUBSCRIPTION_ENABLED: "true" }), true);
});

test("only active and trialing count as paying", () => {
  assert.equal(isPayingStatus("active"), true);
  assert.equal(isPayingStatus("trialing"), true);
  for (const s of ["none", "incomplete", "past_due", "unpaid", "canceled", "grandfathered", "", null, undefined]) {
    assert.equal(isPayingStatus(s), false, `status ${String(s)}`);
  }
});

test("flag OFF: access is the admin approval alone (today's behaviour)", () => {
  assert.equal(hasOrganiserEntitlement({ enabled: false, isOrganizer: true, status: null }), true);
  assert.equal(hasOrganiserEntitlement({ enabled: false, isOrganizer: true, status: "canceled" }), true);
  assert.equal(hasOrganiserEntitlement({ enabled: false, isOrganizer: false, status: "active" }), false);
});

test("flag ON: approval AND an active/trialing subscription are both required", () => {
  const on = { enabled: true, isAdmin: false };
  assert.equal(hasOrganiserEntitlement({ ...on, isOrganizer: true, status: "trialing" }), true);
  assert.equal(hasOrganiserEntitlement({ ...on, isOrganizer: true, status: "active" }), true);
  assert.equal(hasOrganiserEntitlement({ ...on, isOrganizer: true, status: null }), false, "approved, not subscribed");
  assert.equal(hasOrganiserEntitlement({ ...on, isOrganizer: true, status: "past_due" }), false);
  assert.equal(hasOrganiserEntitlement({ ...on, isOrganizer: true, status: "canceled" }), false);
  assert.equal(hasOrganiserEntitlement({ ...on, isOrganizer: false, status: "active" }), false, "payment alone never grants organiser status");
  assert.equal(hasOrganiserEntitlement({ ...on, isOrganizer: false, status: "trialing" }), false);
});

test("flag ON: grandfathered organisers keep free access, and only approved ones", () => {
  assert.equal(hasOrganiserEntitlement({ enabled: true, isOrganizer: true, status: "grandfathered" }), true);
  assert.equal(hasOrganiserEntitlement({ enabled: true, isOrganizer: false, status: "grandfathered" }), false);
});

test("admins never need a subscription, flag on or off", () => {
  assert.equal(hasOrganiserEntitlement({ enabled: true, isAdmin: true, isOrganizer: false, status: null }), true);
  assert.equal(hasOrganiserEntitlement({ enabled: false, isAdmin: true, isOrganizer: false, status: null }), true);
});

test("billing stage drives what the client offers", () => {
  assert.equal(resolveBillingStage({ enabled: false, isOrganizer: true }), "disabled");
  assert.equal(resolveBillingStage({ enabled: true, isAdmin: true }), "admin");
  assert.equal(resolveBillingStage({ enabled: true, isOrganizer: false }), "not_approved");
  assert.equal(resolveBillingStage({ enabled: true, isOrganizer: true, status: null }), "subscribe_required");
  assert.equal(resolveBillingStage({ enabled: true, isOrganizer: true, status: "canceled" }), "subscribe_required");
  assert.equal(resolveBillingStage({ enabled: true, isOrganizer: true, status: "trialing" }), "subscribed");
  assert.equal(resolveBillingStage({ enabled: true, isOrganizer: true, status: "active" }), "subscribed");
  assert.equal(resolveBillingStage({ enabled: true, isOrganizer: true, status: "grandfathered" }), "grandfathered");
});

test("checkout is allowed only for an approved, not-yet-covered organiser while the flag is on", () => {
  assert.match(checkoutBlockedReason({ enabled: false, isOrganizer: true }) ?? "", /not enabled/i);
  assert.match(checkoutBlockedReason({ enabled: true, isAdmin: true }) ?? "", /admin/i);
  assert.match(checkoutBlockedReason({ enabled: true, isOrganizer: false }) ?? "", /approved/i);
  assert.match(checkoutBlockedReason({ enabled: true, isOrganizer: true, status: "grandfathered" }) ?? "", /does not require/i);
  assert.match(checkoutBlockedReason({ enabled: true, isOrganizer: true, status: "trialing" }) ?? "", /already/i);
  assert.equal(checkoutBlockedReason({ enabled: true, isOrganizer: true, status: null }), null);
  assert.equal(checkoutBlockedReason({ enabled: true, isOrganizer: true, status: "canceled" }), null, "may re-subscribe");
  assert.equal(checkoutBlockedReason({ enabled: true, isOrganizer: true, status: "past_due" }), null);
});

test("Stripe statuses map onto ours; unknown is never treated as paying", () => {
  for (const s of ["trialing", "active", "past_due", "unpaid", "canceled", "incomplete"] as const) {
    assert.equal(normaliseStripeStatus(s), s);
  }
  assert.equal(normaliseStripeStatus("incomplete_expired"), "canceled");
  assert.equal(normaliseStripeStatus("paused"), "past_due");
  assert.equal(normaliseStripeStatus("something_new"), "incomplete");
  assert.equal(normaliseStripeStatus(null), "incomplete");
  assert.equal(isPayingStatus(normaliseStripeStatus("something_new")), false);
});
