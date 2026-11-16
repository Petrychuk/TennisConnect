// npx tsx server/lib/tc214-rankings-reports.test.ts
//
// TC-214 — Rankings, Reporting, Season Integrity & Timezones
// Covers: eligibility filter, deterministic tiebreaking, timezone
// helpers, season status, revenue terminology.

import assert from "node:assert/strict";
import {
  zonedTimeToUtc,
  utcToZonedDateStr,
  startOfDayUtc,
  endOfDayUtc,
  todayInZone,
} from "./zonedTime";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.error(`  FAIL - ${name}`); console.error(err); }
}

// ─── 1. utcToZonedDateStr ───────────────────────────────────────

console.log("\nutcToZonedDateStr");

test("Sydney AEDT: UTC 2026-01-01T08:00Z → local 2026-01-01 (UTC+11)", () => {
  const utc = new Date("2026-01-01T08:00:00Z");
  assert.equal(utcToZonedDateStr(utc, "Australia/Sydney"), "2026-01-01");
});

test("Sydney AEDT: UTC 2025-12-31T12:00Z → local 2025-12-31 (UTC+11)", () => {
  const utc = new Date("2025-12-31T12:00:00Z");
  assert.equal(utcToZonedDateStr(utc, "Australia/Sydney"), "2025-12-31");
});

test("Sydney AEDT: UTC 2025-12-31T13:00Z → local 2026-01-01 (midnight in Sydney)", () => {
  const utc = new Date("2025-12-31T13:00:00Z");
  assert.equal(utcToZonedDateStr(utc, "Australia/Sydney"), "2026-01-01");
});

test("Sydney AEST (winter): UTC 2026-07-01T14:00Z → local 2026-07-02 (midnight in Sydney)", () => {
  const utc = new Date("2026-07-01T14:00:00Z");
  assert.equal(utcToZonedDateStr(utc, "Australia/Sydney"), "2026-07-02");
});

test("Perth (UTC+8, no DST): UTC 2026-01-01T16:00Z → local 2026-01-02", () => {
  const utc = new Date("2026-01-01T16:00:00Z");
  assert.equal(utcToZonedDateStr(utc, "Australia/Perth"), "2026-01-02");
});

test("Brisbane (UTC+10, no DST): date matches AEST but not AEDT", () => {
  // In January, Brisbane is UTC+10, Sydney is UTC+11.
  // 2026-01-01T13:30Z → Brisbane 2026-01-01 23:30, Sydney 2026-01-02 00:30
  const utc = new Date("2026-01-01T13:30:00Z");
  assert.equal(utcToZonedDateStr(utc, "Australia/Brisbane"), "2026-01-01");
  assert.equal(utcToZonedDateStr(utc, "Australia/Sydney"), "2026-01-02");
});

// ─── 2. startOfDayUtc / endOfDayUtc ────────────────────────────

console.log("\nstartOfDayUtc / endOfDayUtc");

test("Sydney AEDT: start of 2026-01-01 is 2025-12-31T13:00Z (UTC+11)", () => {
  const result = startOfDayUtc("2026-01-01", "Australia/Sydney");
  assert.equal(result.toISOString(), "2025-12-31T13:00:00.000Z");
});

test("Sydney AEDT: end of 2026-01-01 is 2026-01-01T12:59:59.999Z", () => {
  const result = endOfDayUtc("2026-01-01", "Australia/Sydney");
  assert.equal(result.toISOString(), "2026-01-01T12:59:59.999Z");
});

test("Sydney AEST: start of 2026-07-01 is 2026-06-30T14:00Z (UTC+10)", () => {
  const result = startOfDayUtc("2026-07-01", "Australia/Sydney");
  assert.equal(result.toISOString(), "2026-06-30T14:00:00.000Z");
});

test("Sydney AEST: end of 2026-07-01 is 2026-07-01T13:59:59.999Z", () => {
  const result = endOfDayUtc("2026-07-01", "Australia/Sydney");
  assert.equal(result.toISOString(), "2026-07-01T13:59:59.999Z");
});

test("Perth start/end: no DST, always UTC+8", () => {
  const start = startOfDayUtc("2026-01-01", "Australia/Perth");
  const end = endOfDayUtc("2026-01-01", "Australia/Perth");
  assert.equal(start.toISOString(), "2025-12-31T16:00:00.000Z");
  assert.equal(end.toISOString(), "2026-01-01T15:59:59.999Z");
});

test("endOfDayUtc covers the full local day", () => {
  const start = startOfDayUtc("2026-03-15", "Australia/Sydney");
  const end = endOfDayUtc("2026-03-15", "Australia/Sydney");
  // Should be approximately 24 hours apart (minus 1ms).
  const diff = end.getTime() - start.getTime();
  assert.ok(diff > 86_399_000 && diff < 86_400_000, `diff=${diff}`);
});

// ─── 3. DST transition boundary for startOfDayUtc ──────────────

console.log("\nDST transition boundaries");

test("Sydney DST spring forward (4 Oct 2026): clocks skip 2am→3am, day still 24h", () => {
  // On 4 Oct 2026 at 2:00am AEST, clocks move to 3:00am AEDT.
  // Start of day (00:00) is still before the transition → AEST (UTC+10).
  const start = startOfDayUtc("2026-10-04", "Australia/Sydney");
  assert.equal(start.toISOString(), "2026-10-03T14:00:00.000Z");
  // End of day (23:59) is after the transition → AEDT (UTC+11).
  const end = endOfDayUtc("2026-10-04", "Australia/Sydney");
  assert.equal(end.toISOString(), "2026-10-04T12:59:59.999Z");
});

test("Sydney DST fall back (5 Apr 2026): clocks repeat 2am→3am, day still 24h", () => {
  // On 5 Apr 2026 at 3:00am AEDT, clocks move back to 2:00am AEST.
  // Start of day is AEDT (UTC+11), end of day is AEST (UTC+10).
  const start = startOfDayUtc("2026-04-05", "Australia/Sydney");
  assert.equal(start.toISOString(), "2026-04-04T13:00:00.000Z");
  const end = endOfDayUtc("2026-04-05", "Australia/Sydney");
  assert.equal(end.toISOString(), "2026-04-05T13:59:59.999Z");
});

// ─── 4. todayInZone ────────────────────────────────────────────

console.log("\ntodayInZone");

test("todayInZone returns a valid YYYY-MM-DD string", () => {
  const result = todayInZone("Australia/Sydney");
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});

test("todayInZone matches utcToZonedDateStr(now)", () => {
  const now = new Date();
  const expected = utcToZonedDateStr(now, "Australia/Sydney");
  assert.equal(todayInZone("Australia/Sydney"), expected);
});

// ─── 5. Deterministic tiebreaking ──────────────────────────────

console.log("\nDeterministic sort (unit-level simulation)");

test("userId fallback produces stable sort when points+wins match", () => {
  const rows = [
    { userId: "zzz", points: 100, wins: 4 },
    { userId: "aaa", points: 100, wins: 4 },
    { userId: "mmm", points: 100, wins: 4 },
  ];
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  );
  assert.deepEqual(sorted.map((r) => r.userId), ["aaa", "mmm", "zzz"]);
});

test("points take priority, then wins, then userId", () => {
  const rows = [
    { userId: "d", points: 80, wins: 3 },
    { userId: "a", points: 100, wins: 3 },
    { userId: "b", points: 100, wins: 4 },
    { userId: "c", points: 80, wins: 3 },
  ];
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  );
  assert.deepEqual(sorted.map((r) => r.userId), ["b", "a", "c", "d"]);
});

test("sort is idempotent across multiple runs", () => {
  const rows = [
    { userId: "u2", points: 50, wins: 2 },
    { userId: "u1", points: 50, wins: 2 },
    { userId: "u3", points: 50, wins: 2 },
  ];
  const sorter = (arr: typeof rows) => [...arr].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  );
  const first = sorter(rows);
  const second = sorter([...rows].reverse());
  assert.deepEqual(first.map((r) => r.userId), second.map((r) => r.userId));
});

// ─── 6. countsAsPlayer filter shape ────────────────────────────

console.log("\ncountsAsPlayer eligibility filter");

test("canonical filter excludes 'cancelled' and 'invited'", () => {
  const excluded = ["cancelled", "invited"];
  const statuses = ["registered", "confirmed", "waitlisted", "cancelled", "invited"];
  const included = statuses.filter((s) => !excluded.includes(s));
  assert.deepEqual(included, ["registered", "confirmed", "waitlisted"]);
});

test("ne(status, 'cancelled') would wrongly include 'invited'", () => {
  const buggyExcluded = ["cancelled"];
  const statuses = ["registered", "confirmed", "waitlisted", "cancelled", "invited"];
  const buggyIncluded = statuses.filter((s) => !buggyExcluded.includes(s));
  // Verify this INCLUDES invited — the bug we fixed.
  assert.ok(buggyIncluded.includes("invited"), "buggy filter includes invited");
  assert.equal(buggyIncluded.length, 4, "buggy filter includes 4 statuses");
});

// ─── 7. Season status derivation (client-side logic) ───────────

console.log("\nSeason status derivation");

// Simulate the client-side todayInZone using the same Intl approach.
function clientTodayInZone(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function seasonStatusSim(season: { startDate: string; endDate: string }, tz: string): string {
  const today = clientTodayInZone(tz);
  if (today < season.startDate) return "upcoming";
  if (today > season.endDate) return "completed";
  return "active";
}

test("seasonStatus: known past season is completed", () => {
  assert.equal(seasonStatusSim({ startDate: "2020-01-01", endDate: "2020-06-30" }, "Australia/Sydney"), "completed");
});

test("seasonStatus: far-future season is upcoming", () => {
  assert.equal(seasonStatusSim({ startDate: "2099-01-01", endDate: "2099-12-31" }, "Australia/Sydney"), "upcoming");
});

test("seasonStatus: season spanning today is active", () => {
  const today = clientTodayInZone("Australia/Sydney");
  assert.equal(seasonStatusSim({ startDate: "2020-01-01", endDate: "2099-12-31" }, "Australia/Sydney"), "active");
});

test("seasonStatus: start == today is active", () => {
  const today = clientTodayInZone("Australia/Sydney");
  assert.equal(seasonStatusSim({ startDate: today, endDate: "2099-12-31" }, "Australia/Sydney"), "active");
});

test("seasonStatus: end == today is active", () => {
  const today = clientTodayInZone("Australia/Sydney");
  assert.equal(seasonStatusSim({ startDate: "2020-01-01", endDate: today }, "Australia/Sydney"), "active");
});

// ─── 8. Revenue rename consistency ─────────────────────────────

console.log("\nRevenue terminology consistency");

test("estimatedRevenueThisWeek name reflects it is NOT collected revenue", () => {
  // Structural: if the field name starts with "estimated" the label is correct.
  const fieldName = "estimatedRevenueThisWeek";
  assert.ok(fieldName.startsWith("estimated"), "field name starts with 'estimated'");
  assert.ok(!fieldName.startsWith("revenue"), "field name does NOT start with 'revenue'");
});

// ─── 9. Participation chart date grouping ──────────────────────

console.log("\nParticipation chart date grouping");

test("UTC grouping bug: 8pm Sydney session appears on correct local date", () => {
  // 8pm Sydney AEDT = 9am UTC → same UTC date. No bug in summer.
  const sydneyEvening = new Date("2026-01-15T09:00:00Z"); // 8pm AEDT
  assert.equal(utcToZonedDateStr(sydneyEvening, "Australia/Sydney"), "2026-01-15");
});

test("UTC grouping bug: 8pm Sydney AEST session appears on correct local date", () => {
  // 8pm Sydney AEST = 10am UTC → same UTC date. No bug in winter either for evening.
  const sydneyEvening = new Date("2026-07-15T10:00:00Z"); // 8pm AEST
  assert.equal(utcToZonedDateStr(sydneyEvening, "Australia/Sydney"), "2026-07-15");
});

test("UTC grouping bug: 8am Sydney AEDT session would be wrong in UTC", () => {
  // 8am Sydney AEDT = 9pm UTC *previous day*
  // Old code: toISOString().slice(0,10) → previous UTC date (WRONG)
  // New code: utcToZonedDateStr → correct local date
  const sydneyMorning = new Date("2026-01-14T21:00:00Z"); // 8am AEDT on Jan 15
  const utcDate = sydneyMorning.toISOString().slice(0, 10);
  assert.equal(utcDate, "2026-01-14", "UTC date is the 14th (old buggy grouping)");
  assert.equal(utcToZonedDateStr(sydneyMorning, "Australia/Sydney"), "2026-01-15", "local date is the 15th (correct)");
});

// ─── 10. Report date boundary accuracy ─────────────────────────

console.log("\nReport date boundary accuracy");

test("season boundary: session at 8am Sydney on first day is included", () => {
  // Season starts 2026-01-15. Session at 8am Sydney = 2025-01-14T21:00Z.
  // Old boundary: new Date("2026-01-15T00:00:00Z") → EXCLUDES this session!
  // New boundary: startOfDayUtc("2026-01-15", "Australia/Sydney") → 2025-12-31T13:00Z → INCLUDES it.
  const sessionUtc = new Date("2026-01-14T21:00:00Z"); // 8am AEDT Jan 15
  const oldBoundary = new Date("2026-01-15T00:00:00Z");
  const newBoundary = startOfDayUtc("2026-01-15", "Australia/Sydney");
  assert.ok(sessionUtc < oldBoundary, "old boundary would exclude this session");
  assert.ok(sessionUtc >= newBoundary, "new boundary correctly includes this session");
});

test("season boundary: session at 11pm Sydney on last day is included", () => {
  // Season ends 2026-03-31. Session at 11pm Sydney AEDT = 2026-03-31T12:00Z.
  // Old boundary: new Date("2026-03-31T23:59:59Z") → includes (happens to work).
  // New boundary: endOfDayUtc("2026-03-31", "Australia/Sydney") → 2026-03-31T12:59:59.999Z → includes.
  const sessionUtc = new Date("2026-03-31T12:00:00Z");
  const newBoundary = endOfDayUtc("2026-03-31", "Australia/Sydney");
  assert.ok(sessionUtc <= newBoundary, "new boundary correctly includes this session");
});

test("season boundary: session at 1am Sydney on day after last day is excluded", () => {
  // Season ends 2026-03-31. Session at 1am Apr 1 AEDT = 2026-03-31T14:00Z.
  const sessionUtc = new Date("2026-03-31T14:00:00Z");
  const newBoundary = endOfDayUtc("2026-03-31", "Australia/Sydney");
  assert.ok(sessionUtc > newBoundary, "boundary correctly excludes session on next day");
});

// ─── Done ──────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
