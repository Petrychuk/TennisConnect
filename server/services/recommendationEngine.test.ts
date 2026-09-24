// Standalone unit tests for recommendationEngine.ts - same
// dependency-free convention as liveEngine.test.ts (no vitest/jest in
// this repo):
//
//   npx tsx server/services/recommendationEngine.test.ts

import assert from "node:assert/strict";
import {
  computeRecommendation,
  isEventEligibleForPlayer,
  hasEnoughSignalForPersonalisation,
  computeDistanceKm,
  type RecommendationPlayerInput,
  type RecommendationEventInput,
} from "./recommendationEngine";

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

const THURSDAY_EVENING = "2026-10-01T19:00:00";
const MONDAY_MORNING = "2026-09-28T09:00:00";

function event(overrides: Partial<RecommendationEventInput> = {}): RecommendationEventInput {
  return {
    id: "evt-1",
    type: "social",
    playStatus: "open",
    registeredCount: 4,
    maxParticipants: 16,
    startAt: THURSDAY_EVENING,
    ...overrides,
  };
}

console.log("recommendationEngine.ts");

test("exact level match scores full level weight and reason", () => {
  const player: RecommendationPlayerInput = { skillLevel: "Intermediate" };
  const result = computeRecommendation(player, event({ skillLevel: "Intermediate" }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("SIMILAR_LEVEL"));
});

test("one-step level gap scores partial credit, not zero, not excluded", () => {
  const player: RecommendationPlayerInput = { skillLevel: "Advanced" };
  assert.equal(isEventEligibleForPlayer(player, event({ skillLevel: "Intermediate" })), true);
  const result = computeRecommendation(player, event({ skillLevel: "Intermediate" }));
  assert.ok(result.score > 0 && result.score < 100);
  assert.ok(result.reasons.includes("CLOSE_LEVEL"));
});

test("a hard level mismatch (2+ steps) is excluded, not just low-scored", () => {
  const player: RecommendationPlayerInput = { skillLevel: "Beginner" };
  assert.equal(isEventEligibleForPlayer(player, event({ skillLevel: "Pro" })), false);
});

test("spec's own worked example: a hard level restriction excludes an incompatible player entirely", () => {
  const player: RecommendationPlayerInput = { skillLevel: "Beginner" };
  assert.equal(isEventEligibleForPlayer(player, event({ skillLevel: "Advanced" })), false);
});

test("availability match awards the availability weight and reason", () => {
  const player: RecommendationPlayerInput = { availability: ["Weekday evenings", "Saturday"] };
  const result = computeRecommendation(player, event({ startAt: THURSDAY_EVENING }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("MATCHING_AVAILABILITY"));
});

test("availability mismatch scores 0 for that signal, no false reason", () => {
  const player: RecommendationPlayerInput = { availability: ["Saturday", "Sunday"] };
  const result = computeRecommendation(player, event({ startAt: MONDAY_MORNING }));
  assert.equal(result.score, 0);
  assert.ok(!result.reasons.includes("MATCHING_AVAILABILITY"));
});

test("distance/location is NOT scored (no real geocoding yet) - a shared area name gives zero points, not partial credit", () => {
  const player: RecommendationPlayerInput = { preferredCourts: ["Bondi Beach"] };
  const result = computeRecommendation(player, event({ location: "Bondi Beach Tennis Courts" }));
  // preferredCourts alone contributes nothing to the score right now -
  // available stays 0 for this signal, so the overall score is 0 (no
  // other signal supplied either) and NEARBY never appears.
  assert.equal(result.score, 0);
  assert.ok(!result.reasons.includes("NEARBY"));
});

test("computeDistanceKm returns null when either side lacks coordinates", () => {
  assert.equal(computeDistanceKm({ latitude: null, longitude: null }, { latitude: -33.89, longitude: 151.27 }), null);
  assert.equal(computeDistanceKm({ latitude: -33.89, longitude: 151.27 }, { latitude: null, longitude: null }), null);
});

test("computeDistanceKm returns a sane distance for two known Sydney points (Bondi to CBD, roughly 7-8km)", () => {
  const km = computeDistanceKm(
    { latitude: -33.8908, longitude: 151.2743 }, // Bondi Beach
    { latitude: -33.8688, longitude: 151.2093 } // Sydney CBD
  );
  assert.ok(km !== null && km > 5 && km < 10, `expected ~7km, got ${km}`);
});

test("a real event within the player's radius scores full distance weight and NEARBY", () => {
  const player: RecommendationPlayerInput = { playRadiusKm: 15, latitude: -33.8908, longitude: 151.2743 };
  const result = computeRecommendation(player, event({ latitude: -33.8688, longitude: 151.2093 }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("NEARBY"));
});

test("a real event just outside the radius scores partial distance credit, not zero and not full", () => {
  // ~7km apart, radius 5km -> outside radius but within 2x it.
  const player: RecommendationPlayerInput = { playRadiusKm: 5, latitude: -33.8908, longitude: 151.2743 };
  const result = computeRecommendation(player, event({ latitude: -33.8688, longitude: 151.2093 }));
  assert.ok(result.score > 0 && result.score < 100, `expected partial credit, got ${result.score}`);
});

test("a real event far beyond 2x the radius scores zero for distance", () => {
  // Sydney vs Melbourne - roughly 700km+ apart.
  const player: RecommendationPlayerInput = { playRadiusKm: 15, latitude: -33.8688, longitude: 151.2093 };
  const result = computeRecommendation(player, event({ latitude: -37.8136, longitude: 144.9631 }));
  assert.equal(result.score, 0);
  assert.ok(!result.reasons.includes("NEARBY"));
});

test("distance is skipped (not scored) when the player has no playRadiusKm even with coordinates on both sides", () => {
  const player: RecommendationPlayerInput = { latitude: -33.8908, longitude: 151.2743 };
  const result = computeRecommendation(player, event({ latitude: -33.8688, longitude: 151.2093 }));
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

test("matching game format (Doubles) scores that weight", () => {
  const player: RecommendationPlayerInput = { gameFormat: "Doubles" };
  const result = computeRecommendation(player, event({ matchFormat: "doubles" }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("LOOKING_FOR_DOUBLES"));
});

test("mismatched game format scores 0 for that signal", () => {
  const player: RecommendationPlayerInput = { gameFormat: "Singles" };
  const result = computeRecommendation(player, event({ matchFormat: "doubles" }));
  assert.equal(result.score, 0);
});

test("BUG FIX regression: a player's game format preference is NOT penalised when the event has no matchFormat data at all (was: 15 unreachable points always added to available)", () => {
  const player: RecommendationPlayerInput = { skillLevel: "Intermediate", gameFormat: "Doubles" };
  const result = computeRecommendation(player, event({ skillLevel: "Intermediate" })); // no matchFormat on the event
  // Only level should count: 30 matched / 30 available = 100%, not
  // 30/45 = 67% from an unmatchable format signal dragging it down.
  assert.equal(result.score, 100);
});

test("gameFormat 'Both' contributes no weight either way", () => {
  const player: RecommendationPlayerInput = { gameFormat: "Both" };
  const result = computeRecommendation(player, event({ matchFormat: "doubles" }));
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

test("competitive player + a competition-type event scores the intent weight", () => {
  const player: RecommendationPlayerInput = { playStyle: "Competitive" };
  const result = computeRecommendation(player, event({ type: "tournament" }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("PREFERRED_STYLE"));
});

test("player looking for competitions matches a competition-type event", () => {
  const player: RecommendationPlayerInput = { lookingFor: ["Playing Events"] };
  const result = computeRecommendation(player, event({ type: "league" }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("LOOKING_FOR_COMPETITIONS"));
});

test("missing signals are excluded from the denominator, not scored as a mismatch", () => {
  const player: RecommendationPlayerInput = { skillLevel: "Intermediate" };
  const result = computeRecommendation(player, event({ skillLevel: "Intermediate" }));
  assert.equal(result.score, 100);
});

test("partial profile normalises correctly (matched/available, not matched/100)", () => {
  const player: RecommendationPlayerInput = {
    skillLevel: "Intermediate",
    availability: ["Weekday evenings"],
    gameFormat: "Singles",
  };
  const result = computeRecommendation(
    player,
    event({ skillLevel: "Intermediate", startAt: THURSDAY_EVENING, matchFormat: "doubles" })
  );
  // matched = 30 (level) + 25 (availability) + 0 (format mismatch) = 55
  // available = 30 + 25 + 15 = 70
  assert.equal(result.score, Math.round((55 / 70) * 100));
});

test("a fully empty player profile never divides by zero and never fakes a score", () => {
  const player: RecommendationPlayerInput = {};
  const result = computeRecommendation(player, event());
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

test("a full event with no waiting list is excluded", () => {
  const player: RecommendationPlayerInput = { skillLevel: "Intermediate" };
  assert.equal(
    isEventEligibleForPlayer(player, event({ playStatus: "full", waitingListEnabled: false })),
    false
  );
});

test("a closed-registration event is excluded", () => {
  const player: RecommendationPlayerInput = { skillLevel: "Intermediate" };
  assert.equal(isEventEligibleForPlayer(player, event({ playStatus: "closed" })), false);
});

test("an open event with an eligible level is not excluded", () => {
  const player: RecommendationPlayerInput = { skillLevel: "Intermediate" };
  assert.equal(isEventEligibleForPlayer(player, event({ playStatus: "open", skillLevel: "Intermediate" })), true);
});

test("a brand new profile (one signal) does not qualify for personalised percentages", () => {
  assert.equal(hasEnoughSignalForPersonalisation({ preferredCourts: ["Bondi Beach"] }), false);
});

test("two or more real signals is enough to show a real percentage", () => {
  assert.equal(
    hasEnoughSignalForPersonalisation({ preferredCourts: ["Bondi Beach"], skillLevel: "Intermediate" }),
    true
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
