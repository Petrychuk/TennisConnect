import test from "node:test";
import assert from "node:assert/strict";
import { autoStartIfDue, autoStartScope, runLiveAutoStart, type AutoStartStore } from "./liveAutoStart";

/** In-memory stand-in for storage.autoStartDueSessions: the same conditional change. */
function fakeStore(sessions: Array<{ id: string; status: string; startAt: string; isInternalTest?: boolean }>) {
  const calls: unknown[] = [];
  const store: AutoStartStore = {
    async autoStartDueSessions(opts) {
      calls.push(opts);
      const now = (opts.now ?? new Date()).getTime();
      const ids: string[] = [];
      for (const s of sessions) {
        if (s.status !== "published" || new Date(s.startAt).getTime() > now) continue;
        if (opts.internalOnly && !s.isInternalTest) continue;
        if (opts.sessionId && s.id !== opts.sessionId) continue;
        s.status = "live";
        ids.push(s.id);
      }
      return ids;
    },
  };
  return { store, calls, sessions };
}

const ON = { TC_LIVE_ENABLED: "true" };
const now = new Date("2026-11-20T08:00:00Z");

test("scope follows TC_LIVE_ENABLED: off starts nothing, internal only test sessions", () => {
  assert.equal(autoStartScope({}), null);
  assert.equal(autoStartScope({ TC_LIVE_ENABLED: "false" }), null);
  assert.deepEqual(autoStartScope({ TC_LIVE_ENABLED: "internal" }), { internalOnly: true });
  assert.deepEqual(autoStartScope(ON), { internalOnly: false });
});

test("sweep: due sessions turn live once; a second sweep changes nothing", async () => {
  const { store, sessions } = fakeStore([
    { id: "due", status: "published", startAt: "2026-11-20T08:00:00Z" },
    { id: "later", status: "published", startAt: "2026-11-20T08:00:01Z" },
    { id: "done", status: "completed", startAt: "2026-11-19T08:00:00Z" },
  ]);
  assert.deepEqual(await runLiveAutoStart(store, now, ON), ["due"]);
  assert.deepEqual(await runLiveAutoStart(store, now, ON), []);
  assert.deepEqual(sessions.map((s) => s.status), ["live", "published", "completed"]);
});

test("sweep: Live off -> nothing is touched (the store is not even called)", async () => {
  const { store, calls } = fakeStore([{ id: "due", status: "published", startAt: "2026-11-20T07:00:00Z" }]);
  assert.deepEqual(await runLiveAutoStart(store, now, {}), []);
  assert.equal(calls.length, 0);
});

test("sweep: internal mode passes internalOnly so real sessions stay published", async () => {
  const { store, sessions } = fakeStore([
    { id: "real", status: "published", startAt: "2026-11-20T07:00:00Z" },
    { id: "test", status: "published", startAt: "2026-11-20T07:00:00Z", isInternalTest: true },
  ]);
  assert.deepEqual(await runLiveAutoStart(store, now, { TC_LIVE_ENABLED: "internal" }), ["test"]);
  assert.equal(sessions[0].status, "published");
});

test("on demand: a due session is returned live; not due / not allowed / coaching are left alone", async () => {
  const { store } = fakeStore([{ id: "s1", status: "published", startAt: "2026-11-20T07:59:00Z" }]);
  const due = { id: "s1", status: "published", startAt: "2026-11-20T07:59:00Z", type: "social" };
  assert.equal((await autoStartIfDue(store, due, now, ON)).status, "live");

  const notDue = { id: "s2", status: "published", startAt: "2026-11-20T09:00:00Z", type: "social" };
  assert.equal((await autoStartIfDue(store, notDue, now, ON)).status, "published");

  const coaching = { id: "s3", status: "published", startAt: "2026-11-20T07:00:00Z", type: "coaching-clinic" };
  const c = fakeStore([]);
  assert.equal((await autoStartIfDue(c.store, coaching, now, ON)).status, "published");
  assert.equal(c.calls.length, 0, "never asks the database for a session that can't run in Live");

  const realInInternalMode = { id: "s4", status: "published", startAt: "2026-11-20T07:00:00Z", type: "social", isInternalTest: false };
  const r = fakeStore([]);
  assert.equal((await autoStartIfDue(r.store, realInInternalMode, now, { TC_LIVE_ENABLED: "internal" })).status, "published");
  assert.equal(r.calls.length, 0);
});

test("on demand: losing the race to another instance leaves the caller's copy unchanged, never throws", async () => {
  const store: AutoStartStore = { autoStartDueSessions: async () => [] };
  const s = { id: "s1", status: "published", startAt: "2026-11-20T07:00:00Z", type: "social" };
  assert.equal((await autoStartIfDue(store, s, now, ON)).status, "published");
});
