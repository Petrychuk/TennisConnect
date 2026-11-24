import test from "node:test";
import assert from "node:assert/strict";
import { buildPlayerLiveView } from "./playerLiveView";

const session = { id: "s1", title: "Sunday Social Doubles", status: "live", matchMode: "doubles", startAt: "2026-11-20T08:00:00Z" } as any;
const p = (id: string) => ({ id, name: id.toUpperCase(), avatar: null });
const match = (id: string, a: string[], b: string[], over: Record<string, unknown> = {}) =>
  ({ id, courtLabel: `Court ${id}`, status: "pending", teamAIds: a, teamBIds: b, teamA: a.map(p), teamB: b.map(p), teamAGames: null, teamBGames: null, reportedBy: null, ...over }) as any;
const current = {
  round: { roundNumber: 2, status: "active", restingPlayerIds: ["r1"] } as any,
  matches: [match("1", ["a1", "a2"], ["b1", "b2"]), match("2", ["c1", "c2"], ["d1", "d2"], { status: "reported", teamAGames: 6, teamBGames: 4, reportedBy: "c1" })],
};

test("player view: my court, my side and my next step", () => {
  const v = buildPlayerLiveView(session, "b2", true, current, []);
  assert.equal(v.round?.number, 2);
  assert.equal(v.match?.id, "1");
  assert.equal(v.match?.mySide, "B");
  assert.equal(v.match?.action, "enter");
  assert.equal(v.resting, false);
  assert.equal(buildPlayerLiveView(session, "d1", true, current, []).match?.action, "confirm");
  assert.equal(buildPlayerLiveView(session, "c2", true, current, []).match?.action, "waiting");
});

test("player view: resting, no round yet, not on court - never someone else's match", () => {
  const resting = buildPlayerLiveView(session, "r1", true, current, []);
  assert.equal(resting.match, null);
  assert.equal(resting.resting, true);
  const noRound = buildPlayerLiveView(session, "a1", true, undefined, []);
  assert.equal(noRound.round, null);
  assert.equal(noRound.match, null);
  const late = buildPlayerLiveView(session, "late", true, current, []);
  assert.equal(late.match, null);
  assert.equal(late.resting, false);
});

test("player view: a confirmed 2:2 draw is final for both sides, scores shown as entered (no winner)", () => {
  const draw = { round: current.round, matches: [match("1", ["a1", "a2"], ["b1", "b2"], { status: "confirmed", teamAGames: 2, teamBGames: 2, reportedBy: "a1", confirmedBy: "b1" })] };
  for (const id of ["a1", "b2"]) {
    const v = buildPlayerLiveView(session, id, true, draw, []);
    assert.equal(v.match?.action, "final", id);
    assert.equal(v.match?.teamAGames, 2);
    assert.equal(v.match?.teamBGames, 2);
  }
  const disputed = { round: current.round, matches: [match("1", ["a1", "a2"], ["b1", "b2"], { status: "disputed", teamAGames: 2, teamBGames: 2, reportedBy: "a1" })] };
  assert.equal(buildPlayerLiveView(session, "b1", true, disputed, []).match?.action, "disputed");
});
