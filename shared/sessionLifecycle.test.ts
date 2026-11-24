import test from "node:test";
import assert from "node:assert/strict";
import { isDueToGoLive, isPubliclyActive, isReadyToStart, registrationBlockReason, waitlistPromotionOpen } from "./sessionLifecycle";

const now = new Date("2026-11-10T08:00:00Z");
const h = (hours: number) => new Date(now.getTime() + hours * 3600_000).toISOString();
const published = { status: "published", startAt: h(24), registrationOpensAt: h(-48), registrationClosesAt: h(23) };

test("open registration before the start: listed and joinable", () => {
  assert.equal(isPubliclyActive(published, now), true);
  assert.equal(registrationBlockReason(published, "join", now), null);
  assert.equal(registrationBlockReason(published, "leave", now), null);
});

test("registration closes early: off the listings, read-only - but not completed and still the organiser's to run", () => {
  const closed = { ...published, registrationClosesAt: h(-1) };
  assert.equal(isPubliclyActive(closed, now), false);
  assert.equal(registrationBlockReason(closed, "join", now), "Registration is closed.");
  assert.equal(registrationBlockReason(closed, "leave", now), "Registration is closed.");
  assert.equal(closed.status, "published");
});

test("scheduled start reached: off the listings, 'started' for players, still Ready to Start for the organiser (delayed start)", () => {
  const started = { ...published, startAt: h(-0.5), registrationClosesAt: h(-0.5) };
  assert.equal(isPubliclyActive(started, now), false);
  assert.equal(registrationBlockReason(started, "join", now), "This session has already started.");
  assert.equal(isReadyToStart(started, now), true);
  // Hours later and never started: still the organiser's to start.
  assert.equal(isReadyToStart({ ...started, startAt: h(-5) }, now), true);
});

test("Ready to Start opens 2 hours before the start", () => {
  assert.equal(isReadyToStart({ ...published, startAt: h(3) }, now), false);
  assert.equal(isReadyToStart({ ...published, startAt: h(1.5) }, now), true);
  assert.equal(isReadyToStart({ ...published, status: "draft", startAt: h(1) }, now), false);
});

test("live (even past the scheduled end) and finished sessions: nothing to join or cancel", () => {
  assert.equal(registrationBlockReason({ ...published, status: "live" }, "leave", now), "This session has already started.");
  assert.equal(isPubliclyActive({ ...published, status: "live" }, now), false);
  assert.equal(isReadyToStart({ ...published, status: "live", startAt: h(-10) }, now), false);
  for (const status of ["completed", "archived"]) {
    assert.equal(registrationBlockReason({ ...published, status }, "join", now), "This session has finished.");
  }
});

test("not open yet: can't join, listed", () => {
  const soon = { ...published, registrationOpensAt: h(2) };
  assert.equal(isPubliclyActive(soon, now), true);
  assert.equal(registrationBlockReason(soon, "join", now), "Registration hasn't opened yet.");
});

// TC-213: a freed place is filled from the waiting list only before the
// registration cutoff - never once the session started, went live or closed.
test("waitlistPromotionOpen: same cutoff as a player's own cancel", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  const base = { status: "published", startAt: "2026-11-20T08:00:00Z", registrationOpensAt: null, registrationClosesAt: null };
  assert.equal(waitlistPromotionOpen(base, now), true);
  assert.equal(waitlistPromotionOpen({ ...base, registrationOpensAt: "2026-11-18T00:00:00Z" }, now), true, "not open yet still promotes (the waitlisted already joined)");
  assert.equal(waitlistPromotionOpen({ ...base, registrationClosesAt: "2026-11-14T00:00:00Z" }, now), false, "registration closed");
  assert.equal(waitlistPromotionOpen({ ...base, startAt: "2026-11-15T09:00:00Z" }, now), false, "start time passed");
  for (const status of ["live", "completed", "archived", "cancelled", "draft", "pending_review"]) {
    assert.equal(waitlistPromotionOpen({ ...base, status }, now), false, status);
  }
});

// TC-189 PO decision 10 Nov 2026: Live starts automatically at the scheduled start.
test("isDueToGoLive: exactly at the scheduled start, not a millisecond before", () => {
  const start = "2026-11-20T08:00:00Z";
  const s = { status: "published", startAt: start, type: "social" };
  assert.equal(isDueToGoLive(s, new Date("2026-11-20T07:59:59.999Z")), false);
  assert.equal(isDueToGoLive(s, new Date(start)), true);
  assert.equal(isDueToGoLive(s, new Date("2026-11-20T11:00:00Z")), true, "late: still due until it is started");
});

test("isDueToGoLive: an earlier registration deadline does not start Live", () => {
  const s = { status: "published", startAt: "2026-11-20T08:00:00Z", registrationClosesAt: "2026-11-19T08:00:00Z", type: "social" };
  const between = new Date("2026-11-19T20:00:00Z");
  assert.equal(registrationBlockReason(s, "join", between), "Registration is closed.");
  assert.equal(isDueToGoLive(s, between), false);
});

test("isDueToGoLive: only published sessions in formats that run in TC Live", () => {
  const now = new Date("2026-11-20T09:00:00Z");
  const base = { status: "published", startAt: "2026-11-20T08:00:00Z" };
  for (const type of ["social", "americano", "tournament", "custom", null]) {
    assert.equal(isDueToGoLive({ ...base, type }, now), true, String(type));
  }
  for (const type of ["coaching-clinic", "cardio-tennis", "junior-development"]) {
    assert.equal(isDueToGoLive({ ...base, type }, now), false, type);
  }
  for (const status of ["draft", "pending_review", "live", "completed", "archived", "cancelled"]) {
    assert.equal(isDueToGoLive({ ...base, status, type: "social" }, now), false, status);
  }
});

test("isDueToGoLive: an absolute instant - the same answer in every server time zone (incl. Sydney DST start)", () => {
  // 2026-10-04 02:00 Sydney is the DST jump (AEST -> AEDT). 09:00 AEDT = 22:00Z the day before.
  const s = { status: "published", startAt: "2026-10-04T09:00:00+11:00", type: "social" };
  assert.equal(isDueToGoLive(s, new Date("2026-10-03T21:59:59Z")), false);
  assert.equal(isDueToGoLive(s, new Date("2026-10-03T22:00:00Z")), true);
});
