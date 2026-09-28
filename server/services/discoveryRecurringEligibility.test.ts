// npx tsx server/services/discoveryRecurringEligibility.test.ts
//
// Regression for: "Approved recurring external event is excluded from Play
// by its original startDate". The Strathfield page is dated 1 Aug 2026 but
// says "every Saturday"; today is late September. A recurring activity's
// startDate is when the season BEGAN - it must never decide whether the
// activity is still on. Two places could get that wrong, and both are
// pinned here: what Play shows (expandOccurrences) and what the expiry
// sweep retires (isActivityFinished).

import assert from "node:assert/strict";
import { expandOccurrences, isActivityFinished, todayInZone } from "./discoveryOccurrences";

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

console.log("recurring external activity vs. its original startDate");

// The two Strathfield rows, as the Agent stores them.
const competitive = {
  recurrenceFrequency: "WEEKLY", recurrenceDayOfWeek: "SATURDAY",
  startDate: "2026-08-01", endDate: null, startTime: "20:00", endTime: "21:30", timeZone: "Australia/Sydney",
};
const beginners = { ...competitive, startTime: "18:30", endTime: "20:00" };

const MON_28_SEP = new Date("2026-09-28T02:00:00Z"); // 12:00 Sydney

test("the naive rule the bug report suspects WOULD hide it: startDate is before today", () => {
  const today = todayInZone(MON_28_SEP, "Australia/Sydney");
  assert.equal(competitive.startDate >= today, false); // 2026-08-01 < 2026-09-28
});

test("but Play still gets the next Saturday, and the following ones, for BOTH sessions", () => {
  for (const row of [competitive, beginners]) {
    const dates = expandOccurrences(row, MON_28_SEP);
    assert.equal(dates[0], "2026-10-03");
    assert.ok(dates.length >= 4, `expected several upcoming Saturdays, got ${dates.length}`);
    for (const d of dates) assert.equal(new Date(`${d}T00:00:00Z`).getUTCDay(), 6, `${d} is not a Saturday`);
  }
});

test("dates already in the past are not generated (nothing between 1 Aug and now)", () => {
  const dates = expandOccurrences(competitive, MON_28_SEP);
  assert.ok(dates.every((d) => d >= "2026-09-28"));
});

test("on the evening itself, a session that hasn't finished is still listed", () => {
  // Sat 3 Oct 2026, 21:00 Sydney (AEST, +10) = 11:00Z; the session ends 21:30.
  const dates = expandOccurrences(competitive, new Date("2026-10-03T11:00:00Z"));
  assert.equal(dates[0], "2026-10-03");
});

test("...and once it has finished, the next one is next Saturday", () => {
  // 21:45 Sydney = 11:45Z
  const dates = expandOccurrences(competitive, new Date("2026-10-03T11:45:00Z"));
  assert.equal(dates[0], "2026-10-10");
});

test("the expiry sweep does NOT retire an open-ended recurring session just because its startDate is old", () => {
  assert.equal(isActivityFinished(competitive, MON_28_SEP), false);
  assert.equal(isActivityFinished(beginners, MON_28_SEP), false);
});

test("a recurring session is only retired when its series END date passes", () => {
  assert.equal(isActivityFinished({ ...competitive, endDate: "2026-09-01" }, MON_28_SEP), true);
  assert.deepEqual(expandOccurrences({ ...competitive, endDate: "2026-09-01" }, MON_28_SEP), []);
  assert.equal(isActivityFinished({ ...competitive, endDate: "2026-12-31" }, MON_28_SEP), false);
});

test("the same holds well into the future (the startDate never 'catches up' and expires it)", () => {
  const later = new Date("2027-03-10T02:00:00Z");
  assert.equal(isActivityFinished(competitive, later), false);
  assert.ok(expandOccurrences(competitive, later).length >= 4);
});

test("a ONE-OFF with the same old date IS finished - the distinction is recurrence, not the date", () => {
  const oneOff = { ...competitive, recurrenceFrequency: null, recurrenceDayOfWeek: null };
  assert.equal(isActivityFinished(oneOff, MON_28_SEP), true);
  assert.deepEqual(expandOccurrences(oneOff, MON_28_SEP), []);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
