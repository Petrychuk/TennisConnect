// npx tsx --test server/routes/organizerSubscriptionGate.test.ts
//
// requireOrganizer on the REAL organizer router (loopback server, faked
// storage and subscription store, sign-in by test header): the paid-subscription
// gate behind ORGANISER_SUBSCRIPTION_ENABLED.
//   flag off  -> exactly today's rule (admin approval only)
//   flag on   -> approval AND active/trialing (or grandfathered); admins exempt;
//                payment without approval never opens the Hub.

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
  newbie: { id: "newbie", email: "newbie@example.test", isOrganizer: true, isAdmin: false, name: "Newbie", slug: "newbie" },
  trial: { id: "trial", email: "trial@example.test", isOrganizer: true, isAdmin: false, name: "Trial", slug: "trial" },
  paid: { id: "paid", email: "paid@example.test", isOrganizer: true, isAdmin: false, name: "Paid", slug: "paid" },
  old: { id: "old", email: "old@example.test", isOrganizer: true, isAdmin: false, name: "Old", slug: "old" },
  lapsed: { id: "lapsed", email: "lapsed@example.test", isOrganizer: true, isAdmin: false, name: "Lapsed", slug: "lapsed" },
  payer: { id: "payer", email: "payer@example.test", isOrganizer: false, isAdmin: false, name: "Payer", slug: "payer" },
  admin: { id: "admin", email: "admin@example.test", isOrganizer: false, isAdmin: true, name: "Admin", slug: "admin" },
};
const SUBS: Record<string, string> = {
  trial: "trialing",
  paid: "active",
  old: "grandfathered",
  lapsed: "canceled",
  payer: "active", // paid, but never approved
};
let storeCalls: string[] = [];

let server: http.Server;
let base = "";
let restore = () => {};

before(async () => {
  const { storage } = await import("../storage");
  const { organiserSubscriptionStore } = await import("../lib/organiserSubscriptionStore");
  const s = storage as any;
  const store = organiserSubscriptionStore as any;
  const originals = {
    getOrganizationOwnedByUser: s.getOrganizationOwnedByUser,
    storeGet: store.get,
  };
  s.getOrganizationOwnedByUser = async () => undefined;
  store.get = async (userId: string) => {
    storeCalls.push(userId);
    return SUBS[userId] ? { userId, status: SUBS[userId] } : undefined;
  };
  restore = () => {
    s.getOrganizationOwnedByUser = originals.getOrganizationOwnedByUser;
    store.get = originals.storeGet;
  };

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
  delete process.env.ORGANISER_SUBSCRIPTION_ENABLED;
});

beforeEach(() => {
  delete process.env.ORGANISER_SUBSCRIPTION_ENABLED;
  storeCalls = [];
});

// Any requireOrganizer-guarded route will do.
async function hub(user: string | null) {
  const res = await fetch(`${base}/session-templates`, { headers: user ? { "x-test-user-id": user } : {} });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test("flag OFF: approved organisers get in with no subscription, and the store is never read", async () => {
  for (const user of ["newbie", "trial", "lapsed", "old", "paid"]) {
    assert.equal((await hub(user)).status, 200, user);
  }
  assert.equal((await hub("admin")).status, 200);
  assert.deepEqual(storeCalls, [], "flag off must not touch the subscription table");
});

test("flag OFF: not approved is still 403, payment or not", async () => {
  assert.equal((await hub("payer")).status, 403);
  assert.equal((await hub(null)).status, 401);
});

test("flag ON: approved but never subscribed -> 402 SUBSCRIPTION_REQUIRED", async () => {
  process.env.ORGANISER_SUBSCRIPTION_ENABLED = "true";
  const res = await hub("newbie");
  assert.equal(res.status, 402);
  assert.equal(res.body.code, "SUBSCRIPTION_REQUIRED");
});

test("flag ON: a cancelled/lapsed subscription is 402 too", async () => {
  process.env.ORGANISER_SUBSCRIPTION_ENABLED = "true";
  assert.equal((await hub("lapsed")).status, 402);
});

test("flag ON: trialing, active and grandfathered organisers get in", async () => {
  process.env.ORGANISER_SUBSCRIPTION_ENABLED = "true";
  for (const user of ["trial", "paid", "old"]) {
    assert.equal((await hub(user)).status, 200, user);
  }
});

test("flag ON: payment without admin approval never opens the Hub", async () => {
  process.env.ORGANISER_SUBSCRIPTION_ENABLED = "true";
  assert.equal((await hub("payer")).status, 403);
});

test("flag ON: admins need no subscription and the store is not read for them", async () => {
  process.env.ORGANISER_SUBSCRIPTION_ENABLED = "true";
  assert.equal((await hub("admin")).status, 200);
  assert.ok(!storeCalls.includes("admin"));
});

test("flag ON: guests are still 401", async () => {
  process.env.ORGANISER_SUBSCRIPTION_ENABLED = "true";
  assert.equal((await hub(null)).status, 401);
});

test("GET /features reports the flag", async () => {
  const features = async () => (await (await fetch(`${base}/features`, { headers: { "x-test-user-id": "newbie" } })).json()) as any;
  assert.equal((await features()).subscription, false);
  process.env.ORGANISER_SUBSCRIPTION_ENABLED = "true";
  assert.equal((await features()).subscription, true);
});
