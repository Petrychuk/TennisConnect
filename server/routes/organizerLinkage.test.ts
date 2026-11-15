// npx tsx --test server/routes/organizerLinkage.test.ts
//
// TC-211 - Organiser Hub audit, Batch 1 (OH-AUDIT-001, OH-AUDIT-002).
//
//  - POST /sessions and PUT /sessions/:id could point a session at ANOTHER
//    organisation's season, ranking series or event (parentSessionId).
//  - DELETE /seasons/:id/sessions/:sessionId and
//    DELETE /series/:id/sessions/:sessionId only checked the season/series:
//    any session id was detached, whoever owned it.
//
// Organisers A (alice, org-a) and B (bob, org-b). Every refused request must
// leave every session row - and its updatedAt - exactly as it was, and the
// storage write methods must not even be called. Legitimate same-organisation
// flows keep working.
//
// The REAL organizer router runs on a loopback server; `storage` is faked (no
// Postgres) with the same scoping the SQL now has, and sign-in is a test
// header - the harness of organizerOwnership.test.ts.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";

const USERS: Record<string, any> = {
  alice: { id: "alice", role: "player", isOrganizer: true, isAdmin: false, name: "Alice", email: "alice@x.test" },
  bob: { id: "bob", role: "player", isOrganizer: true, isAdmin: false, name: "Bob", email: "bob@x.test" },
};
const ORGS: Record<string, any> = {
  "org-a": { id: "org-a", ownerId: "alice" },
  "org-b": { id: "org-b", ownerId: "bob" },
};
const SEASONS: Record<string, any> = {
  "season-a1": { id: "season-a1", organizationId: "org-a", name: "A Summer", startDate: "2026-12-01", endDate: "2027-02-28" },
  "season-a2": { id: "season-a2", organizationId: "org-a", name: "A Autumn", startDate: "2027-03-01", endDate: "2027-05-31" },
  "season-b": { id: "season-b", organizationId: "org-b", name: "B Summer", startDate: "2026-12-01", endDate: "2027-02-28" },
};
const SERIES: Record<string, any> = {
  "series-a1": { id: "series-a1", organizationId: "org-a", seasonId: "season-a1", name: "A Ladder" },
  "series-a2": { id: "series-a2", organizationId: "org-a", seasonId: "season-a2", name: "A Autumn Ladder" },
  "series-b": { id: "series-b", organizationId: "org-b", seasonId: "season-b", name: "B Ladder" },
};

const STAMP = new Date("2026-11-10T09:00:00.000Z");
function freshSessions(): Record<string, any> {
  const base = { status: "draft", type: "social", title: "Social Doubles", startAt: new Date("2026-12-12T08:00:00.000Z"), timeZone: "Australia/Sydney", parentSessionId: null, createdAt: STAMP, updatedAt: STAMP };
  return {
    "a-free": { ...base, id: "a-free", organizationId: "org-a", createdBy: "alice", seasonId: null, seriesId: null },
    "a-ranked": { ...base, id: "a-ranked", organizationId: "org-a", createdBy: "alice", seasonId: "season-a1", seriesId: "series-a1" },
    "a-division": { ...base, id: "a-division", organizationId: "org-a", createdBy: "alice", seasonId: null, seriesId: null, parentSessionId: "a-free" },
    "b-ranked": { ...base, id: "b-ranked", organizationId: "org-b", createdBy: "bob", seasonId: "season-b", seriesId: "series-b" },
    "b-free": { ...base, id: "b-free", organizationId: "org-b", createdBy: "bob", seasonId: null, seriesId: null },
  };
}

let SESSIONS: Record<string, any> = {};
let nextId = 1;
let tick = 0;
const writes: string[] = [];
const defined = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const stamp = () => new Date(Date.parse("2026-11-15T00:00:00Z") + ++tick * 1000);

let server: http.Server;
let base = "";
let restore = () => {};

before(async () => {
  const { storage } = await import("../storage");
  const s = storage as any;
  const fakes: Record<string, (...args: any[]) => any> = {
    getUser: async (id: string) => USERS[id],
    getAdminUsers: async () => [],
    getOrganizationById: async (id: string) => ORGS[id],
    getOrganizationOwnedByUser: async (userId: string) => Object.values(ORGS).find((o: any) => o.ownerId === userId),
    getSeasonById: async (id: string) => SEASONS[id],
    getSeriesById: async (id: string) => SERIES[id],
    getSessionById: async (id: string) => SESSIONS[id],
    getSessionsByOrganization: async (orgId: string) => Object.values(SESSIONS).filter((x: any) => x.organizationId === orgId),
    createSession: async (organizationId: string, createdBy: string, data: any) => {
      writes.push("createSession");
      const id = `new-${nextId++}`;
      const now = stamp();
      return (SESSIONS[id] = { id, organizationId, createdBy, status: "draft", type: "social", seasonId: null, seriesId: null, parentSessionId: null, ...defined(data), createdAt: now, updatedAt: now });
    },
    updateSession: async (id: string, changes: any) => {
      writes.push(`updateSession:${id}`);
      return (SESSIONS[id] = { ...SESSIONS[id], ...defined(changes), updatedAt: stamp() });
    },
    updateSessionIfUnchanged: async (id: string, changes: any, expected: Date) => {
      writes.push(`updateSessionIfUnchanged:${id}`);
      if (new Date(SESSIONS[id].updatedAt).getTime() !== expected.getTime()) return undefined;
      return (SESSIONS[id] = { ...SESSIONS[id], ...defined(changes), updatedAt: stamp() });
    },
    // Same scoping as the SQL in storage.ts: only rows matching every id change.
    addSessionsToSeason: async (seasonId: string, ids: string[], orgId: string) => {
      writes.push(`addSessionsToSeason:${seasonId}:${ids.join(",")}:${orgId}`);
      for (const id of ids) if (SESSIONS[id]?.organizationId === orgId) SESSIONS[id] = { ...SESSIONS[id], seasonId, updatedAt: stamp() };
    },
    removeSessionFromSeason: async (sessionId: string, seasonId: string, orgId: string) => {
      writes.push(`removeSessionFromSeason:${sessionId}:${seasonId}:${orgId}`);
      const row = SESSIONS[sessionId];
      if (!row || row.seasonId !== seasonId || row.organizationId !== orgId) return false;
      SESSIONS[sessionId] = { ...row, seasonId: null, updatedAt: stamp() };
      return true;
    },
    addSessionsToSeries: async (seriesId: string, ids: string[], orgId: string, seasonId: string) => {
      writes.push(`addSessionsToSeries:${seriesId}:${ids.join(",")}:${orgId}:${seasonId}`);
      for (const id of ids) {
        const row = SESSIONS[id];
        if (row?.organizationId === orgId && row.seasonId === seasonId) SESSIONS[id] = { ...row, seriesId, updatedAt: stamp() };
      }
    },
    removeSessionFromSeries: async (sessionId: string, seriesId: string, orgId: string) => {
      writes.push(`removeSessionFromSeries:${sessionId}:${seriesId}:${orgId}`);
      const row = SESSIONS[sessionId];
      if (!row || row.seriesId !== seriesId || row.organizationId !== orgId) return false;
      SESSIONS[sessionId] = { ...row, seriesId: null, updatedAt: stamp() };
      return true;
    },
  };
  const originals: Record<string, any> = {};
  for (const [name, fn] of Object.entries(fakes)) {
    originals[name] = s[name];
    s[name] = fn;
  }
  restore = () => Object.assign(s, originals);

  const { default: router } = await import("./organizer");
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    const id = req.headers["x-test-user-id"];
    req.user = typeof id === "string" ? USERS[id] : undefined;
    req.isAuthenticated = () => !!req.user;
    next();
  });
  app.use("/api/organizer", router);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/organizer`;
});

after(() => {
  restore();
  server?.close();
});

beforeEach(() => {
  SESSIONS = freshSessions();
  nextId = 1;
  writes.length = 0;
});

async function call(user: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not json */
  }
  return { status: res.status, body: json };
}

/** Every session row (and its updatedAt) exactly as seeded, and no write method called. */
function assertNothingChanged(label: string) {
  assert.deepEqual(writes, [], `${label}: no storage write expected`);
  assert.deepEqual(SESSIONS, freshSessions(), `${label}: session rows must be unchanged`);
}

// ---------- OH-AUDIT-001: POST /sessions ----------

test("TC-211-01 organiser A cannot create a session in organiser B's season, series or event", async () => {
  const attempts = [
    { body: { title: "Sneaky", startAt: "2026-12-20T08:00:00Z", seasonId: "season-b" }, status: 404, code: "season_not_found" },
    { body: { title: "Sneaky", startAt: "2026-12-20T08:00:00Z", seasonId: "season-b", seriesId: "series-b" }, status: 404, code: "season_not_found" },
    { body: { title: "Sneaky", startAt: "2026-12-20T08:00:00Z", seasonId: "season-a1", seriesId: "series-b" }, status: 404, code: "series_not_found" },
    { body: { title: "Sneaky", startAt: "2026-12-20T08:00:00Z", parentSessionId: "b-free" }, status: 400, code: "parent_not_editable" },
  ];
  for (const a of attempts) {
    const r = await call("alice", "POST", "/sessions", a.body);
    assert.equal(r.status, a.status, JSON.stringify(a.body));
    assert.equal(r.body?.code, a.code);
  }
  assertNothingChanged("foreign create");
});

test("TC-211-02 an unknown season/series id gets the same answer as a foreign one (no existence probe)", async () => {
  const foreign = await call("alice", "POST", "/sessions", { title: "Probe", startAt: "2026-12-20T08:00:00Z", seasonId: "season-b" });
  const unknown = await call("alice", "POST", "/sessions", { title: "Probe", startAt: "2026-12-20T08:00:00Z", seasonId: "does-not-exist" });
  assert.deepEqual(unknown, foreign);
  const foreignSeries = await call("alice", "PUT", "/sessions/a-ranked", { seriesId: "series-b" });
  const unknownSeries = await call("alice", "PUT", "/sessions/a-ranked", { seriesId: "does-not-exist" });
  assert.deepEqual(unknownSeries, foreignSeries);
  assertNothingChanged("probe");
});

test("TC-211-03 valid create in the organiser's own season (and series of that season) still works", async () => {
  const r1 = await call("alice", "POST", "/sessions", { title: "Summer Social", startAt: "2026-12-20T08:00:00Z", seasonId: "season-a1" });
  assert.equal(r1.status, 201);
  assert.equal(SESSIONS[r1.body.id].seasonId, "season-a1");
  assert.equal(SESSIONS[r1.body.id].organizationId, "org-a");
  const r2 = await call("alice", "POST", "/sessions", { title: "Ladder Night", startAt: "2026-12-21T08:00:00Z", seasonId: "season-a1", seriesId: "series-a1" });
  assert.equal(r2.status, 201);
  assert.equal(SESSIONS[r2.body.id].seriesId, "series-a1");
  const r3 = await call("alice", "POST", "/sessions", { title: "No season", startAt: "2026-12-22T08:00:00Z" });
  assert.equal(r3.status, 201);
  assert.equal(SESSIONS[r3.body.id].seasonId, null);
});

// ---------- OH-AUDIT-001: PUT /sessions/:id ----------

test("TC-211-04 organiser A cannot move their session into B's season, series or event - nothing is written", async () => {
  const attempts: { body: any; status: number; code: string }[] = [
    { body: { seasonId: "season-b" }, status: 404, code: "season_not_found" },
    { body: { seriesId: "series-b" }, status: 404, code: "series_not_found" },
    { body: { seasonId: "season-b", seriesId: "series-b" }, status: 404, code: "season_not_found" },
    { body: { parentSessionId: "b-free" }, status: 400, code: "parent_not_editable" },
    // with the stale-write guard too: refused before the conditional write
    { body: { seasonId: "season-b", expectedUpdatedAt: STAMP.toISOString() }, status: 404, code: "season_not_found" },
  ];
  for (const id of ["a-free", "a-ranked"]) {
    for (const a of attempts) {
      const r = await call("alice", "PUT", `/sessions/${id}`, a.body);
      assert.equal(r.status, a.status, `${id} ${JSON.stringify(a.body)}`);
      assert.equal(r.body?.code, a.code);
    }
  }
  assertNothingChanged("foreign update");
});

test("TC-211-05 mismatched season/series combinations are refused (400) and change nothing", async () => {
  const attempts: [string, any][] = [
    ["a-free", { seriesId: "series-a1" }], // series without a season
    ["a-free", { seasonId: "season-a1", seriesId: "series-a2" }], // series of another season
    ["a-ranked", { seriesId: "series-a2" }], // stored season A1, series of A2
    ["a-ranked", { seasonId: "season-a2" }], // moving season while staying in A1's series
    ["a-ranked", { seasonId: null }], // clearing the season while staying in a series
  ];
  for (const [id, body] of attempts) {
    const r = await call("alice", "PUT", `/sessions/${id}`, body);
    assert.equal(r.status, 400, `${id} ${JSON.stringify(body)}`);
    assert.equal(r.body?.code, "series_season_mismatch");
  }
  const created = await call("alice", "POST", "/sessions", { title: "Mismatch", startAt: "2026-12-20T08:00:00Z", seasonId: "season-a1", seriesId: "series-a2" });
  assert.equal(created.status, 400);
  assert.equal(created.body?.code, "series_season_mismatch");
  assertNothingChanged("mismatch");
});

test("TC-211-06 valid same-organisation updates keep working", async () => {
  // Unrelated edit on a ranked session: no linkage check gets in the way.
  let r = await call("alice", "PUT", "/sessions/a-ranked", { title: "Renamed Ladder Night" });
  assert.equal(r.status, 200);
  assert.equal(SESSIONS["a-ranked"].title, "Renamed Ladder Night");
  // Season + series moved together, consistently.
  r = await call("alice", "PUT", "/sessions/a-ranked", { seasonId: "season-a2", seriesId: "series-a2" });
  assert.equal(r.status, 200);
  assert.equal(SESSIONS["a-ranked"].seasonId, "season-a2");
  assert.equal(SESSIONS["a-ranked"].seriesId, "series-a2");
  // Wizard Season picker on an unranked session, then cleared again (null = clear).
  r = await call("alice", "PUT", "/sessions/a-free", { seasonId: "season-a1" });
  assert.equal(r.status, 200);
  assert.equal(SESSIONS["a-free"].seasonId, "season-a1");
  r = await call("alice", "PUT", "/sessions/a-free", { seasonId: null });
  assert.equal(r.status, 200);
  assert.equal(SESSIONS["a-free"].seasonId, null);
  // A division saved with its own parent echoed back unchanged.
  r = await call("alice", "PUT", "/sessions/a-division", { title: "Men's A", parentSessionId: "a-free" });
  assert.equal(r.status, 200);
  assert.equal(SESSIONS["a-division"].parentSessionId, "a-free");
  // B's rows were never touched.
  assert.deepEqual(SESSIONS["b-ranked"], freshSessions()["b-ranked"]);
  assert.deepEqual(SESSIONS["b-free"], freshSessions()["b-free"]);
});

// ---------- OH-AUDIT-002: detach ----------

test("TC-211-07 organiser A cannot detach organiser B's session from a season - 404, nothing written", async () => {
  // Through A's own season (the IDOR), and through B's season (requireOwnSeason).
  const a = await call("alice", "DELETE", "/seasons/season-a1/sessions/b-ranked");
  assert.equal(a.status, 404);
  const unknown = await call("alice", "DELETE", "/seasons/season-a1/sessions/does-not-exist");
  assert.deepEqual(unknown, a, "foreign and unknown session ids answer the same");
  const b = await call("alice", "DELETE", "/seasons/season-b/sessions/b-ranked");
  assert.equal(b.status, 403);
  assertNothingChanged("foreign season detach");
});

test("TC-211-08 organiser A cannot detach organiser B's session from a series - 404, nothing written", async () => {
  const a = await call("alice", "DELETE", "/series/series-a1/sessions/b-ranked");
  assert.equal(a.status, 404);
  const b = await call("alice", "DELETE", "/series/series-b/sessions/b-ranked");
  assert.equal(b.status, 403);
  assertNothingChanged("foreign series detach");
});

test("TC-211-09 a foreign session even pointing at A's season (legacy data) is not detachable by A", async () => {
  SESSIONS["b-free"] = { ...SESSIONS["b-free"], seasonId: "season-a1", seriesId: "series-a1" };
  const before = structuredClone(SESSIONS["b-free"]);
  assert.equal((await call("alice", "DELETE", "/seasons/season-a1/sessions/b-free")).status, 404);
  assert.equal((await call("alice", "DELETE", "/series/series-a1/sessions/b-free")).status, 404);
  assert.deepEqual(writes, []);
  assert.deepEqual(SESSIONS["b-free"], before);
});

test("TC-211-10 repeated requests can't wear the checks down", async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal((await call("alice", "DELETE", "/seasons/season-a1/sessions/b-ranked")).status, 404);
    assert.equal((await call("alice", "DELETE", "/series/series-a1/sessions/b-ranked")).status, 404);
    assert.equal((await call("alice", "PUT", "/sessions/a-free", { seasonId: "season-b" })).status, 404);
    assert.equal((await call("alice", "POST", "/sessions", { title: "Again", startAt: "2026-12-20T08:00:00Z", seriesId: "series-b" })).status, 404);
    assert.equal((await call("bob", "DELETE", "/seasons/season-b/sessions/a-ranked")).status, 404);
  }
  assertNothingChanged("repeated attempts");
});

test("TC-211-11 legitimate detach still works, scoped by session + season/series + organisation, and repeats are a no-op", async () => {
  let r = await call("alice", "DELETE", "/series/series-a1/sessions/a-ranked");
  assert.equal(r.status, 204);
  assert.equal(SESSIONS["a-ranked"].seriesId, null);
  assert.deepEqual(writes, ["removeSessionFromSeries:a-ranked:series-a1:org-a"]);
  r = await call("alice", "DELETE", "/series/series-a1/sessions/a-ranked");
  assert.equal(r.status, 204, "second Remove is idempotent");
  assert.equal(writes.length, 1, "...and writes nothing");

  r = await call("alice", "DELETE", "/seasons/season-a1/sessions/a-ranked");
  assert.equal(r.status, 204);
  assert.equal(SESSIONS["a-ranked"].seasonId, null);
  assert.equal(writes[1], "removeSessionFromSeason:a-ranked:season-a1:org-a");
  const updatedAt = SESSIONS["a-ranked"].updatedAt;
  r = await call("alice", "DELETE", "/seasons/season-a1/sessions/a-ranked");
  assert.equal(r.status, 204);
  assert.equal(writes.length, 2);
  assert.equal(SESSIONS["a-ranked"].updatedAt, updatedAt);

  // Own session that is in a different season: nothing to detach, nothing written.
  r = await call("alice", "DELETE", "/seasons/season-a2/sessions/a-free");
  assert.equal(r.status, 204);
  assert.equal(writes.length, 2);
});

test("TC-211-12 attach keeps working for own sessions and drops foreign ones, with org/season scoping passed to storage", async () => {
  let r = await call("alice", "POST", "/seasons/season-a1/sessions", { sessionIds: ["a-free", "b-free"] });
  assert.equal(r.status, 204);
  assert.deepEqual(writes, ["addSessionsToSeason:season-a1:a-free:org-a"]);
  assert.equal(SESSIONS["a-free"].seasonId, "season-a1");
  assert.deepEqual(SESSIONS["b-free"], freshSessions()["b-free"]);

  r = await call("alice", "POST", "/series/series-a1/sessions", { sessionIds: ["a-free", "b-ranked", "b-free"] });
  assert.equal(r.status, 204);
  assert.equal(writes[1], "addSessionsToSeries:series-a1:a-free:org-a:season-a1");
  assert.equal(SESSIONS["a-free"].seriesId, "series-a1");
  assert.deepEqual(SESSIONS["b-ranked"], freshSessions()["b-ranked"]);
});
