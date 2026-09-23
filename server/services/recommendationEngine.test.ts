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

test("event location containing a preferred area scores full distance weight", () => {
  const player: RecommendationPlayerInput = { preferredCourts: ["Bondi Beach"] };
  const result = computeRecommendation(player, event({ location: "Bondi Beach Tennis Courts" }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("NEARBY"));
});

test("event location outside every preferred area scores 0 for that signal", () => {
  const player: RecommendationPlayerInput = { preferredCourts: ["Bondi Beach"] };
  const result = computeRecommendation(player, event({ location: "Parramatta Park" }));
  assert.equal(result.score, 0);
  assert.ok(!result.reasons.includes("NEARBY"));
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
