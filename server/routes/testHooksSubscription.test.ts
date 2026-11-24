// npx tsx --test server/routes/testHooksSubscription.test.ts
//
// POST /api/test-hooks/organiser-subscription: puts a RUN-OWNED test user's
// Organiser Hub subscription in a known state for E2E tests. Real router, fake
// storage; no database. It must never touch organiser approval, never act on a
// real account or another run's account, and need the hook secret + run id.

import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import { createTestHooksRouter } from "./testHooksRouter";
import { generateRunId, runScopedEmail } from "../seeds/e2e/identities";

const SECRET = `route-${"s".repeat(40)}`;
const RUN = generateRunId();
const OTHER_RUN = generateRunId();

const USERS: Record<string, any> = {
  [runScopedEmail(RUN, "mine")]: { id: "u-mine", email: runScopedEmail(RUN, "mine"), isTestUser: true, isOrganizer: true },
  [runScopedEmail(OTHER_RUN, "theirs")]: { id: "u-theirs", email: runScopedEmail(OTHER_RUN, "theirs"), isTestUser: true },
  "real@example.com": { id: "u-real", email: "real@example.com", isTestUser: false },
};
const MINE = runScopedEmail(RUN, "mine");
const THEIRS = runScopedEmail(OTHER_RUN, "theirs");

let writes: [string, string][] = [];
let server: http.Server;
let base = "";

before(async () => {
  const router = createTestHooksRouter({
    storage: { getUserByEmail: async (email: string) => USERS[email] } as any,
    issueVerificationToken: async () => ({ token: "t", expiresAt: new Date() }),
    hashPassword: async (p: string) => p,
    getConfig: () => ({ nodeEnv: "production", dbEnv: "staging", secret: SECRET }),
    capturedEmails: { query: () => [] } as any,
    getPreflight: () => ({}) as any,
    setOrganiserSubscription: async (userId, status) => {
      writes.push([userId, status]);
    },
  });
  const app = express();
  app.use(express.json());
  app.use("/api/test-hooks", router);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/test-hooks`;
});

after(() => server?.close());
beforeEach(() => {
  writes = [];
});

async function hook(body: unknown, headers: Record<string, string> = { "x-e2e-test-secret": SECRET, "x-e2e-run-id": RUN }) {
  const res = await fetch(`${base}/organiser-subscription`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test("a run-owned test user's subscription is set, and only that", async () => {
  const res = await hook({ email: MINE, status: "trialing" });
  assert.equal(res.status, 200);
  assert.deepEqual(writes, [["u-mine", "trialing"]]);
});

test("every allowed state works; anything else is a 400 (never 'grandfathered')", async () => {
  for (const status of ["none", "trialing", "active", "past_due", "canceled"]) {
    assert.equal((await hook({ email: MINE, status })).status, 200, status);
  }
  writes = [];
  for (const status of ["grandfathered", "admin", "", undefined, 5]) {
    assert.equal((await hook({ email: MINE, status })).status, 400, String(status));
  }
  assert.deepEqual(writes, []);
});

test("a real (non-test) account and another run's account are refused", async () => {
  assert.equal((await hook({ email: "real@example.com", status: "active" })).status, 403);
  assert.equal((await hook({ email: THEIRS, status: "active" })).status, 403);
  assert.deepEqual(writes, []);
});

test("unknown user 404; missing email 400", async () => {
  assert.equal((await hook({ email: runScopedEmail(RUN, "nobody"), status: "active" })).status, 404);
  assert.equal((await hook({ status: "active" })).status, 400);
});

test("needs the secret and, on Staging, the run id", async () => {
  assert.equal((await hook({ email: MINE, status: "active" }, { "x-e2e-run-id": RUN })).status, 401);
  assert.equal((await hook({ email: MINE, status: "active" }, { "x-e2e-test-secret": "wrong-".repeat(10), "x-e2e-run-id": RUN })).status, 401);
  assert.equal((await hook({ email: MINE, status: "active" }, { "x-e2e-test-secret": SECRET })).status, 400);
  assert.deepEqual(writes, []);
});

test("it never changes organiser approval (the user record is untouched)", async () => {
  const before = JSON.stringify(USERS[MINE]);
  await hook({ email: MINE, status: "canceled" });
  assert.equal(JSON.stringify(USERS[MINE]), before);
});
