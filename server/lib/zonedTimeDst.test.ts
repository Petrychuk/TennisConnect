// npx tsx server/lib/zonedTimeDst.test.ts
//
// zonedTimeToUtc on and around a daylight-saving change. Sydney/Melbourne/
// Hobart/Adelaide switch to summer time on the first Sunday of October
// (Sun 4 Oct 2026, 2:00am) and back on the first Sunday of April
// (Sun 5 Apr 2026, 3:00am). Brisbane, Perth and Darwin never change.

import assert from "node:assert/strict";
import { zonedTimeToUtc } from "./zonedTime";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.error(`  FAIL - ${name}`); console.error(err); }
}
const iso = (d: string, t: string, tz: string) => zonedTimeToUtc(d, t, tz).toISOString();

console.log("zonedTimeToUtc around daylight saving");

test("the evening BEFORE summer time starts is still +10 (this was returned as +11)", () => {
  assert.equal(iso("2026-10-03", "20:00", "Australia/Sydney"), "2026-10-03T10:00:00.000Z");
  assert.equal(iso("2026-10-03", "21:30", "Australia/Sydney"), "2026-10-03T11:30:00.000Z");
});

test("the morning after it starts is +11", () => {
  assert.equal(iso("2026-10-04", "09:00", "Australia/Sydney"), "2026-10-03T22:00:00.000Z");
  assert.equal(iso("2026-10-04", "21:30", "Australia/Sydney"), "2026-10-04T10:30:00.000Z");
});

test("the early hours of the change day, before 2am, are still +10", () => {
  assert.equal(iso("2026-10-04", "01:00", "Australia/Sydney"), "2026-10-03T15:00:00.000Z");
});

test("either side of the April change back to standard time", () => {
  // Sun 5 Apr 2026: summer time (+11) ends at 3:00am
  assert.equal(iso("2026-04-04", "20:00", "Australia/Sydney"), "2026-04-04T09:00:00.000Z"); // still +11
  assert.equal(iso("2026-04-05", "20:00", "Australia/Sydney"), "2026-04-05T10:00:00.000Z"); // now +10
});

test("ordinary days far from a change are unaffected (winter +10, summer +11)", () => {
  assert.equal(iso("2026-07-01", "21:30", "Australia/Sydney"), "2026-07-01T11:30:00.000Z");
  assert.equal(iso("2026-01-15", "21:30", "Australia/Sydney"), "2026-01-15T10:30:00.000Z");
});

test("Melbourne follows the same change; Brisbane and Perth never move", () => {
  assert.equal(iso("2026-10-03", "20:00", "Australia/Melbourne"), "2026-10-03T10:00:00.000Z");
  assert.equal(iso("2026-10-03", "20:00", "Australia/Brisbane"), "2026-10-03T10:00:00.000Z");
  assert.equal(iso("2026-10-04", "20:00", "Australia/Brisbane"), "2026-10-04T10:00:00.000Z");
  assert.equal(iso("2026-10-03", "20:00", "Australia/Perth"), "2026-10-03T12:00:00.000Z");
});

test("Adelaide (a half-hour zone: +9:30 / +10:30) is right on the eve too", () => {
  assert.equal(iso("2026-10-03", "20:00", "Australia/Adelaide"), "2026-10-03T10:30:00.000Z");
  assert.equal(iso("2026-10-04", "20:00", "Australia/Adelaide"), "2026-10-04T09:30:00.000Z");
});

test("every hour of the eve round-trips: reading the result back in the zone gives the same wall-clock time", () => {
  for (let h = 0; h < 24; h++) {
    const t = `${String(h).padStart(2, "0")}:00`;
    const back = new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .format(zonedTimeToUtc("2026-10-03", t, "Australia/Sydney"));
    assert.equal(back, t, `2026-10-03 ${t} did not round-trip (${back})`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
