// npx tsx server/services/discoveryFreshness.test.ts

import assert from "node:assert/strict";
import {
  isSameSourceEvent,
  diffTrackedFields,
  summariseChanges,
  decideOnSeenAgain,
  decideOnMissing,
  decideOnSourceUnavailable,
  isPlayVisible,
  titleKey,
} from "./discoveryFreshness";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  }
}

console.log("discoveryFreshness.ts");

// --- same-event matching (why a re-run doesn't create duplicates) ---

test("the same title on the same date is the same event, regardless of case/punctuation", () => {
  assert.equal(
    isSameSourceEvent({ title: "Saturday Social Tennis", startDate: "2026-10-10" }, { title: "saturday  social tennis!", startDate: "2026-10-10" }),
    true
  );
});

test("the same title on a different date is a different event", () => {
  assert.equal(
    isSameSourceEvent({ title: "Sunday Round Robin", startDate: "2026-10-11" }, { title: "Sunday Round Robin", startDate: "2026-10-18" }),
    false
  );
});

test("two recurring listings match on title + weekday, with no fixed date", () => {
  assert.equal(
    isSameSourceEvent({ title: "Thursday Social", recurrenceDayOfWeek: "THURSDAY" }, { title: "Thursday Social", recurrenceDayOfWeek: "THURSDAY" }),
    true
  );
});

test("the same title but a different weekday is not the same recurring session", () => {
  assert.equal(
    isSameSourceEvent({ title: "Social Tennis", recurrenceDayOfWeek: "THURSDAY" }, { title: "Social Tennis", recurrenceDayOfWeek: "SUNDAY" }),
    false
  );
});

test("a dated event and a recurring one with the same title are NOT merged", () => {
  assert.equal(
    isSameSourceEvent({ title: "Social Tennis", startDate: "2026-10-10" }, { title: "Social Tennis", recurrenceDayOfWeek: "THURSDAY" }),
    false
  );
});

test("titleKey ignores case, punctuation and repeated spaces", () => {
  assert.equal(titleKey("  Sunday   ROUND-robin! "), "sunday round robin");
});

// --- change detection ---

test("identical tracked fields produce no changes, even when one side has null and the other an empty string", () => {
  assert.deepEqual(diffTrackedFields({ price: 15, startTime: "19:00", venueName: null }, { price: 15, startTime: "19:00", venueName: "" }), []);
});

test("a changed price and start time are both reported", () => {
  const changes = diffTrackedFields({ price: 15, startTime: "19:00" }, { price: 20, startTime: "18:30" });
  assert.deepEqual(changes.map((c) => c.field).sort(), ["price", "startTime"]);
  assert.equal(summariseChanges(changes), "startTime: 19:00 -> 18:30; price: 15 -> 20");
});

test("cosmetic fields outside the tracked list never register as a change", () => {
  assert.deepEqual(diffTrackedFields({ price: 15 }, { price: 15, description: "new wording" } as any), []);
});

// --- seen again ---

test("an approved event whose source changed goes back to PENDING as CHANGED, with the diff recorded, so it leaves Play until re-approved", () => {
  const d = decideOnSeenAgain({
    reviewStatus: "APPROVED",
    discoveryStatus: "ACTIVE",
    changes: [{ field: "price", from: "15", to: "20" }],
    cancelled: false,
  });
  assert.equal(d.applyFields, true);
  assert.equal(d.reviewStatus, "PENDING");
  assert.equal(d.discoveryStatus, "CHANGED");
  assert.equal(d.changeSummary, "price: 15 -> 20");
  assert.equal(d.outcome, "updated");
  assert.equal(isPlayVisible(d.reviewStatus!, d.discoveryStatus!), false);
});

test("a pending event whose source changed is simply kept current - nobody has approved the old values", () => {
  const d = decideOnSeenAgain({
    reviewStatus: "PENDING", discoveryStatus: "ACTIVE",
    changes: [{ field: "startTime", from: "19:00", to: "18:30" }], cancelled: false,
  });
  assert.equal(d.applyFields, true);
  assert.equal(d.reviewStatus, undefined);
  assert.equal(d.outcome, "updated");
});

test("an unchanged approved event stays approved and just gets its lastCheckedAt refreshed", () => {
  const d = decideOnSeenAgain({ reviewStatus: "APPROVED", discoveryStatus: "ACTIVE", changes: [], cancelled: false });
  assert.equal(d.applyFields, false);
  assert.equal(d.reviewStatus, undefined);
  assert.equal(d.outcome, "touched");
});

test("an approved event that looked unreachable or missing recovers to ACTIVE when seen unchanged", () => {
  assert.equal(decideOnSeenAgain({ reviewStatus: "APPROVED", discoveryStatus: "SOURCE_UNAVAILABLE", changes: [], cancelled: false }).discoveryStatus, "ACTIVE");
  assert.equal(decideOnSeenAgain({ reviewStatus: "APPROVED", discoveryStatus: "NEEDS_REVIEW", changes: [], cancelled: false }).discoveryStatus, "ACTIVE");
});

test("a CHANGED event awaiting re-approval is NOT cleared just because it was seen unchanged again", () => {
  const d = decideOnSeenAgain({ reviewStatus: "PENDING", discoveryStatus: "CHANGED", changes: [], cancelled: false });
  assert.equal(d.discoveryStatus, undefined);
});

test("a source that says the event is cancelled marks it CANCELLED", () => {
  const d = decideOnSeenAgain({ reviewStatus: "APPROVED", discoveryStatus: "ACTIVE", changes: [], cancelled: true });
  assert.equal(d.discoveryStatus, "CANCELLED");
  assert.equal(isPlayVisible("APPROVED", "CANCELLED"), false);
});

test("a re-scan never overturns an admin's Reject or Duplicate decision", () => {
  for (const reviewStatus of ["REJECTED", "DUPLICATE"] as const) {
    const d = decideOnSeenAgain({ reviewStatus, discoveryStatus: "ACTIVE", changes: [{ field: "price", from: "1", to: "2" }], cancelled: false });
    assert.equal(d.applyFields, false);
    assert.equal(d.reviewStatus, undefined);
    assert.equal(d.discoveryStatus, undefined);
  }
});

test("EXPIRED and CANCELLED are terminal - a later sighting doesn't revive them", () => {
  for (const discoveryStatus of ["EXPIRED", "CANCELLED"] as const) {
    const d = decideOnSeenAgain({ reviewStatus: "APPROVED", discoveryStatus, changes: [], cancelled: false });
    assert.equal(d.discoveryStatus, undefined);
  }
});

// --- disappeared / unreachable ---

test("an event missing from a page we did read goes to NEEDS_REVIEW - and an approved one is NOT hidden from Play (not assumed cancelled)", () => {
  const d = decideOnMissing({ reviewStatus: "APPROVED", discoveryStatus: "ACTIVE" });
  assert.equal(d?.discoveryStatus, "NEEDS_REVIEW");
  assert.equal(isPlayVisible("APPROVED", "NEEDS_REVIEW"), true);
});

test("missing-event handling ignores rejected, terminal, and already-flagged items", () => {
  assert.equal(decideOnMissing({ reviewStatus: "REJECTED", discoveryStatus: "ACTIVE" }), null);
  assert.equal(decideOnMissing({ reviewStatus: "APPROVED", discoveryStatus: "EXPIRED" }), null);
  assert.equal(decideOnMissing({ reviewStatus: "PENDING", discoveryStatus: "NEEDS_REVIEW" }), null);
  assert.equal(decideOnMissing({ reviewStatus: "PENDING", discoveryStatus: "CHANGED" }), null);
});

test("an unreachable source flags healthy events SOURCE_UNAVAILABLE but keeps them in Play (may be a transient outage)", () => {
  const d = decideOnSourceUnavailable({ reviewStatus: "APPROVED", discoveryStatus: "ACTIVE" });
  assert.equal(d?.discoveryStatus, "SOURCE_UNAVAILABLE");
  assert.equal(isPlayVisible("APPROVED", "SOURCE_UNAVAILABLE"), true);
});

test("an unreachable source doesn't overwrite a more specific state or a human decision", () => {
  assert.equal(decideOnSourceUnavailable({ reviewStatus: "APPROVED", discoveryStatus: "CHANGED" }), null);
  assert.equal(decideOnSourceUnavailable({ reviewStatus: "REJECTED", discoveryStatus: "ACTIVE" }), null);
});

// --- Play visibility ---

test("only approved, non-expired, non-cancelled events are visible in Play", () => {
  assert.equal(isPlayVisible("APPROVED", "ACTIVE"), true);
  assert.equal(isPlayVisible("PENDING", "ACTIVE"), false);
  assert.equal(isPlayVisible("REJECTED", "ACTIVE"), false);
  assert.equal(isPlayVisible("APPROVED", "EXPIRED"), false);
  assert.equal(isPlayVisible("APPROVED", "CANCELLED"), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
