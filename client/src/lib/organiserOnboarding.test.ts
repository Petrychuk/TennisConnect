// npm run test:ui
//
// Organiser access modal (ORG-ONB-002..006, -011): which state it shows. It only
// chooses what to show; the server decides who may request (see
// server/routes/organizerRequests.test.ts).

import assert from "node:assert/strict";
import test from "node:test";
import { ONBOARDING_COPY, canRequestAccess, resolveOnboardingView, type OnboardingView } from "./organiserOnboarding";

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
