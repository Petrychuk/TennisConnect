import assert from "node:assert/strict";
import test from "node:test";
import { goLiveProblem, matchClosed, notPlayedProblem, redoRoundProblem, roundProblem, scoreProblem } from "./liveRules";

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
