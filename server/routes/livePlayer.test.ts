// npx tsx --test server/routes/livePlayer.test.ts
//
// TC Live for players (server/routes/livePlayer.ts) on the REAL router,
// loopback server, faked storage (no Postgres), sign-in by test header -
// same harness as organizerLive.test.ts. The fake score store applies the
// REAL rules (shared/liveRules.ts playerScoreDecision), so these tests
// cover the decisions, not just the wiring.
//
// Covers: Live flag, auth, registered players only, current-round only
// (IDOR), score validation, report -> confirm / dispute, draws (2:2, PO
// 24 Nov 2026 - no winner forced) and the organiser deciding afterwards.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { LiveRuleError } from "../lib/liveErrors";
import { matchClosed, playerScoreDecision } from "@shared/liveRules";

const user = (id: string) => ({ id, email: `${id}@example.test`, role: "player", isOrganizer: false, isAdmin: false, name: id.toUpperCase(), slug: id });
const USERS: Record<string, any> = Object.fromEntries(["a1", "a2", "b1", "b2", "x", "c1", "c2"].map((id) => [id, user(id)]));

let SESSIONS: Record<string, any> = {};
let REGS: any[] = [];
let MATCHES: Record<string, any> = {};
let ROUND: any = null;

function resetData() {
  SESSIONS = {
    "live-1": { id: "live-1", organizationId: "org", status: "live", matchMode: "doubles", isInternalTest: false, title: "Sunday Social Doubles", startAt: new Date(Date.now() - 36e5), type: "social" },
    "live-2": { id: "live-2", organizationId: "org", status: "live", matchMode: "singles", isInternalTest: false, title: "Other", startAt: new Date(Date.now() - 36e5), type: "social" },
    "done-1": { id: "done-1", organizationId: "org", status: "completed", matchMode: "doubles", isInternalTest: false, title: "Done", startAt: new Date(Date.now() - 864e5), type: "social" },
  };
  REGS = [
    ...["a1", "a2", "b1", "b2"].map((u) => ({ id: `r-${u}`, sessionId: "live-1", userId: u, status: "registered", checkedInAt: new Date() })),
    { id: "r-x", sessionId: "live-1", userId: "x", status: "waitlisted", checkedInAt: null },
    ...["c1", "c2"].map((u) => ({ id: `r-${u}`, sessionId: "live-2", userId: u, status: "registered", checkedInAt: new Date() })),
    ...["a1", "b1"].map((u) => ({ id: `rd-${u}`, sessionId: "done-1", userId: u, status: "registered", checkedInAt: new Date() })),
  ];
  const team = (ids: string[]) => ids.map((id) => ({ id, name: id.toUpperCase(), avatar: null }));
  MATCHES = {
    m1: { id: "m1", sessionId: "live-1", roundId: "rd1", courtLabel: "Court 1", status: "playing", teamAIds: ["a1", "a2"], teamBIds: ["b1", "b2"], teamA: team(["a1", "a2"]), teamB: team(["b1", "b2"]), teamAGames: null, teamBGames: null, reportedBy: null, confirmedBy: null },
    m2: { id: "m2", sessionId: "live-2", roundId: "rd2", courtLabel: "Court 1", status: "playing", teamAIds: ["c1"], teamBIds: ["c2"], teamA: team(["c1"]), teamB: team(["c2"]), teamAGames: null, teamBGames: null, reportedBy: null, confirmedBy: null },
  };
  ROUND = { id: "rd1", roundNumber: 1, status: "active", restingPlayerIds: [] };
}

let server: http.Server;
let base = "";
let restore = () => {};

before(async () => {
  resetData();
  const { storage } = await import("../storage");
  const s = storage as any;
  const fakes: Record<string, (...args: any[]) => any> = {
    getUser: async (id: string) => USERS[id],
    getSessionById: async (id: string) => SESSIONS[id],
    getRegistrationsForSession: async (id: string) => REGS.filter((r) => r.sessionId === id),
    autoStartDueSessions: async () => [],
    getCurrentRound: async (sessionId: string) =>
      sessionId === "live-1" ? { round: ROUND, matches: [MATCHES.m1] } : sessionId === "live-2" ? { round: { ...ROUND, id: "rd2" }, matches: [MATCHES.m2] } : undefined,
    getSessionLeaderboard: async () => [],
    // Same decisions and writes as storage.reportMatchScoreByPlayer, in memory.
    reportMatchScoreByPlayer: async (matchId: string, userId: string, a: number, b: number) => {
      const m = MATCHES[matchId];
      const d = playerScoreDecision(SESSIONS[m.sessionId].status, m, userId, a, b);
      if (!d.ok) throw new LiveRuleError(d.message, d.status as 403 | 409);
      const kind = d.outcome.kind;
      if (kind === "confirmed") Object.assign(m, { status: "confirmed", confirmedBy: userId });
      else if (kind === "disputed") Object.assign(m, { status: "disputed" });
      else Object.assign(m, { status: "reported", teamAGames: a, teamBGames: b, reportedBy: userId, confirmedBy: null });
      if (kind === "confirmed" && [MATCHES.m1].every((x) => x.sessionId !== "live-1" || matchClosed(x.status))) ROUND.status = "completed";
      return { match: { ...m }, outcome: kind };
    },
  };
  const originals: Record<string, any> = {};
  for (const [name, fn] of Object.entries(fakes)) {
    originals[name] = s[name];
    s[name] = fn;
  }
  restore = () => Object.assign(s, originals);

  const { default: router } = await import("./livePlayer");
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    const id = req.headers["x-test-user-id"];
    req.user = typeof id === "string" ? USERS[id] : undefined;
    req.isAuthenticated = () => !!req.user;
    next();
  });
  app.use("/api/live", router);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/live`;
});

after(() => {
  restore();
  server?.close();
  delete process.env.TC_LIVE_ENABLED;
});

beforeEach(() => {
  resetData();
  process.env.TC_LIVE_ENABLED = "true";
});

async function call(userId: string | null, method: string, path: string, body: unknown = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(userId ? { "x-test-user-id": userId } : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const report = (u: string, a: number, b: number, match = "m1", session = "live-1") =>
  call(u, "POST", `/sessions/${session}/matches/${match}/report`, { teamAGames: a, teamBGames: b });

test("Live off: both player routes are 404, before auth", async () => {
  process.env.TC_LIVE_ENABLED = "false";
  assert.equal((await call("a1", "GET", "/sessions/live-1/me")).status, 404);
  assert.equal((await call(null, "GET", "/sessions/live-1/me")).status, 404);
  assert.equal((await report("a1", 2, 2)).status, 404);
});

test("access: guests 401, not registered (or only waitlisted) 403, unknown session 404", async () => {
  assert.equal((await call(null, "GET", "/sessions/live-1/me")).status, 401);
  assert.equal((await call("x", "GET", "/sessions/live-1/me")).status, 403);
  assert.equal((await call("c1", "GET", "/sessions/live-1/me")).status, 403);
  assert.equal((await call("a1", "GET", "/sessions/nope/me")).status, 404);
});

test("me: my court, my side and my next step", async () => {
  const me = await call("b2", "GET", "/sessions/live-1/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.match.id, "m1");
  assert.equal(me.body.match.mySide, "B");
  assert.equal(me.body.match.action, "enter");
  assert.equal(me.body.round.number, 1);
});

test("IDOR: another session's match id through my session is 404; another session's player gets 403", async () => {
  assert.equal((await report("a1", 6, 3, "m2", "live-1")).status, 404);
  assert.equal((await report("a1", 6, 3, "m2", "live-2")).status, 403);
  assert.equal(MATCHES.m2.status, "playing", "untouched");
});

test("validation: whole games 0-99; 0-0 isn't a result; 2:2 is", async () => {
  assert.equal((await report("a1", 0, 0)).status, 400);
  assert.equal((await report("a1", -1, 2)).status, 400);
  assert.equal((await report("a1", 2.5, 2)).status, 400);
  assert.equal((await report("a1", 2, 2)).status, 200);
});

test("draw 2:2: one side reports, the other confirms 2:2 -> confirmed as a draw, no winner forced, round closes", async () => {
  const first = await report("a1", 2, 2);
  assert.equal(first.body.outcome, "reported");
  assert.equal((await call("a2", "GET", "/sessions/live-1/me")).body.match.action, "waiting", "the partner waits");
  assert.equal((await call("b1", "GET", "/sessions/live-1/me")).body.match.action, "confirm", "the opponents confirm");

  const second = await report("b1", 2, 2);
  assert.equal(second.status, 200);
  assert.equal(second.body.outcome, "confirmed");
  assert.equal(second.body.match.teamAGames, 2);
  assert.equal(second.body.match.teamBGames, 2);
  assert.equal(second.body.match.status, "confirmed");
  assert.equal(ROUND.status, "completed");
  assert.equal((await call("a1", "GET", "/sessions/live-1/me")).body.match.action, "final");
  // Confirmed is the organiser's to change now.
  assert.equal((await report("b2", 3, 2)).status, 409);
});

test("draw disputed: a reported 2:2 answered with 3:2 (and a reported 3:2 answered with 2:2) -> disputed, round stays open", async () => {
  await report("a1", 2, 2);
  const answer = await report("b2", 3, 2);
  assert.equal(answer.body.outcome, "disputed");
  assert.equal(MATCHES.m1.teamAGames, 2, "the first report stays for the organiser to see");
  assert.equal(ROUND.status, "active");
  assert.equal((await report("a2", 2, 2)).status, 409, "only the organiser resolves a dispute");

  resetData();
  await report("b1", 3, 2);
  assert.equal((await report("a2", 2, 2)).body.outcome, "disputed");
});

test("same side again replaces its own report - never confirms itself", async () => {
  await report("a1", 3, 2);
  const again = await report("a2", 2, 2);
  assert.equal(again.body.outcome, "reported");
  assert.equal(MATCHES.m1.teamAGames, 2);
  assert.equal(MATCHES.m1.reportedBy, "a2");
});

test("after Finish players can't report (the organiser's Results are final)", async () => {
  MATCHES.m1.sessionId = "done-1";
  const r = await call("a1", "POST", "/sessions/done-1/matches/m1/report", { teamAGames: 2, teamBGames: 2 });
  assert.equal(r.status, 404, "no current round for a finished session");
});
