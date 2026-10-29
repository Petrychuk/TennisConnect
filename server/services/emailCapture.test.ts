// npx tsx server/services/emailCapture.test.ts   (or: npm run test:staging-safety)
//
// Staging email interception (server/services/emailCapture.ts) and the
// Stripe test-mode guards (server/lib/stripeMode.ts). Pure functions and an
// in-memory store - no network, no database, nothing is sent.

import assert from "node:assert/strict";
import { CapturedEmailStore, capturedEmails, extractLinks, isAllowlistedRecipient, parseEmailAllowlist, resolveEmailTransport } from "./emailCapture";
import { sendDuplicateRegistrationAlertEmail, sendPasswordResetEmail, sendVerificationEmail } from "./emailService";
import { isLiveEventOutsideProduction, stripeCheckoutBlockedReason, stripeKeyMode } from "../lib/stripeMode";
import { shouldLogResponseBody } from "../lib/responseLogging";

// ---------- Email service harness: fake Resend, captured console ----------

const FAKE_KEY = `re_fake_${Math.random().toString(36).slice(2)}`;
const RESET_TOKEN = `tok_${Math.random().toString(36).slice(2)}`;

async function withEmailEnv(
  env: { DB_ENV?: string; EMAIL_TRANSPORT?: string; STAGING_EMAIL_ALLOWLIST?: string },
  fn: (ctx: { fetchCalls: { url: string; body: string }[]; logs: string[] }) => Promise<void>
) {
  const saved = { ...process.env };
  const savedFetch = globalThis.fetch;
  const savedLog = console.log;
  const savedError = console.error;
  const fetchCalls: { url: string; body: string }[] = [];
  const logs: string[] = [];

  process.env.RESEND_API_KEY = FAKE_KEY;
  process.env.RESEND_FROM_EMAIL = "TennisConnect <no-reply@example.invalid>";
  delete process.env.DB_ENV;
  delete process.env.EMAIL_TRANSPORT;
  delete process.env.STAGING_EMAIL_ALLOWLIST;
  Object.assign(process.env, env);

  globalThis.fetch = (async (url: unknown, init?: { body?: unknown }) => {
    fetchCalls.push({ url: String(url), body: String(init?.body ?? "") });
    return new Response(JSON.stringify({ id: "fake" }), { status: 200 });
  }) as typeof fetch;
  console.log = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
  console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };

  try {
    await fn({ fetchCalls, logs });
  } finally {
    process.env = saved;
    globalThis.fetch = savedFetch;
    console.log = savedLog;
    console.error = savedError;
  }
}

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

  // ---------- Staging allowlist (real team addresses for manual testing) ----------

  const ALLOW = "anna.tester@gmail.com, @tennisconnect.com.au";

  await test("Staging delivers only to allowlisted recipients; everyone else is captured", () => {
    const t = (recipient: string) => resolveEmailTransport({ dbEnv: "staging", configured: undefined, recipient, allowlist: ALLOW });
    assert.equal(t("anna.tester@gmail.com"), "resend");
    assert.equal(t(" Anna.Tester@Gmail.com "), "resend", "case/padding");
    assert.equal(t("ops@tennisconnect.com.au"), "resend", "listed domain");
    for (const other of ["someone@gmail.com", "anna.tester@gmail.co", "x@sub.tennisconnect.com.au", "e2e-player@tennisconnect.test", "anna.tester@gmail.com,real@gmail.com", "", "not-an-email"]) {
      assert.equal(t(other), "capture", other);
    }
    assert.equal(resolveEmailTransport({ dbEnv: "staging", configured: undefined, recipient: "anna.tester@gmail.com" }), "capture", "no allowlist");
  });

  await test("the allowlist can never release automated test addresses", () => {
    const list = "@tennisconnect.test, e2e-admin@tennisconnect.test, @x.tennisconnect.test";
    assert.deepEqual(parseEmailAllowlist(list), { addresses: new Set(), domains: new Set() });
    assert.equal(isAllowlistedRecipient("e2e-admin@tennisconnect.test", list), false);
    assert.equal(resolveEmailTransport({ dbEnv: "staging", configured: undefined, recipient: "e2e-run-x@tennisconnect.test", allowlist: list }), "capture");
  });

  await test("the allowlist applies on Staging only and never overrides EMAIL_TRANSPORT=capture", () => {
    const base = { recipient: "anna.tester@gmail.com", allowlist: ALLOW };
    assert.equal(resolveEmailTransport({ ...base, dbEnv: "staging", configured: "capture" }), "capture");
    assert.equal(resolveEmailTransport({ ...base, dbEnv: "production", configured: undefined }), "resend", "Production unchanged");
    assert.equal(resolveEmailTransport({ ...base, dbEnv: "unknown", configured: "capture" }), "capture");
    assert.equal(resolveEmailTransport({ dbEnv: "staging", configured: undefined, recipient: "someone@gmail.com", allowlist: ALLOW }), "capture");
  });

  await test("malformed allowlist entries are ignored", () => {
    const parsed = parseEmailAllowlist("*, @, gmail.com, @@x.com, a@b, ok@example.org; @good.org");
    assert.deepEqual(Array.from(parsed.addresses), ["ok@example.org"]);
    assert.deepEqual(Array.from(parsed.domains), ["good.org"]);
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

  // ---------- emailService end to end (fake Resend) ----------

  await test("Production delivers through Resend - even with EMAIL_TRANSPORT=capture", async () => {
    for (const configured of [undefined, "capture"]) {
      await withEmailEnv({ DB_ENV: "production", ...(configured ? { EMAIL_TRANSPORT: configured } : {}) }, async ({ fetchCalls }) => {
        const before = capturedEmails.size();
        const result = await sendPasswordResetEmail("someone@example.com", `https://x/reset?token=${RESET_TOKEN}`);
        assert.deepEqual(result, { ok: true });
        assert.equal(fetchCalls.length, 1, String(configured));
        assert.equal(fetchCalls[0].url, "https://api.resend.com/emails");
        assert.equal(capturedEmails.size(), before, "nothing captured on Production");
      });
    }
  });

  await test("Staging never calls Resend: every email (incl. real addresses) is captured", async () => {
    await withEmailEnv({ DB_ENV: "staging" }, async ({ fetchCalls }) => {
      const before = capturedEmails.size();
      assert.deepEqual(await sendVerificationEmail("e2e_x@tennisconnect.test", "https://s/verify-email?token=abc"), { ok: true });
      assert.deepEqual(await sendPasswordResetEmail("real.person@gmail.com", `https://s/reset?token=${RESET_TOKEN}`), { ok: true });
      assert.deepEqual(await sendDuplicateRegistrationAlertEmail("real.person@gmail.com"), { ok: true });
      assert.equal(fetchCalls.length, 0, "Resend must not be called on Staging");
      assert.equal(capturedEmails.size(), before + 3);
      assert.deepEqual(capturedEmails.query({ to: "e2e_x@tennisconnect.test" })[0].links, ["https://s/verify-email?token=abc"]);
    });
  });

  await test("Staging + allowlist: an allowlisted password reset is delivered, others still captured", async () => {
    await withEmailEnv({ DB_ENV: "staging", STAGING_EMAIL_ALLOWLIST: "anna.tester@gmail.com" }, async ({ fetchCalls, logs }) => {
      const before = capturedEmails.size();
      assert.deepEqual(await sendPasswordResetEmail("anna.tester@gmail.com", `https://s/reset?token=${RESET_TOKEN}`), { ok: true });
      assert.equal(fetchCalls.length, 1, "allowlisted recipient goes through Resend");
      assert.equal(JSON.parse(fetchCalls[0].body).to, "anna.tester@gmail.com");
      assert.deepEqual(await sendPasswordResetEmail("real.person@gmail.com", `https://s/reset?token=${RESET_TOKEN}`), { ok: true });
      assert.deepEqual(await sendVerificationEmail("e2e_z@tennisconnect.test", "https://s/verify-email?token=ghi"), { ok: true });
      assert.equal(fetchCalls.length, 1, "nobody else reaches Resend");
      assert.equal(capturedEmails.size(), before + 2);
      const all = logs.join("\n");
      for (const secret of ["anna.tester@gmail.com", "real.person@gmail.com", RESET_TOKEN, FAKE_KEY]) {
        assert.ok(!all.includes(secret), `log leaked ${secret}`);
      }
    });
  });

  await test("capture logs neither recipient, link, token nor API key", async () => {
    await withEmailEnv({ DB_ENV: "staging" }, async ({ logs }) => {
      await sendPasswordResetEmail("real.person@gmail.com", `https://s/reset?token=${RESET_TOKEN}`);
      const all = logs.join("\n");
      assert.ok(logs.some(line => line.includes("captured, not sent")));
      for (const secret of ["real.person@gmail.com", RESET_TOKEN, "https://s/reset", FAKE_KEY]) {
        assert.ok(!all.includes(secret), `log leaked ${secret}`);
      }
    });
  });

  await test("explicit EMAIL_TRANSPORT=resend on Staging delivers (preflight then fails)", async () => {
    await withEmailEnv({ DB_ENV: "staging", EMAIL_TRANSPORT: "resend" }, async ({ fetchCalls }) => {
      await sendVerificationEmail("e2e_y@tennisconnect.test", "https://s/verify-email?token=def");
      assert.equal(fetchCalls.length, 1);
    });
  });

  // ---------- Response-body logging ----------

  await test("test-hook responses are never body-logged; other API bodies unchanged", () => {
    for (const path of ["/api/test-hooks/emails", "/api/test-hooks/issue-verification-token", "/api/test-hooks", "/API/Test-Hooks/emails"]) {
      assert.equal(shouldLogResponseBody(path, false), false, path);
      assert.equal(shouldLogResponseBody(path, true), false, path);
    }
    assert.equal(shouldLogResponseBody("/api/coaches", false), true);
    assert.equal(shouldLogResponseBody("/api/test-hooksX", false), true);
    assert.equal(shouldLogResponseBody("/api/coaches", true), false, "production never body-logs (unchanged)");
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
  if (failed > 0) process.exit(1);
}

main();
