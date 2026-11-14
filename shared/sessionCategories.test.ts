import assert from "node:assert/strict";
import test from "node:test";
import { ALL_SESSION_FORMATS, SESSION_CATEGORIES, isCompetitionType, sessionCategoryOf } from "./sessionCategories";

test("four categories, every stored format key in exactly one of them", () => {
  assert.deepEqual(SESSION_CATEGORIES.map((c) => c.label), ["Social Play", "Competition", "Coaching & Fitness", "Other"]);
  assert.equal(new Set(ALL_SESSION_FORMATS).size, ALL_SESSION_FORMATS.length, "no format in two categories");
  // Every key the wizard has ever saved still resolves - existing sessions keep working.
  for (const key of [
    "social", "americano", "mexicano", "round-robin", "king-of-the-court",
    "tournament", "league", "club-championship", "junior-event",
    "coaching-clinic", "cardio-tennis", "junior-development", "custom",
  ]) {
    assert.ok(ALL_SESSION_FORMATS.includes(key), key);
  }
});

test("competition formats are exactly the list Play and recommendations used before", () => {
  const competition = ALL_SESSION_FORMATS.filter(isCompetitionType).sort();
  assert.deepEqual(competition, ["club-championship", "junior-event", "league", "tournament"]);
});

test("Junior: the competition is Competition, development is Coaching & Fitness", () => {
  assert.equal(sessionCategoryOf("junior-event").key, "competition");
  assert.equal(sessionCategoryOf("junior-development").key, "coaching-fitness");
});

test("coaching has no match format and no rounds; unknown or missing types fall back to Other", () => {
  const coaching = sessionCategoryOf("coaching-clinic");
  assert.equal(coaching.usesMatchFormat, false);
  assert.equal(coaching.usesLiveRounds, false);
  assert.equal(sessionCategoryOf("cardio-tennis").usesLiveRounds, false);
  assert.equal(sessionCategoryOf("social").usesLiveRounds, true);
  assert.equal(sessionCategoryOf("something-new").key, "other");
  assert.equal(sessionCategoryOf(null).key, "other");
  assert.equal(sessionCategoryOf(undefined).usesMatchFormat, true, "Other keeps every setting");
});
