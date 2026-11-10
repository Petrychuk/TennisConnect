import test from "node:test";
import assert from "node:assert/strict";
import { joinBlockedReason, sessionHasFinished, sessionHasPolicies } from "./sessionJoinRules";

const now = new Date("2026-11-09T00:00:00Z");
const base = {
  description: null, rulesText: null, refundPolicy: null, latePolicy: null, cancellationPolicy: null,
  registrationOpensAt: null, registrationClosesAt: null,
  startAt: "2026-11-12T08:00:00Z", endAt: "2026-11-12T10:00:00Z", status: "published",
};

test("an open session without policies can be joined", () => {
  assert.equal(joinBlockedReason(base as any, false, now), null);
});

test("registration window is enforced", () => {
  assert.equal(joinBlockedReason({ ...base, registrationOpensAt: "2026-11-10T00:00:00Z" } as any, true, now), "Registration hasn't opened yet.");
  assert.equal(joinBlockedReason({ ...base, registrationClosesAt: "2026-11-08T00:00:00Z" } as any, true, now), "Registration is closed.");
  assert.equal(joinBlockedReason({ ...base, registrationClosesAt: "2026-11-10T00:00:00Z" } as any, false, now), null);
});

test("a session with rules needs the player's agreement", () => {
  const withRules = { ...base, rulesText: "Arrive 15 minutes early." };
  assert.equal(sessionHasPolicies(withRules as any), true);
  assert.match(joinBlockedReason(withRules as any, false, now) ?? "", /accept the session rules/);
  assert.equal(joinBlockedReason(withRules as any, true, now), null);
});

test("a finished session is archived for players: no join", () => {
  const over = { ...base, startAt: "2026-11-08T08:00:00Z", endAt: "2026-11-08T10:00:00Z" };
  assert.equal(sessionHasFinished(over, now), true);
  assert.equal(joinBlockedReason(over as any, true, now), "This session has finished.");
  // No end time: the start decides.
  assert.equal(sessionHasFinished({ startAt: "2026-11-08T08:00:00Z", endAt: null }, now), true);
  // Completed / archived are finished whatever the clock says; a live session running late is not.
  assert.equal(sessionHasFinished({ ...base, status: "archived" }, now), true);
  assert.equal(sessionHasFinished({ ...over, status: "live" }, now), false);
});
