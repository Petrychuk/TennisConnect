// Standalone unit tests for liveEngine.ts - deliberately dependency-free
// (the repo has no vitest/jest, only Playwright for e2e) so this runs
// with the tsx that's already a devDependency:
//
//   npx tsx server/services/liveEngine.test.ts
//
// Math.random is monkey-patched per-test to make the otherwise-random
// shuffle deterministic, so assertions aren't flaky.

import assert from "node:assert/strict";
import { planRound, computeLeaderboard, type PastMatch } from "./liveEngine";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  const originalRandom = Math.random;
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  } finally {
    Math.random = originalRandom;
  }
}

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
}

// Deterministic "shuffle" - every Math.random() call returns 0, which
// makes the Fisher-Yates in liveEngine.ts always swap with index 0.
function mockRandomZero() {
  Math.random = () => 0;
}

console.log("liveEngine.ts");

test("singles: pairs everyone when players exactly fill the courts", () => {
  mockRandomZero();
  const result = planRound({
    players: players(4),
    courtsCount: 2,
    mode: "singles",
    pastMatches: [],
    restCounts: {},
  });
  assert.equal(result.matches.length, 2);
  assert.equal(result.restingPlayerIds.length, 0);
  const allIds = result.matches.flatMap((m) => [...m.teamAIds, ...m.teamBIds]);
  assert.equal(new Set(allIds).size, 4, "every player appears exactly once");
});

test("singles: courtsCount caps who plays, rest gets the remainder", () => {
  mockRandomZero();
  const result = planRound({
    players: players(5),
    courtsCount: 2, // playersPerCourt=2 -> maxPlaying=4
    mode: "singles",
    pastMatches: [],
    restCounts: {},
  });
  assert.equal(result.matches.length, 2);
  assert.equal(result.restingPlayerIds.length, 1);
});

test("doubles: forms 2v2 teams and doesn't drop anyone", () => {
  mockRandomZero();
  const result = planRound({
    players: players(8),
    courtsCount: 2,
    mode: "doubles",
    pastMatches: [],
    restCounts: {},
  });
  assert.equal(result.matches.length, 2);
  assert.equal(result.restingPlayerIds.length, 0);
  for (const m of result.matches) {
    assert.equal(m.teamAIds.length, 2);
    assert.equal(m.teamBIds.length, 2);
  }
  const allIds = result.matches.flatMap((m) => [...m.teamAIds, ...m.teamBIds]);
  assert.equal(new Set(allIds).size, 8);
});

test("doubles: odd-one-out beyond court capacity still rests, not partnered oddly", () => {
  mockRandomZero();
  // 9 players, 2 courts -> playersPerCourt=4, maxPlaying=8 -> 1 rests.
  const result = planRound({
    players: players(9),
    courtsCount: 2,
    mode: "doubles",
    pastMatches: [],
    restCounts: {},
  });
  assert.equal(result.restingPlayerIds.length, 1);
  const allIds = result.matches.flatMap((m) => [...m.teamAIds, ...m.teamBIds]);
  assert.equal(allIds.length, 8);
});

test("rest rotation: players with fewer past rests are chosen to rest first", () => {
  mockRandomZero();
  // 5 players, 1 court -> maxPlaying=2, 3 rest. p1 has never rested,
  // everyone else has rested 5 times - p1 must be among the 3 resting
  // now so rest counts converge instead of concentrating on the others.
  const result = planRound({
    players: players(5),
    courtsCount: 1,
    mode: "singles",
    pastMatches: [],
    restCounts: { p1: 0, p2: 5, p3: 5, p4: 5, p5: 5 },
  });
  assert.ok(result.restingPlayerIds.includes("p1"), "p1 (fewest past rests) should rest this round");
});

test("pairing avoids a repeat opponent when a fresh pairing is available", () => {
  mockRandomZero();
  // p1 vs p3 and p2 vs p4 already happened. p1-p4 / p2-p3 never have.
  // Total history cost of {p1-p4, p2-p3} is 0; of {p1-p3, p2-p4} is 2.
  // A history-aware pairer should land on the 0-cost option.
  const pastMatches: PastMatch[] = [
    { teamAIds: ["p1"], teamBIds: ["p3"] },
    { teamAIds: ["p2"], teamBIds: ["p4"] },
  ];
  const result = planRound({
    players: players(4),
    courtsCount: 2,
    mode: "singles",
    pastMatches,
    restCounts: {},
  });

  const cost = (a: string, b: string) =>
    pastMatches.filter(
      (m) =>
        (m.teamAIds[0] === a && m.teamBIds[0] === b) ||
        (m.teamAIds[0] === b && m.teamBIds[0] === a)
    ).length;

  const totalCost = result.matches.reduce(
    (sum, m) => sum + cost(m.teamAIds[0], m.teamBIds[0]),
    0
  );
  assert.equal(totalCost, 0, "should pick the pairing with zero repeat history");
});

test("computeLeaderboard: only confirmed matches count, wins/games aggregate correctly", () => {
  const result = computeLeaderboard({
    players: players(4),
    restCounts: { p3: 2 },
    matches: [
      { teamAIds: ["p1"], teamBIds: ["p2"], teamAGames: 4, teamBGames: 2, status: "confirmed" },
      { teamAIds: ["p1"], teamBIds: ["p3"], teamAGames: 3, teamBGames: 4, status: "confirmed" },
      // Not confirmed yet - must be excluded entirely.
      { teamAIds: ["p2"], teamBIds: ["p4"], teamAGames: 4, teamBGames: 0, status: "pending" },
    ],
  });

  const byId = Object.fromEntries(result.map((r) => [r.userId, r]));
  assert.equal(byId.p1.wins, 1);
  assert.equal(byId.p1.losses, 1);
  assert.equal(byId.p1.gamesWon, 7);
  assert.equal(byId.p1.gamesLost, 6);

  assert.equal(byId.p2.matchesPlayed, 1, "the pending match must not count");
  assert.equal(byId.p4.matchesPlayed, 0);
  assert.equal(byId.p3.restRounds, 2);

  // Sorted by wins desc: p1 and p3 both have 1 win, p2 has 0.
  assert.ok(result.findIndex((r) => r.userId === "p2") > result.findIndex((r) => r.userId === "p1"));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
