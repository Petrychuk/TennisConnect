import assert from "node:assert/strict";
import test from "node:test";
import { goLiveProblem, matchClosed, notPlayedProblem, playerScoreAction, playerScoreDecision, redoRoundProblem, roundProblem, scoreProblem, sideOf } from "./liveRules";

test("score validation: whole games 0-99, ties allowed, 0-0 refused", () => {
  assert.equal(scoreProblem(6, 4), null);
  assert.equal(scoreProblem(5, 5), null, "a draw is a real result");
  assert.equal(scoreProblem(0, 6), null);
  assert.match(scoreProblem(0, 0)!, /0-0/);
  assert.match(scoreProblem(-1, 6)!, /between 0 and 99/);
  assert.match(scoreProblem(100, 6)!, /between 0 and 99/);
  assert.match(scoreProblem(6.5, 4)!, /whole/);
  assert.match(scoreProblem("6", 4)!, /whole/);
});

test("go live: published, courts set, enough checked-in players for the mode; already live is fine", () => {
  const base = { status: "published", courtsCount: 2, matchMode: "doubles" };
  assert.equal(goLiveProblem(base, 4), null);
  assert.match(goLiveProblem(base, 3)!, /Doubles needs at least 4/);
  assert.equal(goLiveProblem({ ...base, matchMode: "singles" }, 2), null);
  assert.match(goLiveProblem({ ...base, matchMode: "singles" }, 1)!, /Singles needs at least 2/);
  assert.match(goLiveProblem({ ...base, courtsCount: null }, 8)!, /court count/);
  assert.match(goLiveProblem({ ...base, status: "draft" }, 8)!, /published first/);
  assert.match(goLiveProblem({ ...base, status: "completed" }, 8)!, /from status "completed"/);
  assert.equal(goLiveProblem({ ...base, status: "live" }, 0), null, "idempotent");
});

test("a round needs a full court of available players (no empty doubles rounds)", () => {
  assert.equal(roundProblem("doubles", 4), null);
  assert.match(roundProblem("doubles", 3)!, /at least 4 available players for a round \(3 now\)/);
  assert.equal(roundProblem("singles", 2), null);
  assert.match(roundProblem("singles", 1)!, /at least 2/);
  assert.match(roundProblem(null, 2)!, /Doubles/, "unknown mode is doubles, like the engine");
});

test("not played: a pending or playing match closes without a score; a scored one is corrected instead", () => {
  assert.equal(notPlayedProblem("pending"), null);
  assert.equal(notPlayedProblem("playing"), null);
  assert.equal(notPlayedProblem("abandoned"), null, "repeat is a no-op");
  assert.match(notPlayedProblem("confirmed")!, /correct the score/);
  assert.equal(matchClosed("confirmed"), true);
  assert.equal(matchClosed("abandoned"), true);
  assert.equal(matchClosed("playing"), false);
  assert.equal(matchClosed("pending"), false);
});

test("redo round: only while every match is still pending", () => {
  const active = { status: "active" };
  assert.equal(redoRoundProblem(active, [{ status: "pending" }, { status: "pending" }]), null);
  assert.match(redoRoundProblem(active, [{ status: "pending" }, { status: "playing" }])!, /has started/);
  assert.match(redoRoundProblem(active, [{ status: "confirmed" }])!, /has started/);
  assert.match(redoRoundProblem(active, [{ status: "abandoned" }])!, /has started/);
  assert.match(redoRoundProblem({ status: "completed" }, [])!, /has started/);
  assert.match(redoRoundProblem(null, [])!, /no round/);
});

// Player score entry (TC-189, PO 10 Nov 2026).
const pm = (over: Partial<import("./liveRules").PlayerScoreMatch> = {}) => ({
  status: "pending", teamAIds: ["a1", "a2"], teamBIds: ["b1", "b2"], teamAGames: null, teamBGames: null, reportedBy: null, ...over,
});

test("player score: only players in the match, only while live", () => {
  assert.deepEqual(playerScoreDecision("live", pm(), "a1", 6, 3), { ok: true, outcome: { kind: "reported" } });
  const outsider = playerScoreDecision("live", pm(), "x", 6, 3);
  assert.equal(outsider.ok, false); assert.equal((outsider as any).status, 403);
  for (const status of ["published", "completed", "archived"]) {
    const r = playerScoreDecision(status, pm(), "a1", 6, 3);
    assert.equal(r.ok, false, status); assert.equal((r as any).status, 409);
  }
});

test("player score: the other side confirms the same score, a different one is disputed", () => {
  const reported = pm({ status: "reported", teamAGames: 6, teamBGames: 3, reportedBy: "a1" });
  assert.deepEqual(playerScoreDecision("live", reported, "b2", 6, 3), { ok: true, outcome: { kind: "confirmed" } });
  assert.deepEqual(playerScoreDecision("live", reported, "b1", 6, 4), { ok: true, outcome: { kind: "disputed" } });
  // The partner (same side) only replaces the report - never confirms their own side.
  assert.deepEqual(playerScoreDecision("live", reported, "a2", 6, 3), { ok: true, outcome: { kind: "reported" } });
});

test("player score: confirmed, not played and disputed are the organiser's", () => {
  for (const status of ["confirmed", "abandoned", "disputed"]) {
    const r = playerScoreDecision("live", pm({ status, teamAGames: 6, teamBGames: 3, reportedBy: "a1" }), "b1", 6, 3);
    assert.equal(r.ok, false, status); assert.equal((r as any).status, 409);
  }
});

test("player score: what each player is asked to do", () => {
  assert.equal(playerScoreAction(pm(), "a1"), "enter");
  assert.equal(playerScoreAction(pm({ status: "playing" }), "b1"), "enter");
  const reported = pm({ status: "reported", teamAGames: 6, teamBGames: 3, reportedBy: "a1" });
  assert.equal(playerScoreAction(reported, "a2"), "waiting");
  assert.equal(playerScoreAction(reported, "b1"), "confirm");
  assert.equal(playerScoreAction(pm({ status: "disputed" }), "a1"), "disputed");
  assert.equal(playerScoreAction(pm({ status: "confirmed" }), "a1"), "final");
  assert.equal(playerScoreAction(pm(), "x"), "none");
  assert.equal(sideOf(pm(), "b2"), "B");
});

test("player score: a reported or disputed match keeps its round open", () => {
  assert.equal(matchClosed("reported"), false);
  assert.equal(matchClosed("disputed"), false);
});

// TC-189 (PO, 24 Nov 2026): Social Tennis matches can end in a draw, e.g. 2:2. No winner forced, no tie-break.
test("draw 2:2: a valid score for players and the organiser", () => {
  assert.equal(scoreProblem(2, 2), null);
  assert.equal(scoreProblem(6, 6), null);
});

test("draw 2:2: the other side confirming 2:2 confirms it; 3:2 against a reported 2:2 is disputed", () => {
  const reported = pm({ status: "reported", teamAGames: 2, teamBGames: 2, reportedBy: "a1" });
  assert.deepEqual(playerScoreDecision("live", reported, "b1", 2, 2), { ok: true, outcome: { kind: "confirmed" } });
  assert.deepEqual(playerScoreDecision("live", reported, "b1", 3, 2), { ok: true, outcome: { kind: "disputed" } });
  // And the other way round: a reported win, the opponents say it was a draw.
  const win = pm({ status: "reported", teamAGames: 3, teamBGames: 2, reportedBy: "a2" });
  assert.deepEqual(playerScoreDecision("live", win, "b2", 2, 2), { ok: true, outcome: { kind: "disputed" } });
});
