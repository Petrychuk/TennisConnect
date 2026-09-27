// npx tsx server/lib/zonedTime.test.ts

import assert from "node:assert/strict";
import { zonedTimeToUtc } from "./zonedTime";

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

console.log("zonedTime.ts");

test("Sydney in July (AEST, UTC+10, no daylight saving)", () => {
  assert.equal(zonedTimeToUtc("2026-07-01", "19:00", "Australia/Sydney").toISOString(), "2026-07-01T09:00:00.000Z");
});

test("Sydney in January (AEDT, UTC+11, daylight saving active) - the offset changes correctly by season", () => {
  assert.equal(zonedTimeToUtc("2026-01-01", "19:00", "Australia/Sydney").toISOString(), "2026-01-01T08:00:00.000Z");
});

test("Perth (AWST, UTC+8, no daylight saving ever)", () => {
  assert.equal(zonedTimeToUtc("2026-07-01", "19:00", "Australia/Perth").toISOString(), "2026-07-01T11:00:00.000Z");
});

test("midnight wraps to the correct UTC date, not just time", () => {
  const result = zonedTimeToUtc("2026-07-01", "00:30", "Australia/Sydney");
  assert.equal(result.toISOString(), "2026-06-30T14:30:00.000Z");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
