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

test("computeLeaderboard: a tied score counts as a draw for both sides, not a win for one and a loss for the other", () => {
  const result = computeLeaderboard({
    players: players(2),
    restCounts: {},
    matches: [
      { teamAIds: ["p1"], teamBIds: ["p2"], teamAGames: 2, teamBGames: 2, status: "confirmed" },
    ],
  });

  const byId = Object.fromEntries(result.map((r) => [r.userId, r]));
  assert.equal(byId.p1.wins, 0);
  assert.equal(byId.p1.losses, 0);
  assert.equal(byId.p1.draws, 1);
  assert.equal(byId.p2.wins, 0);
  assert.equal(byId.p2.losses, 0);
  assert.equal(byId.p2.draws, 1);
});

// ---- TC Live v1 (30 Oct 2026) ----

/** Plays `rounds` rounds through planRound, feeding history back in like storage does. */
function simulate(n: number, courtsCount: number, mode: "singles" | "doubles", rounds: number) {
  const pastMatches: PastMatch[] = [];
  const restCounts: Record<string, number> = {};
  const roster = players(n);
  const plans = [];
  for (let r = 0; r < rounds; r++) {
    const plan = planRound({ players: roster, courtsCount, mode, pastMatches, restCounts });
    plans.push(plan);
    pastMatches.push(...plan.matches);
    for (const id of plan.restingPlayerIds) restCounts[id] = (restCounts[id] ?? 0) + 1;
  }
  return { plans, restCounts, pastMatches, roster };
}

test("every round: nobody plays twice, nobody is both playing and resting, everyone accounted for", () => {
  for (const [n, courts, mode] of [[7, 2, "doubles"], [9, 3, "singles"], [13, 2, "doubles"], [5, 4, "singles"]] as const) {
    const { plans } = simulate(n, courts, mode, 6);
    for (const plan of plans) {
      const onCourt = plan.matches.flatMap((m) => [...m.teamAIds, ...m.teamBIds]);
      assert.equal(new Set(onCourt).size, onCourt.length, `${n}/${courts}/${mode}: no double booking`);
      assert.ok(onCourt.every((id) => !plan.restingPlayerIds.includes(id)));
      assert.equal(onCourt.length + plan.restingPlayerIds.length, n);
      assert.ok(plan.matches.length <= courts, "never more matches than courts");
      const size = mode === "singles" ? 1 : 2;
      assert.ok(plan.matches.every((m) => m.teamAIds.length === size && m.teamBIds.length === size));
    }
  }
});

test("odd player count and too few courts: rests rotate so nobody rests twice before everyone rested once", () => {
  // 9 singles players, 2 courts -> 4 play, 5 rest each round.
  const { plans, restCounts } = simulate(9, 2, "singles", 9);
  for (const plan of plans) assert.equal(plan.matches.length, 2);
  const counts = Object.values(restCounts);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `rests stay within one of each other: ${JSON.stringify(restCounts)}`);
  // 5 doubles players, 1 court: exactly one rests per round, a different one each time for 5 rounds.
  const five = simulate(5, 1, "doubles", 5);
  const resters = five.plans.map((p) => p.restingPlayerIds[0]);
  assert.equal(new Set(resters).size, 5, `every player rests once in five rounds: ${resters.join(",")}`);
});

test("doubles partner rotation: 8 players over 3 rounds never repeat a partner while a fresh one exists", () => {
  // 8 players, 2 courts: each player has 7 possible partners; greedy pairing
  // should avoid a repeat in the first rounds (allowing a small tolerance, it
  // is a greedy heuristic, not a perfect round-robin scheduler).
  const { pastMatches } = simulate(8, 2, "doubles", 3);
  const partners = new Map<string, number>();
  for (const m of pastMatches) {
    for (const team of [m.teamAIds, m.teamBIds]) {
      const key = [...team].sort().join("|");
      partners.set(key, (partners.get(key) ?? 0) + 1);
    }
  }
  const partnerCounts = Array.from(partners.values());
const partnerEntries = Array.from(partners.entries());

assert.ok(
  partnerCounts.every((count) => count === 1),
  `no repeated partnership in 3 rounds: ${JSON.stringify(partnerEntries)}`
  );
});

test("fewer players than one court needs: no match at all (the server refuses such a round)", () => {
  const plan = planRound({ players: players(3), courtsCount: 2, mode: "doubles", pastMatches: [], restCounts: {} });
  assert.equal(plan.matches.length, 0);
  assert.equal(plan.restingPlayerIds.length, 3);
});

test("computeLeaderboard: wins, then draws, then games difference, then games won, then a stable id order", () => {
  const m = (a: string, b: string, ga: number, gb: number) => ({ teamAIds: [a], teamBIds: [b], teamAGames: ga, teamBGames: gb, status: "confirmed" });
  const rows = computeLeaderboard({
    matches: [
      m("pA", "x1", 6, 0), // A: 1 win, +6
      m("pB", "x2", 6, 5), // B: 1 win, +1
      m("pC", "x3", 4, 4), // C: 1 draw
      m("pD", "x4", 6, 5), // D: 1 win, +1, same as B -> games won equal too -> id order
      m("x5", "pE", 9, 9), // E: 1 draw, more games than C
    ],
    restCounts: {},
    players: [],
  });
  const order = rows.map((r) => r.userId).filter((id) => id.startsWith("p"));
  assert.deepEqual(order, ["pA", "pB", "pD", "pE", "pC"]);
  // Same input in a different order gives the same table.
  const again = computeLeaderboard({ matches: [m("pD", "x4", 6, 5), m("pB", "x2", 6, 5)], restCounts: {}, players: [] });
  assert.deepEqual(again.map((r) => r.userId).slice(0, 2), ["pB", "pD"]);
});

test("computeLeaderboard: abandoned and unscored matches never count", () => {
  const rows = computeLeaderboard({
    matches: [
      { teamAIds: ["p1"], teamBIds: ["p2"], teamAGames: 6, teamBGames: 1, status: "abandoned" },
      { teamAIds: ["p1"], teamBIds: ["p2"], teamAGames: null, teamBGames: null, status: "playing" },
    ],
    restCounts: { p1: 1 },
    players: [{ id: "p1" }, { id: "p2" }],
  });
  for (const r of rows) assert.equal(r.matchesPlayed, 0, r.userId);
  assert.equal(rows.find((r) => r.userId === "p1")!.restRounds, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
