// npx tsx --test server/routes/coaches.test.ts
//
// GET /api/coaches through the REAL router on a loopback HTTP server, with
// `storage.getAllCoachesWithProfiles` faked (no Postgres here). The fake
// returns rows already filtered and ordered the way the real query does
// (published, completed, approved, not hidden; newest first), so this
// checks the route: every coach is listed by default, and search,
// location and price filter the WHOLE directory before it is paged.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";

const LOCATIONS = ["Bondi", "Manly", "Parramatta", "Wolli Creek"];
// 40 coaches, newest first. Every 10th has no number in its rate.
const ROWS = Array.from({ length: 40 }, (_, i) => ({
  user: {
    id: `coach-${i + 1}`,
    slug: `coach-${i + 1}`,
    name: `Coach ${String(i + 1).padStart(2, "0")}`,
    avatar: null,
    cover: null,
    isOrganizer: false,
  },
  profile: {
    location: LOCATIONS[i % 4],
    title: i === 36 ? "Junior Development Specialist" : "Tennis Coach",
    bio: "",
    rate: i % 10 === 9 ? "On request" : `$${60 + (i % 5) * 10}/hr`,
  },
}));

let server: http.Server;
let base = "";
let restore = () => {};

before(async () => {
  const { storage } = await import("../storage");
  const original = (storage as any).getAllCoachesWithProfiles;
  (storage as any).getAllCoachesWithProfiles = async () => ROWS;
  restore = () => ((storage as any).getAllCoachesWithProfiles = original);
  const { default: router } = await import("./coaches");
  const app = express();
  app.use("/api/coaches", router);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  restore();
  server?.close();
});

async function list(query = "") {
  const res = await fetch(`${base}/api/coaches${query}`);
  assert.equal(res.status, 200);
  return (await res.json()) as {
    coaches: { id: string; name: string; location: string; title: string; rate: string | null }[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    locations: string[];
  };
}

test("no filters: every coach, 16 per page, newest first, rate text unchanged", async () => {
  const first = await list("?page=1&limit=16");
  assert.deepEqual(first.pagination, { page: 1, limit: 16, total: 40, totalPages: 3 });
  assert.equal(first.coaches[0].name, "Coach 01");
  assert.equal(first.coaches[0].rate, "$60/hr");
  const ids = new Set<string>();
  for (const page of [1, 2, 3]) for (const c of (await list(`?page=${page}&limit=16`)).coaches) ids.add(c.id);
  assert.equal(ids.size, 40, "every coach appears exactly once across the pages, 'On request' ones included");
  assert.deepEqual(first.locations, LOCATIONS, "location options cover the whole directory");
});

test("search finds a coach that is not on page 1, by name or title", async () => {
  const byName = await list("?q=coach%2037");
  assert.deepEqual(byName.coaches.map((c) => c.name), ["Coach 37"]);
  const byTitle = await list("?q=junior%20development");
  assert.deepEqual(byTitle.coaches.map((c) => c.name), ["Coach 37"]);
  assert.equal((await list("?q=zzz-no-such-coach-zzz")).pagination.total, 0);
});

test("location and price filter the whole directory, then page", async () => {
  const manly = await list("?location=Manly&limit=4");
  assert.equal(manly.pagination.total, 10);
  assert.equal(manly.pagination.totalPages, 3);
  assert.ok(manly.coaches.every((c) => c.location === "Manly"));
  assert.deepEqual(manly.locations, LOCATIONS, "options do not shrink to the filtered result");

  const cheap = await list("?maxRate=70&limit=100");
  assert.ok(cheap.coaches.length > 0);
  for (const c of cheap.coaches) assert.ok(Number(c.rate!.replace(/\D/g, "")) <= 70, `${c.name} ${c.rate}`);
  assert.ok(!cheap.coaches.some((c) => c.rate === "On request"), "a price limit needs a known rate");

  const both = await list("?location=Bondi&maxRate=60&limit=100");
  assert.ok(both.coaches.length > 0);
  assert.ok(both.coaches.every((c) => c.location === "Bondi" && c.rate === "$60/hr"));
});

test("'all', junk values and the slider's top value mean no filter", async () => {
  for (const q of ["?location=all", "?maxRate=abc", "?maxRate=150", "?maxRate=200", "?q="]) {
    assert.equal((await list(q)).pagination.total, 40, q);
  }
});
