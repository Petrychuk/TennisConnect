import test from "node:test";
import assert from "node:assert/strict";
import { DraftConflictError, createDraftSaver, isStaleDraftError, type SavedRow } from "./sessionDraftSaver";

type Payload = { title: string };
type Row = SavedRow & { title: string };

function fakeApi(opts: { failCreate?: boolean; failUpdate?: (n: number) => Error | null; delay?: boolean } = {}) {
  const calls = { ensure: 0, create: 0, update: [] as { id: string; expectedUpdatedAt: string; title: string }[] };
  let clock = 1_000;
  const wait = () => (opts.delay ? new Promise((r) => setTimeout(r, 10)) : Promise.resolve());
  const api = {
    async ensureOrganization() {
      calls.ensure++;
    },
    async create(p: Payload): Promise<Row> {
      calls.create++;
      await wait();
      if (opts.failCreate) throw new Error("500: boom");
      return { id: "s-1", title: p.title, updatedAt: new Date(clock++).toISOString() };
    },
    async update(id: string, p: Payload & { expectedUpdatedAt: string }): Promise<Row> {
      calls.update.push({ id, expectedUpdatedAt: p.expectedUpdatedAt, title: p.title });
      await wait();
      const err = opts.failUpdate?.(calls.update.length);
      if (err) throw err;
      return { id, title: p.title, updatedAt: new Date(clock++).toISOString() };
    },
  };
  return { api, calls };
}

test("the first save creates exactly one draft; every later save updates that same id", async () => {
  const { api, calls } = fakeApi();
  const saver = createDraftSaver<Payload, Row>(api);
  const modes: string[] = [];
  const first = await saver.save((m) => (modes.push(m), { title: "A" }));
  await saver.save((m) => (modes.push(m), { title: "B" }));
  await saver.save((m) => (modes.push(m), { title: "C" }));
  assert.equal(calls.create, 1);
  assert.equal(calls.ensure, 1);
  assert.deepEqual(modes, ["create", "update", "update"]);
  assert.deepEqual(calls.update.map((u) => u.id), ["s-1", "s-1"]);
  assert.equal(first.id, "s-1");
});

test("each update carries the updatedAt of the previous successful save (stale-write guard)", async () => {
  const { api, calls } = fakeApi();
  const saver = createDraftSaver<Payload, Row>(api);
  const created = await saver.save(() => ({ title: "A" }));
  const updated = await saver.save(() => ({ title: "B" }));
  await saver.save(() => ({ title: "C" }));
  assert.equal(calls.update[0].expectedUpdatedAt, new Date(created.updatedAt).toISOString());
  assert.equal(calls.update[1].expectedUpdatedAt, new Date(updated.updatedAt).toISOString());
});

test("a double click (second save while one is in flight) never creates a second draft", async () => {
  const { api, calls } = fakeApi({ delay: true });
  const saver = createDraftSaver<Payload, Row>(api);
  const [a, b] = await Promise.all([saver.save(() => ({ title: "A" })), saver.save(() => ({ title: "A" }))]);
  assert.equal(calls.create, 1);
  assert.equal(a.id, b.id);
  assert.equal(saver.isSaving(), false);
});

test("a failed first save leaves nothing behind: the next save creates, no id was invented", async () => {
  const failing = fakeApi({ failCreate: true });
  const saver = createDraftSaver<Payload, Row>(failing.api);
  await assert.rejects(() => saver.save(() => ({ title: "A" })), /boom/);
  assert.equal(saver.id(), null);
  assert.equal(saver.updatedAt(), null);
  assert.equal(saver.isSaving(), false);
});

test("a failed update keeps the last good id and updatedAt, and the error reaches the caller", async () => {
  const { api } = fakeApi({ failUpdate: (n) => (n === 1 ? new Error("500: down") : null) });
  const saver = createDraftSaver<Payload, Row>(api);
  const created = await saver.save(() => ({ title: "A" }));
  await assert.rejects(() => saver.save(() => ({ title: "B" })), /down/);
  assert.equal(saver.id(), "s-1");
  assert.equal(saver.updatedAt(), new Date(created.updatedAt).toISOString());
  await saver.save(() => ({ title: "B" })); // retry works and still updates the same row
});

test("a 409 stale answer becomes a DraftConflictError", async () => {
  const stale = new Error('409: {"code":"stale","message":"changed"}');
  const { api } = fakeApi({ failUpdate: () => stale });
  const saver = createDraftSaver<Payload, Row>(api, { id: "s-9", updatedAt: "2026-11-01T00:00:00.000Z" });
  await assert.rejects(() => saver.save(() => ({ title: "x" })), DraftConflictError);
  assert.ok(isStaleDraftError(stale));
  assert.ok(!isStaleDraftError(new Error("409: something else")));
  assert.ok(!isStaleDraftError(new Error('500: {"code":"stale"}')));
});

test("a resumed draft (initial id) only ever updates", async () => {
  const { api, calls } = fakeApi();
  const saver = createDraftSaver<Payload, Row>(api, { id: "s-7", updatedAt: new Date("2026-11-01T00:00:00Z") });
  await saver.save(() => ({ title: "x" }));
  assert.equal(calls.create, 0);
  assert.equal(calls.update[0].id, "s-7");
  assert.equal(calls.update[0].expectedUpdatedAt, "2026-11-01T00:00:00.000Z");
});
