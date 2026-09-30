// Standalone unit tests for playerMatchEngine.ts - same
// dependency-free convention as the other two engines:
//
//   npx tsx server/services/playerMatchEngine.test.ts

import assert from "node:assert/strict";
import {
  computePlayerMatch,
  isPlayerEligibleForMatching,
  isLookingToPlayActive,
  computeLookingToPlayExpiry,
  hasEnoughSignalForPlayerMatch,
  type MatchCandidateInput,
} from "./playerMatchEngine";

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

const NOW = new Date("2026-10-01T12:00:00.000Z"); // a Thursday

function candidate(overrides: Partial<MatchCandidateInput> = {}): MatchCandidateInput {
  return {
    userId: "candidate-1",
    lookingToPlayEnabled: true,
    lookingToPlayExpiresAt: new Date("2026-10-05T00:00:00.000Z"),
    ...overrides,
  };
}

console.log("playerMatchEngine.ts");

// --- Level ---

test("similar UTR/level scores full level weight", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", skillLevel: "Intermediate" });
  const result = computePlayerMatch(viewer, candidate({ skillLevel: "Intermediate" }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("SIMILAR_LEVEL"));
});

test("different level (2+ steps) scores 0 for that signal, not excluded from scoring itself", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", skillLevel: "Beginner" });
  const result = computePlayerMatch(viewer, candidate({ skillLevel: "Pro" }));
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

test("one-step level gap gives partial credit", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", skillLevel: "Advanced" });
  const result = computePlayerMatch(viewer, candidate({ skillLevel: "Intermediate" }));
  assert.ok(result.score > 0 && result.score < 100);
  assert.ok(result.reasons.includes("CLOSE_LEVEL"));
});

// --- Availability ---

test("same Looking to Play availability scores full weight", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", lookingToPlayWhen: "this_weekend" });
  const result = computePlayerMatch(viewer, candidate({ lookingToPlayWhen: "this_weekend" }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("SAME_AVAILABILITY"));
});

test("incompatible availability scores 0 for that signal", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", lookingToPlayWhen: "today" });
  const result = computePlayerMatch(viewer, candidate({ lookingToPlayWhen: "this_week" }));
  assert.equal(result.score, 0);
});

// --- Format ---

test("Singles vs Singles matches", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", gameFormat: "Singles" });
  const result = computePlayerMatch(viewer, candidate({ lookingToPlayFormat: "singles" }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("SAME_FORMAT"));
});

test("Singles vs Doubles does not match", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", gameFormat: "Singles" });
  const result = computePlayerMatch(viewer, candidate({ lookingToPlayFormat: "doubles" }));
  assert.equal(result.score, 0);
});

test("candidate's 'either' format never blocks a match, and isn't scored as a specific signal", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", gameFormat: "Singles" });
  const result = computePlayerMatch(viewer, candidate({ lookingToPlayFormat: "either" }));
  // No format signal counted at all (available stays 0 for it) -
  // "Either" means the candidate is fine with anything, not that they
  // definitionally match every specific format request.
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

// --- Distance ---

test("within the viewer's preferred radius scores full distance weight", () => {
  const viewer: MatchCandidateInput = candidate({
    userId: "me",
    latitude: -33.8908,
    longitude: 151.2743,
    playRadiusKm: 15,
  });
  const result = computePlayerMatch(viewer, candidate({ latitude: -33.8688, longitude: 151.2093 }));
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("NEARBY"));
});

test("far beyond the radius (Sydney vs Melbourne) scores 0 for distance", () => {
  const viewer: MatchCandidateInput = candidate({
    userId: "me",
    latitude: -33.8688,
    longitude: 151.2093,
    playRadiusKm: 15,
  });
  const result = computePlayerMatch(viewer, candidate({ latitude: -37.8136, longitude: 144.9631 }));
  assert.equal(result.score, 0);
});

// --- Incomplete profile / normalisation ---

test("incomplete profile (missing play style) still scores using available signals, missing != mismatch", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", skillLevel: "Intermediate", playStyle: "Social" });
  // Candidate has no playStyle at all.
  const result = computePlayerMatch(viewer, candidate({ skillLevel: "Intermediate" }));
  assert.equal(result.score, 100); // only level counted, and it matched fully
});

test("hasEnoughSignalForPlayerMatch is false when nothing actually matched (spec: show 'Potential match', not a fake %)", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me" });
  const result = computePlayerMatch(viewer, candidate());
  assert.equal(result.score, 0);
  assert.equal(hasEnoughSignalForPlayerMatch(result.reasons), false);
});

test("hasEnoughSignalForPlayerMatch is true once at least one real reason exists", () => {
  const viewer: MatchCandidateInput = candidate({ userId: "me", skillLevel: "Intermediate" });
  const result = computePlayerMatch(viewer, candidate({ skillLevel: "Intermediate" }));
  assert.equal(hasEnoughSignalForPlayerMatch(result.reasons), true);
});

// --- Looking to Play expiry ---

test("expired Looking to Play status is not active", () => {
  const c = candidate({ lookingToPlayExpiresAt: new Date("2026-09-01T00:00:00.000Z") }); // in the past relative to NOW
  assert.equal(isLookingToPlayActive(c, NOW), false);
});

test("Looking to Play with no expiry set at all is not active (never treat 'unset' as 'forever')", () => {
  const c = candidate({ lookingToPlayExpiresAt: null });
  assert.equal(isLookingToPlayActive(c, NOW), false);
});

test("Looking to Play disabled is never active even with a future expiry", () => {
  const c = candidate({ lookingToPlayEnabled: false, lookingToPlayExpiresAt: new Date("2026-12-01T00:00:00.000Z") });
  assert.equal(isLookingToPlayActive(c, NOW), false);
});

test("computeLookingToPlayExpiry('today') expires at end of the same day", () => {
  const expiry = computeLookingToPlayExpiry("today", NOW);
  assert.equal(expiry.getUTCDate(), NOW.getUTCDate());
  assert.ok(expiry.getTime() > NOW.getTime());
});

test("computeLookingToPlayExpiry('this_week') expires 7 days later", () => {
  const expiry = computeLookingToPlayExpiry("this_week", NOW);
  const diffDays = (expiry.getTime() - NOW.getTime()) / (1000 * 60 * 60 * 24);
  assert.ok(diffDays >= 6.9 && diffDays <= 7.1);
});

test("computeLookingToPlayExpiry('this_weekend') expires after the upcoming Sunday", () => {
  const expiry = computeLookingToPlayExpiry("this_weekend", NOW); // NOW is a Thursday
  assert.ok(expiry.getTime() > NOW.getTime());
  const diffDays = (expiry.getTime() - NOW.getTime()) / (1000 * 60 * 60 * 24);
  assert.ok(diffDays <= 4); // Thursday -> Sunday is at most 3-4 days out
});

// --- Hard exclusions (spec section 8) ---

test("self is always excluded regardless of any other field", () => {
  const c = candidate({ isSelf: true, skillLevel: "Intermediate" });
  assert.equal(isPlayerEligibleForMatching(c, NOW), false);
});

test("a blocked user is excluded", () => {
  const c = candidate({ isBlocked: true });
  assert.equal(isPlayerEligibleForMatching(c, NOW), false);
});

test("a deactivated/suspended account is excluded", () => {
  const c = candidate({ accountStatus: "deactivated" });
  assert.equal(isPlayerEligibleForMatching(c, NOW), false);
});

test("an active account is not excluded on that basis alone", () => {
  const c = candidate({ accountStatus: "active" });
  assert.equal(isPlayerEligibleForMatching(c, NOW), true);
});

test("a player hidden from discovery is excluded", () => {
  const c = candidate({ isHiddenFromDiscovery: true });
  assert.equal(isPlayerEligibleForMatching(c, NOW), false);
});

test("expired Looking to Play excludes a candidate from matching entirely", () => {
  const c = candidate({ lookingToPlayExpiresAt: new Date("2026-01-01T00:00:00.000Z") });
  assert.equal(isPlayerEligibleForMatching(c, NOW), false);
});

test("Looking to Play turned OFF excludes a candidate even with everything else fine", () => {
  const c = candidate({ lookingToPlayEnabled: false });
  assert.equal(isPlayerEligibleForMatching(c, NOW), false);
});

test("a fully eligible candidate passes", () => {
  const c = candidate();
  assert.equal(isPlayerEligibleForMatching(c, NOW), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
