// npx tsx --test server/routes/organizerBilling.test.ts
//
// /api/organizer/billing on the REAL router with a fake Stripe client and an
// in-memory subscription store (no Postgres, no network, no real Stripe key).
// Webhook payloads are signed with Stripe's own test-header helper, so the
// real signature verification runs.
//
// Covers: flag off (404, nothing created), status per stage, checkout rules
// (approved only, not admins / grandfathered / already subscribed, trial only
// the first time, never a client-supplied price), the portal, and the webhook
// (bad/missing signature, live-mode event outside Production, state sync from
// Stripe, other products ignored, retry on failure, never touches is_organizer).

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";
process.env.STRIPE_SECRET_KEY = "sk_test_fake_for_unit_tests_only";
const WEBHOOK_SECRET = "whsec_test_fake_for_unit_tests_only";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import Stripe from "stripe";
import type { AddressInfo } from "node:net";

const USERS: Record<string, any> = {
  newbie: { id: "newbie", email: "newbie@example.test", name: "Newbie", isOrganizer: true, isAdmin: false },
  pending: { id: "pending", email: "pending@example.test", name: "Pending", isOrganizer: false, isAdmin: false },
  old: { id: "old", email: "old@example.test", name: "Old", isOrganizer: true, isAdmin: false },
  sub: { id: "sub", email: "sub@example.test", name: "Sub", isOrganizer: true, isAdmin: false },
  lapsed: { id: "lapsed", email: "lapsed@example.test", name: "Lapsed", isOrganizer: true, isAdmin: false },
  admin: { id: "admin", email: "admin@example.test", name: "Admin", isOrganizer: false, isAdmin: true },
};

type Row = {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};
let ROWS: Record<string, Row> = {};
let customerCreates: any[] = [];
let checkoutCreates: any[] = [];
let portalCreates: any[] = [];
let upserts: string[] = [];
let stripeSubscriptions: Record<string, any> = {};
let retrieveShouldFail = false;

function row(userId: string, status: string, extra: Partial<Row> = {}): Row {
  return {
    userId,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    status,
    trialEnd: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    ...extra,
  };
}

function resetData() {
  ROWS = {
    old: row("old", "grandfathered"),
    sub: row("sub", "trialing", { stripeCustomerId: "cus_sub", stripeSubscriptionId: "sub_1" }),
    lapsed: row("lapsed", "canceled", { stripeCustomerId: "cus_lapsed", stripeSubscriptionId: "sub_old" }),
  };
  customerCreates = [];
  checkoutCreates = [];
  portalCreates = [];
  upserts = [];
  stripeSubscriptions = {};
  retrieveShouldFail = false;
}

let server: http.Server;
let base = "";
let restoreDeps = () => {};
const signer = new Stripe("sk_test_signer_only");

before(async () => {
  resetData();
  const { default: router, billingDeps } = await import("./organizerBilling");
  const original = { store: billingDeps.store, stripe: billingDeps.stripe };
  billingDeps.store = {
    get: async (id: string) => ROWS[id],
    getByCustomerId: async (cid: string) => Object.values(ROWS).find((r) => r.stripeCustomerId === cid),
    upsert: async (id: string, patch: any) => {
      upserts.push(id);
      ROWS[id] = { ...(ROWS[id] ?? row(id, "none")), ...patch };
      return ROWS[id];
    },
  } as any;
  billingDeps.stripe = {
    customers: { create: async (params: any) => (customerCreates.push(params), { id: `cus_new_${customerCreates.length}` }) },
    checkout: { sessions: { create: async (params: any) => (checkoutCreates.push(params), { id: "cs_test_1", url: "https://checkout.stripe.test/c/pay/cs_test_1" }) } },
    billingPortal: { sessions: { create: async (params: any) => (portalCreates.push(params), { url: "https://billing.stripe.test/p/session_1" }) } },
    subscriptions: {
      retrieve: async (id: string) => {
        if (retrieveShouldFail) throw new Error("stripe is down");
        return stripeSubscriptions[id];
      },
    },
    webhooks: signer.webhooks,
  } as any;
  restoreDeps = () => Object.assign(billingDeps, original);

  const app = express();
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
  app.use((req: any, _res: any, next: any) => {
    const id = req.headers["x-test-user-id"];
    req.user = typeof id === "string" ? USERS[id] : undefined;
    req.isAuthenticated = () => !!req.user;
    next();
  });
  app.use("/api/organizer/billing", router);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/organizer/billing`;
});

after(() => {
  restoreDeps();
  server?.close();
  for (const key of ["ORGANISER_SUBSCRIPTION_ENABLED", "STRIPE_ORGANISER_PRICE_ID", "STRIPE_ORGANISER_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET", "DB_ENV"]) {
    delete process.env[key];
  }
});

beforeEach(() => {
  resetData();
  process.env.ORGANISER_SUBSCRIPTION_ENABLED = "true";
  process.env.STRIPE_ORGANISER_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.STRIPE_ORGANISER_PRICE_ID;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.DB_ENV;
});

async function call(user: string | null, method: string, path: string, body: unknown = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user-id": user } : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function webhook(event: object, opts: { secret?: string | null; headers?: Record<string, string> } = {}) {
  const payload = JSON.stringify(event);
  const signature =
    opts.secret === null ? undefined : signer.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? WEBHOOK_SECRET });
  const res = await fetch(`${base}/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature ? { "stripe-signature": signature } : {}), ...opts.headers },
    body: payload,
  });
  return { status: res.status, text: await res.text() };
}

function subscriptionEvent(type: string, subscriptionId: string, extra: object = {}) {
  return { id: `evt_${type}`, object: "event", type, livemode: false, data: { object: { id: subscriptionId, object: "subscription", ...extra } } };
}

function stripeSub(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    object: "subscription",
    status,
    customer: "cus_new_1",
    metadata: { userId: "newbie", kind: "organiser_subscription" },
    trial_end: 1_900_000_000,
    current_period_end: 1_900_600_000,
    cancel_at_period_end: false,
    ...extra,
  };
}

// ---------- flag off ----------

test("flag OFF: status says disabled, checkout and portal are 404, nothing is created", async () => {
  delete process.env.ORGANISER_SUBSCRIPTION_ENABLED;
  const status = await call("newbie", "GET", "/status");
  assert.equal(status.status, 200);
  assert.deepEqual(status.body, { enabled: false, stage: "disabled", entitled: true });
  assert.equal((await call("newbie", "POST", "/checkout")).status, 404);
  assert.equal((await call("sub", "POST", "/portal")).status, 404);
  assert.deepEqual([customerCreates.length, checkoutCreates.length, portalCreates.length], [0, 0, 0]);
});

test("flag OFF: a not-approved person is not entitled, whatever the flag says", async () => {
  delete process.env.ORGANISER_SUBSCRIPTION_ENABLED;
  assert.equal((await call("pending", "GET", "/status")).body.entitled, false);
});

test("guests get 401 on status, checkout and portal", async () => {
  for (const [method, path] of [["GET", "/status"], ["POST", "/checkout"], ["POST", "/portal"]]) {
    assert.equal((await call(null, method, path)).status, 401, `${method} ${path}`);
  }
});

// ---------- status ----------

test("flag ON: status per stage, with the price", async () => {
  const stage = async (user: string) => (await call(user, "GET", "/status")).body;
  const newbie = await stage("newbie");
  assert.equal(newbie.enabled, true);
  assert.equal(newbie.stage, "subscribe_required");
  assert.equal(newbie.entitled, false);
  assert.deepEqual(newbie.price, { amountCents: 4000, currency: "aud", interval: "month", trialDays: 7 });
  assert.equal((await stage("pending")).stage, "not_approved");
  assert.equal((await stage("old")).stage, "grandfathered");
  assert.equal((await stage("old")).entitled, true);
  const sub = await stage("sub");
  assert.equal(sub.stage, "subscribed");
  assert.equal(sub.status, "trialing");
  assert.equal((await stage("lapsed")).stage, "subscribe_required");
  assert.equal((await stage("admin")).stage, "admin");
  assert.equal((await stage("admin")).entitled, true);
});

// ---------- checkout ----------

test("checkout: an approved organiser gets a subscription Checkout with the 7-day trial and A$40 a month", async () => {
  const res = await call("newbie", "POST", "/checkout");
  assert.equal(res.status, 200);
  assert.equal(res.body.url, "https://checkout.stripe.test/c/pay/cs_test_1");
  assert.equal(customerCreates.length, 1);
  assert.deepEqual(customerCreates[0].metadata, { userId: "newbie" });
  const params = checkoutCreates[0];
  assert.equal(params.mode, "subscription");
  assert.equal(params.client_reference_id, "newbie");
  assert.equal(params.payment_method_collection, "always");
  assert.equal(params.subscription_data.trial_period_days, 7);
  assert.equal(params.subscription_data.metadata.userId, "newbie");
  assert.equal(params.line_items[0].price_data.currency, "aud");
  assert.equal(params.line_items[0].price_data.unit_amount, 4000);
  assert.deepEqual(params.line_items[0].price_data.recurring, { interval: "month" });
  assert.match(params.success_url, /\/organiser\?subscription=success$/);
  assert.match(params.cancel_url, /\/organiser\?subscription=cancelled$/);
  // The new customer is remembered so a second attempt reuses it.
  assert.equal(ROWS.newbie.stripeCustomerId, "cus_new_1");
  assert.equal(ROWS.newbie.status, "none", "checkout creation never makes anyone a subscriber");
});

test("checkout: ignores any price or amount sent by the client", async () => {
  await call("newbie", "POST", "/checkout", { amount: 1, price: "price_cheap", unit_amount: 1, trial_period_days: 365 });
  const params = checkoutCreates[0];
  assert.equal(params.line_items[0].price_data.unit_amount, 4000);
  assert.equal(params.subscription_data.trial_period_days, 7);
});

test("checkout: STRIPE_ORGANISER_PRICE_ID, when set, is used instead of the inline price", async () => {
  process.env.STRIPE_ORGANISER_PRICE_ID = "price_organiser_aud_40";
  await call("newbie", "POST", "/checkout");
  assert.deepEqual(checkoutCreates[0].line_items, [{ price: "price_organiser_aud_40", quantity: 1 }]);
});

test("checkout: someone who already had a subscription gets no second free trial", async () => {
  const res = await call("lapsed", "POST", "/checkout");
  assert.equal(res.status, 200);
  assert.equal("trial_period_days" in checkoutCreates[0].subscription_data, false);
  assert.equal(checkoutCreates[0].customer, "cus_lapsed", "reuses the Stripe customer");
  assert.equal(customerCreates.length, 0);
});

test("checkout: refused for not-approved, admins, grandfathered and already-subscribed - and nothing reaches Stripe", async () => {
  for (const user of ["pending", "admin", "old", "sub"]) {
    const res = await call(user, "POST", "/checkout");
    assert.equal(res.status, 409, user);
    assert.ok(res.body.message);
  }
  assert.deepEqual([customerCreates.length, checkoutCreates.length], [0, 0]);
});

test("checkout: 503 when Stripe is not configured or a LIVE key is on a non-production instance", async () => {
  const key = process.env.STRIPE_SECRET_KEY;
  try {
    delete process.env.STRIPE_SECRET_KEY;
    assert.equal((await call("newbie", "POST", "/checkout")).status, 503);
    process.env.STRIPE_SECRET_KEY = "sk_live_not_a_real_key";
    assert.equal((await call("newbie", "POST", "/checkout")).status, 503);
  } finally {
    process.env.STRIPE_SECRET_KEY = key;
  }
  assert.equal(checkoutCreates.length, 0);
});

// ---------- portal ----------

test("portal: a subscriber gets a billing-portal link (manage / cancel); no customer -> 404", async () => {
  const res = await call("sub", "POST", "/portal");
  assert.equal(res.status, 200);
  assert.equal(res.body.url, "https://billing.stripe.test/p/session_1");
  assert.equal(portalCreates[0].customer, "cus_sub");
  assert.match(portalCreates[0].return_url, /\/organiser$/);
  assert.equal((await call("newbie", "POST", "/portal")).status, 404);
});

// ---------- webhook ----------

test("webhook: missing or wrong signature -> 400 and nothing is stored", async () => {
  stripeSubscriptions.sub_new = stripeSub("sub_new", "trialing");
  const event = subscriptionEvent("customer.subscription.created", "sub_new");
  assert.equal((await webhook(event, { secret: null })).status, 400);
  assert.equal((await webhook(event, { secret: "whsec_someone_else" })).status, 400);
  assert.deepEqual(upserts, []);
});

test("webhook: 503 while no signing secret is configured", async () => {
  delete process.env.STRIPE_ORGANISER_WEBHOOK_SECRET;
  assert.equal((await webhook(subscriptionEvent("customer.subscription.created", "sub_new"))).status, 503);
});

test("webhook: falls back to STRIPE_WEBHOOK_SECRET", async () => {
  delete process.env.STRIPE_ORGANISER_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  stripeSubscriptions.sub_new = stripeSub("sub_new", "trialing");
  assert.equal((await webhook(subscriptionEvent("customer.subscription.created", "sub_new"))).status, 200);
  assert.equal(ROWS.newbie.status, "trialing");
});

test("webhook: a live-mode event is rejected outside Production", async () => {
  stripeSubscriptions.sub_new = stripeSub("sub_new", "active");
  const res = await webhook({ ...subscriptionEvent("customer.subscription.created", "sub_new"), livemode: true });
  assert.equal(res.status, 400);
  assert.deepEqual(upserts, []);
});

test("webhook: subscription.created starts the trial and records the dates", async () => {
  stripeSubscriptions.sub_new = stripeSub("sub_new", "trialing");
  const res = await webhook(subscriptionEvent("customer.subscription.created", "sub_new"));
  assert.equal(res.status, 200);
  assert.deepEqual(ROWS.newbie.status, "trialing");
  assert.equal(ROWS.newbie.stripeSubscriptionId, "sub_new");
  assert.equal(ROWS.newbie.stripeCustomerId, "cus_new_1");
  assert.equal(ROWS.newbie.trialEnd?.getTime(), 1_900_000_000 * 1000);
  assert.equal(ROWS.newbie.currentPeriodEnd?.getTime(), 1_900_600_000 * 1000);
});

test("webhook: the state is read from Stripe, not trusted from the event body", async () => {
  // The event claims "active" but Stripe's current state says past_due.
  stripeSubscriptions.sub_new = stripeSub("sub_new", "past_due");
  await webhook(subscriptionEvent("customer.subscription.updated", "sub_new", { status: "active" }));
  assert.equal(ROWS.newbie.status, "past_due");
});

test("webhook: trial converts to active, then cancel-at-period-end is recorded", async () => {
  stripeSubscriptions.sub_new = stripeSub("sub_new", "active");
  await webhook(subscriptionEvent("customer.subscription.updated", "sub_new"));
  assert.equal(ROWS.newbie.status, "active");
  stripeSubscriptions.sub_new = stripeSub("sub_new", "active", { cancel_at_period_end: true });
  await webhook(subscriptionEvent("customer.subscription.updated", "sub_new"));
  assert.equal(ROWS.newbie.status, "active", "still active until the period ends");
  assert.equal(ROWS.newbie.cancelAtPeriodEnd, true);
});

test("webhook: subscription.deleted ends access", async () => {
  ROWS.sub = row("sub", "active", { stripeCustomerId: "cus_sub", stripeSubscriptionId: "sub_1" });
  stripeSubscriptions.sub_1 = stripeSub("sub_1", "canceled", { customer: "cus_sub", metadata: { userId: "sub" } });
  await webhook(subscriptionEvent("customer.subscription.deleted", "sub_1"));
  assert.equal(ROWS.sub.status, "canceled");
});

test("webhook: checkout.session.completed for an organiser subscription links it", async () => {
  stripeSubscriptions.sub_new = stripeSub("sub_new", "trialing");
  const res = await webhook({
    id: "evt_cs",
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: "cs_test_1", object: "checkout.session", mode: "subscription", subscription: "sub_new", metadata: { userId: "newbie", kind: "organiser_subscription" } } },
  });
  assert.equal(res.status, 200);
  assert.equal(ROWS.newbie.status, "trialing");
});

test("webhook: a one-off Back the Rally checkout or another product's subscription is ignored", async () => {
  await webhook({
    id: "evt_support",
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: "cs_support", object: "checkout.session", mode: "payment", metadata: { tier: "first_serve" } } },
  });
  stripeSubscriptions.sub_other = stripeSub("sub_other", "active", { customer: "cus_unknown", metadata: {} });
  const res = await webhook(subscriptionEvent("customer.subscription.created", "sub_other"));
  assert.equal(res.status, 200, "acknowledged so Stripe stops retrying");
  assert.deepEqual(upserts, []);
});

test("webhook: unrelated event types are acknowledged and ignored", async () => {
  const res = await webhook({ id: "evt_x", object: "event", type: "invoice.paid", livemode: false, data: { object: {} } });
  assert.equal(res.status, 200);
  assert.deepEqual(upserts, []);
});

test("webhook: a Stripe outage while syncing answers 500 so Stripe retries", async () => {
  retrieveShouldFail = true;
  const res = await webhook(subscriptionEvent("customer.subscription.updated", "sub_new"));
  assert.equal(res.status, 500);
  assert.deepEqual(upserts, []);
});

test("webhook: a subscription event never changes organiser approval", async () => {
  // The fake store has no is_organizer at all, and the user object is untouched.
  const before = JSON.stringify(USERS.pending);
  stripeSubscriptions.sub_p = stripeSub("sub_p", "active", { metadata: { userId: "pending" } });
  await webhook(subscriptionEvent("customer.subscription.created", "sub_p"));
  assert.equal(JSON.stringify(USERS.pending), before);
  assert.equal(USERS.pending.isOrganizer, false);
  // ...and because they are not approved, the Hub rule still refuses them
  // (server/routes/organizerSubscriptionGate.test.ts).
  assert.equal((await call("pending", "GET", "/status")).body.entitled, false);
});
