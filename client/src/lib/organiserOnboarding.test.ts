// npm run test:ui
//
// Organiser access modal (ORG-ONB-002..006, -011): which state it shows. It only
// chooses what to show; the server decides who may request (see
// server/routes/organizerRequests.test.ts).

import assert from "node:assert/strict";
import test from "node:test";
import {
  ONBOARDING_COPY,
  SUBSCRIPTION_COPY,
  canRequestAccess,
  formatPrice,
  pricingCopy,
  resolveOnboardingView,
  resolveSubscriptionView,
  type OnboardingView,
} from "./organiserOnboarding";

const none = { isOrganizer: false, request: null };
const withRequest = (status: "pending" | "approved" | "rejected" | "revoked", isOrganizer = false) => ({
  isOrganizer,
  request: { id: "r1", status },
});
const view = (status: Parameters<typeof resolveOnboardingView>[0]["status"], extra: { loading?: boolean; submitted?: boolean } = {}) =>
  resolveOnboardingView({ status, loading: extra.loading ?? false, submitted: extra.submitted ?? false });

test("copy matches the ticket word for word", () => {
  assert.equal(ONBOARDING_COPY.heading, "Ready to organise tennis with TennisConnect?");
  assert.equal(
    ONBOARDING_COPY.body,
    "Organiser Hub is an additional feature for people who want to create and manage tennis sessions, events and competitions.",
  );
  assert.deepEqual([...ONBOARDING_COPY.benefits], [
    "Create and manage tennis sessions",
    "Manage registrations and players",
    "Track scores and results",
  ]);
  assert.equal(ONBOARDING_COPY.requestCta, "Request Organiser Access");
  assert.equal(ONBOARDING_COPY.backCta, "Back to My Profile");
  assert.equal(ONBOARDING_COPY.note, "Organiser access is subject to approval. You can request access whenever you're ready.");
  assert.equal(ONBOARDING_COPY.pending, "Your organiser request is under review");
  assert.equal(
    ONBOARDING_COPY.submitted,
    "Your request has been submitted. We'll review your request and let you know when there's an update.",
  );
  assert.ok(!JSON.stringify(ONBOARDING_COPY).includes("player account is ready"));
});

test("no request yet: the button is live", () => {
  const v = view(none);
  assert.equal(v.kind, "none");
  assert.equal(canRequestAccess(v), true);
});

test("pending: shown as under review and the button is off", () => {
  const v = view(withRequest("pending"));
  assert.equal(v.kind, "pending");
  assert.equal(canRequestAccess(v), false);
});

test("a request sent in this visit shows the submitted message and keeps the button off", () => {
  for (const status of [none, withRequest("pending")]) {
    const v = view(status, { submitted: true });
    assert.equal(v.kind, "submitted");
    assert.equal(canRequestAccess(v), false);
  }
});

test("rejected / revoked: friendly status; the request button follows the API, which allows a new request", () => {
  assert.equal(view(withRequest("rejected")).kind, "rejected");
  assert.equal(view(withRequest("revoked")).kind, "revoked");
  assert.equal(canRequestAccess(view(withRequest("rejected"))), true);
  assert.equal(canRequestAccess(view(withRequest("revoked"))), true);
});

test("real access outranks any request row", () => {
  assert.equal(view(withRequest("rejected", true)).kind, "approved");
  assert.equal(view({ isOrganizer: true, request: null }).kind, "approved");
  assert.equal(canRequestAccess(view(withRequest("approved", true))), false);
});

test("loading and failed status checks never offer the button", () => {
  const loading: OnboardingView = view(null, { loading: true });
  const failed: OnboardingView = view(null, { loading: false });
  assert.equal(loading.kind, "loading");
  assert.equal(failed.kind, "error");
  assert.equal(canRequestAccess(loading), false);
  assert.equal(canRequestAccess(failed), false);
});

// ---------- Paid subscription copy and visibility (TC-190 section F) ----------

const PRICE = { amountCents: 4000, currency: "aud", interval: "month", trialDays: 7 };

test("price formats as A$40, with cents only when there are some", () => {
  assert.equal(formatPrice(PRICE), "A$40");
  assert.equal(formatPrice({ amountCents: 3950, currency: "aud" }), "A$39.50");
  assert.equal(formatPrice({ amountCents: 1000, currency: "usd" }), "USD 10");
});

test("pricing copy matches the ticket word for word", () => {
  const copy = pricingCopy(PRICE);
  assert.equal(copy.title, "Organiser Hub — A$40/month");
  assert.equal(copy.trial, "Start with a 7-day free trial.");
  assert.equal(
    copy.terms,
    "Try Organiser Hub free for 7 days. After your trial ends, your subscription will automatically renew at A$40 per month until you cancel.",
  );
  assert.equal(copy.cancel, "Cancel anytime before your trial ends to avoid being charged.");
});

test("the copy follows the server's price, so it cannot drift from what is charged", () => {
  const copy = pricingCopy({ ...PRICE, amountCents: 5000, trialDays: 14 });
  assert.match(copy.title, /A\$50\/month/);
  assert.match(copy.trial, /14-day/);
  assert.match(copy.terms, /free for 14 days/);
});

test("subscription UI is hidden unless the server says subscriptions are on", () => {
  assert.equal(resolveSubscriptionView(null), "hidden");
  assert.equal(resolveSubscriptionView(undefined), "hidden");
  assert.equal(resolveSubscriptionView({ enabled: false, stage: "disabled" }), "hidden");
  // Even a "stage" that would show something is ignored while billing is off.
  assert.equal(resolveSubscriptionView({ enabled: false, stage: "not_approved" }), "hidden");
  assert.equal(resolveSubscriptionView({ enabled: false, stage: "subscribe_required" }), "hidden");
});

test("subscription UI per stage when on: pricing before approval, subscribe after, manage once paying", () => {
  assert.equal(resolveSubscriptionView({ enabled: true, stage: "not_approved" }), "request-pricing");
  assert.equal(resolveSubscriptionView({ enabled: true, stage: "subscribe_required" }), "subscribe");
  assert.equal(resolveSubscriptionView({ enabled: true, stage: "subscribed" }), "manage");
  assert.equal(resolveSubscriptionView({ enabled: true, stage: "grandfathered" }), "hidden");
  assert.equal(resolveSubscriptionView({ enabled: true, stage: "admin" }), "hidden");
});

test("the primary CTA and the approval rule are unchanged by billing", () => {
  assert.equal(ONBOARDING_COPY.requestCta, "Request Organiser Access");
  assert.equal(canRequestAccess({ kind: "none" }), true);
  assert.match(ONBOARDING_COPY.note, /subject to approval/);
  assert.match(SUBSCRIPTION_COPY.afterApproval, /approved/);
});
