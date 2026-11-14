import test from "node:test";
import assert from "node:assert/strict";
import { isPubliclyActive, isReadyToStart, registrationBlockReason } from "./sessionLifecycle";

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
