// Standalone unit tests for smartSearchEngine.ts - same
// dependency-free convention as recommendationEngine.test.ts:
//
//   npx tsx server/services/smartSearchEngine.test.ts
//
// These cover the deterministic parts only (parsing, validation,
// prompt construction, fallback) - there is no live LLM call in this
// sandbox to test against, so the actual model behaviour for the
// mock/test scenarios in spec section 18 needs to be verified against
// a real API call separately, not here.

import assert from "node:assert/strict";
import {
  parseSmartSearchResponse,
  fallbackIntent,
  buildSmartSearchPrompt,
  playSearchIntentSchema,
  matchesTimeOfDay,
} from "./smartSearchEngine";

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

console.log("smartSearchEngine.ts");

test("parses a valid, well-formed JSON response", () => {
  const raw = JSON.stringify({
    intent: "FIND_ACTIVITY",
    gameFormat: ["doubles"],
    timeOfDay: "morning",
    levelMode: "PLAYER_LEVEL",
    maxDistanceKm: 10,
  });
  const result = parseSmartSearchResponse(raw);
  assert.ok(result);
  assert.equal(result?.intent, "FIND_ACTIVITY");
  assert.deepEqual(result?.gameFormat, ["doubles"]);
});

test("strips a markdown code fence the model wasn't supposed to add", () => {
  const raw = "```json\n" + JSON.stringify({ intent: "TEXT_SEARCH", query: "Wolli Creek" }) + "\n```";
  const result = parseSmartSearchResponse(raw);
  assert.ok(result);
  assert.equal(result?.intent, "TEXT_SEARCH");
  assert.equal(result?.query, "Wolli Creek");
});

test("invalid JSON returns null, never throws", () => {
  assert.equal(parseSmartSearchResponse("not json at all"), null);
  assert.equal(parseSmartSearchResponse("{ intent: FIND_ACTIVITY"), null);
});

test("valid JSON but wrong shape (fails schema validation) returns null", () => {
  const raw = JSON.stringify({ intent: "MAKE_COFFEE", query: "anything" });
  assert.equal(parseSmartSearchResponse(raw), null);
});

test("level is a free string field - schema validates shape, not truthfulness (documents a known limit, not a bug)", () => {
  const raw = JSON.stringify({ intent: "FIND_ACTIVITY", levelMode: "EXPLICIT", level: "UTR 5.2 exactly" });
  const result = parseSmartSearchResponse(raw);
  assert.ok(result);
});

test("extra/unexpected fields the model might add are stripped by the schema", () => {
  const raw = JSON.stringify({ intent: "TEXT_SEARCH", query: "test", somethingUnexpected: "value" });
  const result = parseSmartSearchResponse(raw);
  assert.ok(result);
  assert.equal((result as any).somethingUnexpected, undefined);
});

test("array fields over the max length fail validation (return null) rather than silently truncating", () => {
  const raw = JSON.stringify({ intent: "FIND_ACTIVITY", activityType: ["a", "b", "c", "d", "e", "f"] });
  assert.equal(parseSmartSearchResponse(raw), null);
});

test("fallbackIntent always returns a valid TEXT_SEARCH intent for any input string", () => {
  const result = fallbackIntent("anything the player typed, even garbled input !! @@");
  const validated = playSearchIntentSchema.safeParse(result);
  assert.ok(validated.success);
  assert.equal(result.intent, "TEXT_SEARCH");
});

test("prompt includes the player's context lines only when provided", () => {
  const { user: withContext } = buildSmartSearchPrompt("anything for me this weekend", {
    skillLevel: "Intermediate",
    preferredArea: "Wolli Creek",
    playRadiusKm: 15,
  });
  assert.ok(withContext.includes("Intermediate"));
  assert.ok(withContext.includes("Wolli Creek"));
  assert.ok(withContext.includes("15 km"));

  const { user: withoutContext } = buildSmartSearchPrompt("Wolli Creek Tennis");
  assert.ok(!withoutContext.includes("Player context"));
});

test("prompt explicitly instructs that an explicit query requirement overrides profile preference", () => {
  const { system } = buildSmartSearchPrompt("Singles Saturday");
  assert.ok(system.toLowerCase().includes("overrides"));
});

test("prompt explicitly forbids inventing a numeric level", () => {
  const { system } = buildSmartSearchPrompt("competition around my level");
  assert.ok(system.toLowerCase().includes("never invent a specific utr"));
});

// --- [BUG][PLAY][AI] regression: the model must never guess "today" ---

test("prompt states the exact date and weekday it was given, so the model isn't left to guess 'today'", () => {
  const fixedNow = new Date("2026-09-30T02:00:00Z"); // a Wednesday
  const { system } = buildSmartSearchPrompt("anything this weekend", undefined, fixedNow);
  assert.ok(system.includes("2026-09-30"), "the real date must be stated verbatim");
  assert.ok(system.includes("Wednesday"), "the real weekday must be stated, not left implicit");
});

test("a different given date produces a different stated date - it's not a hardcoded string", () => {
  const { system: forJan } = buildSmartSearchPrompt("tonight", undefined, new Date("2027-01-15T00:00:00Z"));
  assert.ok(forJan.includes("2027-01-15"));
  assert.ok(forJan.includes("Friday"));
});

test("with no date given, the prompt uses the REAL current date, not a fixed/fallback one", () => {
  const before = new Date();
  const { system } = buildSmartSearchPrompt("doubles this weekend");
  const after = new Date();
  // The stated date must fall within [before, after] - proving it's read
  // from a real clock at call time, not a stale or hardcoded value.
  const stated = /Today's date is (\d{4}-\d{2}-\d{2})/.exec(system)?.[1];
  assert.ok(stated, "the prompt must state a date in YYYY-MM-DD form");
  const statedMs = new Date(`${stated}T00:00:00Z`).getTime();
  const beforeDay = new Date(before.toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  const afterDay = new Date(after.toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  assert.ok(statedMs >= beforeDay - 86_400_000 && statedMs <= afterDay + 86_400_000, `stated date ${stated} is not near the real current date`);
});

test("the instruction to resolve relative terms against the stated date is explicit, not just the date sitting there unexplained", () => {
  const { system } = buildSmartSearchPrompt("tonight", undefined, new Date("2026-09-30T00:00:00Z"));
  const lower = system.toLowerCase();
  assert.ok(lower.includes("resolve every relative date term"));
  assert.ok(lower.includes("tonight") && lower.includes("this weekend"));
});

test("matchesTimeOfDay correctly buckets morning/afternoon/evening in a given time zone, not the server's own", () => {
  // 8am Sydney time on a date where the server (likely UTC) would see
  // a completely different hour if it used its own local time instead
  // of resolving the zone.
  const morningSydney = "2026-10-01T22:00:00.000Z"; // 8am next day in Sydney (UTC+10/11)
  assert.equal(matchesTimeOfDay(morningSydney, "Australia/Sydney", "morning"), true);
  assert.equal(matchesTimeOfDay(morningSydney, "Australia/Sydney", "evening"), false);
});

test("matchesTimeOfDay evening wraps past midnight correctly", () => {
  const lateNight = "2026-10-01T14:30:00.000Z"; // 12:30am next day in Sydney
  assert.equal(matchesTimeOfDay(lateNight, "Australia/Sydney", "evening"), true);
  assert.equal(matchesTimeOfDay(lateNight, "Australia/Sydney", "morning"), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
