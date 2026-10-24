// npx tsx server/services/emailCapture.test.ts   (or: npm run test:staging-safety)
//
// Staging email interception (server/services/emailCapture.ts) and the
// Stripe test-mode guards (server/lib/stripeMode.ts). Pure functions and an
// in-memory store - no network, no database, nothing is sent.

import assert from "node:assert/strict";
import { CapturedEmailStore, extractLinks, resolveEmailTransport } from "./emailCapture";
import { isLiveEventOutsideProduction, stripeCheckoutBlockedReason, stripeKeyMode } from "../lib/stripeMode";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  }
}

async function main() {
  console.log("email capture + Stripe test mode");

  // ---------- Email transport ----------

  await test("Staging captures by default", () => {
    assert.equal(resolveEmailTransport({ dbEnv: "staging", configured: undefined }), "capture");
    assert.equal(resolveEmailTransport({ dbEnv: " Staging ", configured: "" }), "capture");
  });

  await test("Production always delivers - EMAIL_TRANSPORT can't change it", () => {
    for (const configured of [undefined, "", "capture", "resend", "anything"]) {
      assert.equal(resolveEmailTransport({ dbEnv: "production", configured }), "resend", String(configured));
    }
  });

  await test("explicit EMAIL_TRANSPORT applies outside Production", () => {
    assert.equal(resolveEmailTransport({ dbEnv: "staging", configured: "resend" }), "resend");
    assert.equal(resolveEmailTransport({ dbEnv: "unknown", configured: "capture" }), "capture");
    assert.equal(resolveEmailTransport({ dbEnv: "development", configured: "CAPTURE" }), "capture");
  });

  await test("local development keeps today's behaviour (resend) when nothing is set", () => {
    assert.equal(resolveEmailTransport({ dbEnv: "unknown", configured: undefined }), "resend");
    assert.equal(resolveEmailTransport({ dbEnv: undefined, configured: undefined }), "resend");
    assert.equal(resolveEmailTransport({ dbEnv: "staging", configured: "bogus" }), "capture");
  });

  // ---------- Captured email store ----------

  await test("query matches the exact recipient only, case-insensitively, newest first", () => {
    let now = 1_000;
    const store = new CapturedEmailStore(500, 60_000, () => now);
    store.add({ to: "A@tennisconnect.test", subject: "Confirm", text: "first", html: "" });
    now += 10;
    store.add({ to: "a@tennisconnect.test", subject: "Reset", text: "second", html: "" });
    store.add({ to: "aa@tennisconnect.test", subject: "Confirm", text: "other", html: "" });

    const result = store.query({ to: "a@TennisConnect.test" });
    assert.deepEqual(result.map(e => e.text), ["second", "first"]);
    assert.deepEqual(store.query({ to: "a@tennisconnect.test", subjectContains: "conf" }).map(e => e.text), ["first"]);
    assert.deepEqual(store.query({ to: "a@tennisconnect.test", sinceMs: 1_005 }).map(e => e.text), ["second"]);
  });

  await test("store is bounded by count and by age", () => {
    let now = 0;
    const store = new CapturedEmailStore(3, 1_000, () => now);
    for (let i = 0; i < 5; i++) store.add({ to: "x@tennisconnect.test", subject: String(i), text: "", html: "" });
    assert.equal(store.size(), 3);
    assert.deepEqual(store.query({ to: "x@tennisconnect.test" }).map(e => e.subject), ["4", "3", "2"]);
    now = 5_000;
    assert.equal(store.size(), 0);
  });

  await test("query limit is clamped to 1..50", () => {
    const store = new CapturedEmailStore();
    for (let i = 0; i < 60; i++) store.add({ to: "x@tennisconnect.test", subject: "s", text: "", html: "" });
    assert.equal(store.query({ to: "x@tennisconnect.test", limit: 1000 }).length, 50);
    assert.equal(store.query({ to: "x@tennisconnect.test", limit: 0 }).length, 1);
  });

  await test("links are extracted from the text body, de-duplicated", () => {
    assert.deepEqual(
      extractLinks("Open https://s.example/verify-email?token=abc (or https://s.example/verify-email?token=abc)."),
      ["https://s.example/verify-email?token=abc"]
    );
    assert.deepEqual(extractLinks("no links here"), []);
  });

  // ---------- Stripe test mode ----------

  await test("key mode is recognised without ever needing the full key", () => {
    assert.equal(stripeKeyMode(undefined), "unconfigured");
    assert.equal(stripeKeyMode("  "), "unconfigured");
    assert.equal(stripeKeyMode("sk_test_abc"), "test");
    assert.equal(stripeKeyMode("rk_test_abc"), "test");
    assert.equal(stripeKeyMode("sk_live_abc"), "live");
    assert.equal(stripeKeyMode("rk_live_abc"), "live");
    assert.equal(stripeKeyMode("pk_test_abc"), "unknown");
    assert.equal(stripeKeyMode("whatever"), "unknown");
  });

  await test("a live or unrecognised key blocks checkout outside Production", () => {
    assert.match(stripeCheckoutBlockedReason({ dbEnv: "staging", secretKey: "sk_live_abc" }) ?? "", /LIVE/);
    assert.match(stripeCheckoutBlockedReason({ dbEnv: "unknown", secretKey: "rk_live_abc" }) ?? "", /LIVE/);
    assert.match(stripeCheckoutBlockedReason({ dbEnv: "staging", secretKey: "garbage" }) ?? "", /recognised/);
    assert.equal(stripeCheckoutBlockedReason({ dbEnv: "staging", secretKey: "sk_test_abc" }), null);
  });

  await test("Production checkout is unchanged", () => {
    assert.equal(stripeCheckoutBlockedReason({ dbEnv: "production", secretKey: "sk_live_abc" }), null);
    assert.equal(stripeCheckoutBlockedReason({ dbEnv: "production", secretKey: "sk_test_abc" }), null);
  });

  await test("the blocked reason never contains the key", () => {
    const key = ["sk", "live", "SECRETVALUE123"].join("_");
    assert.ok(!(stripeCheckoutBlockedReason({ dbEnv: "staging", secretKey: key }) ?? "").includes("SECRETVALUE123"));
  });

  await test("live-mode webhook events are rejected outside Production only", () => {
    assert.equal(isLiveEventOutsideProduction({ dbEnv: "staging", livemode: true }), true);
    assert.equal(isLiveEventOutsideProduction({ dbEnv: "unknown", livemode: true }), true);
    assert.equal(isLiveEventOutsideProduction({ dbEnv: "staging", livemode: false }), false);
    assert.equal(isLiveEventOutsideProduction({ dbEnv: "production", livemode: true }), false);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    throw new Error(`${failed} test(s) failed`);
  }
}

main();
