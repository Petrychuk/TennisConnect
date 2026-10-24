// npx tsx server/services/playFilters.test.ts
import assert from "node:assert/strict";
import { locationTerms, softLevelValues, matchesLevel } from "./playFilters";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.error(`  FAIL - ${name}`); console.error(err); }
}

test("profile location 'Sydney, NSW' -> two terms", () => {
  assert.deepEqual(locationTerms("Sydney, NSW"), ["Sydney", "NSW"]);
});
test("single word stays one term (typed filters behave as before)", () => {
  assert.deepEqual(locationTerms("Strathfield"), ["Strathfield"]);
  assert.deepEqual(locationTerms("  Moore Park "), ["Moore Park"]);
});
test("drops empties, duplicates and the country", () => {
  assert.deepEqual(locationTerms("Sydney, , sydney, Australia"), ["Sydney"]);
});
test("empty / null -> no terms", () => {
  assert.deepEqual(locationTerms(""), []);
  assert.deepEqual(locationTerms(null), []);
  assert.deepEqual(locationTerms(undefined), []);
});
test("at most 3 terms", () => {
  assert.equal(locationTerms("a, b, c, d, e").length, 3);
});
test("Intermediate also matches All Levels", () => {
  assert.deepEqual(softLevelValues("Intermediate"), ["Intermediate", "All Levels"]);
});
test("level filter keeps matching, all-levels and unstated sessions", () => {
  assert.equal(matchesLevel("Intermediate", "Intermediate"), true);
  assert.equal(matchesLevel("All Levels", "Intermediate"), true);
  assert.equal(matchesLevel(null, "Intermediate"), true);
  assert.equal(matchesLevel("", "Intermediate"), true);
});
test("level filter still excludes sessions that name a different level", () => {
  assert.equal(matchesLevel("Advanced", "Intermediate"), false);
  assert.equal(matchesLevel("Beginner", "Intermediate"), false);
});
test("case-insensitive", () => {
  assert.equal(matchesLevel("intermediate", "Intermediate"), true);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
