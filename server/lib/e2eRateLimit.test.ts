// npx tsx --test server/lib/e2eRateLimit.test.ts   (part of npm run test:cleanup)
//
// Stage 3 Staging-only rate-limit exemption (server/lib/e2eRateLimit.ts):
// the rule itself, the real express-rate-limit middleware driven with it
// (same limits as server/routes.ts), and the wiring in server/routes.ts.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { e2eRunRateLimitSkip, isE2ERunRateLimitExempt, isStagingServer } from "./e2eRateLimit";
import { generateRunId, runScopedEmail } from "../seeds/e2e/identities";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN = generateRunId(1_790_000_000_000, Buffer.from("abcdefabcdefabcd", "hex"));
const RUN_EMAIL = runScopedEmail(RUN, "player-1");
const STAGING = { dbEnv: "staging" };

test("only Staging can exempt", () => {
  for (const dbEnv of ["staging", "Staging", " STAGING "]) assert.equal(isStagingServer({ dbEnv }), true, dbEnv);
  for (const dbEnv of [undefined, "", "production", "Production", "unknown", "development", "local", "staging-ish", "prod"]) {
    assert.equal(isStagingServer({ dbEnv }), false, String(dbEnv));
    assert.equal(isE2ERunRateLimitExempt({ dbEnv }, { email: RUN_EMAIL }), false, `run email on ${String(dbEnv)}`);
  }
});

test("on Staging, only temporary run accounts are exempt", () => {
  assert.equal(isE2ERunRateLimitExempt(STAGING, { email: RUN_EMAIL }), true);
  assert.equal(isE2ERunRateLimitExempt(STAGING, { email: ` ${RUN_EMAIL.toUpperCase()} ` }), true, "case/padding as typed");
  for (const email of [
    "e2e-player@tennisconnect.test",
    "e2e-admin@tennisconnect.test",
    "e2e-organiser@tennisconnect.test",
    "e2e-fixture-coach-03@tennisconnect.test",
    "test_player_1700000000000_abcd1234@tennisconnect.test",
    "seed_player_1_2_3@tennisconnect.test",
    "real.person@gmail.com",
    `${RUN_EMAIL}.evil.com`,
    `x${RUN_EMAIL}`,
    `${RUN_EMAIL},victim@gmail.com`,
    "e2e-run-rabc-0011@tennisconnect.test",
    "",
  ]) {
    assert.equal(isE2ERunRateLimitExempt(STAGING, { email }), false, email);
  }
});

test("missing or malformed bodies are never exempt", () => {
  for (const body of [undefined, null, "string", 42, [], [RUN_EMAIL], {}, { email: 5 }, { email: [RUN_EMAIL] }, { email: "a".repeat(300) }]) {
    assert.equal(isE2ERunRateLimitExempt(STAGING, body), false, JSON.stringify(body));
  }
});

test("skip() reads DB_ENV on every request", () => {
  let dbEnv = "production";
  const skip = e2eRunRateLimitSkip(() => ({ dbEnv }));
  assert.equal(skip({ body: { email: RUN_EMAIL } }), false);
  dbEnv = "staging";
  assert.equal(skip({ body: { email: RUN_EMAIL } }), true);
});

// ---------- The real middleware, same limits as server/routes.ts ----------

async function loadRateLimit(): Promise<((options: Record<string, unknown>) => Function) | null> {
  try {
    const mod: any = await import("express-rate-limit");
    return mod.rateLimit ?? mod.default ?? null;
  } catch {
    return null;
  }
}

async function drive(limiter: Function, requests: { email: unknown; ip?: string }[]) {
  let blocked = 0;
  for (const { email, ip } of requests) {
    const req: any = { ip: ip ?? "203.0.113.7", body: { email }, method: "POST", headers: {}, app: { get: () => 1 } };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, unknown>,
      headersSent: false,
      setHeader(name: string, value: unknown) { this.headers[name] = value; },
      getHeader(name: string) { return this.headers[name]; },
      append() {},
      on() {},
      status(code: number) { this.statusCode = code; return this; },
      send() { this.headersSent = true; return this; },
      json() { this.headersSent = true; return this; },
      end() { this.headersSent = true; },
    };
    const passed = await new Promise<boolean>((resolve, reject) => {
      Promise.resolve(limiter(req, res, (error?: unknown) => (error ? reject(error) : resolve(true)))).then(() => {
        if (res.headersSent) resolve(false);
      }, reject);
    });
    if (!passed) {
      assert.equal(res.statusCode, 429);
      blocked++;
    }
  }
  return blocked;
}

const loginLimiterFor = (rateLimit: (o: Record<string, unknown>) => Function, dbEnv: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10, // server/routes.ts loginLimiter
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Please try again later." },
    skip: e2eRunRateLimitSkip(() => ({ dbEnv })),
    validate: false,
  });

test("real limiter: Staging lets 15 run-account logins through from one IP", async (t) => {
  const rateLimit = await loadRateLimit();
  if (!rateLimit) return t.skip("express-rate-limit not installed here (CI installs it)");
  const blocked = await drive(loginLimiterFor(rateLimit, "staging"), Array.from({ length: 15 }, () => ({ email: RUN_EMAIL })));
  assert.equal(blocked, 0);
});

test("real limiter: baseline accounts on Staging are still blocked after 10", async (t) => {
  const rateLimit = await loadRateLimit();
  if (!rateLimit) return t.skip("express-rate-limit not installed here (CI installs it)");
  const blocked = await drive(loginLimiterFor(rateLimit, "staging"), Array.from({ length: 15 }, () => ({ email: "e2e-admin@tennisconnect.test" })));
  assert.equal(blocked, 5);
});

test("real limiter: Production blocks run accounts after 10 too", async (t) => {
  const rateLimit = await loadRateLimit();
  if (!rateLimit) return t.skip("express-rate-limit not installed here (CI installs it)");
  const blocked = await drive(loginLimiterFor(rateLimit, "production"), Array.from({ length: 15 }, () => ({ email: RUN_EMAIL })));
  assert.equal(blocked, 5);
});

test("real limiter: exempt requests do not use up the budget of other users on the same IP", async (t) => {
  const rateLimit = await loadRateLimit();
  if (!rateLimit) return t.skip("express-rate-limit not installed here (CI installs it)");
  const limiter = loginLimiterFor(rateLimit, "staging");
  assert.equal(await drive(limiter, Array.from({ length: 30 }, () => ({ email: RUN_EMAIL }))), 0);
  assert.equal(await drive(limiter, Array.from({ length: 10 }, () => ({ email: "e2e-player@tennisconnect.test" }))), 0);
  assert.equal(await drive(limiter, [{ email: "e2e-player@tennisconnect.test" }]), 1);
});

// ---------- Wiring in server/routes.ts ----------

test("routes.ts: login and auth-action limiters use the exemption, resend-verification does not", () => {
  const routes = readFileSync(join(HERE, "../routes.ts"), "utf8").replace(/\r\n/g, "\n");
  const block = (name: string) => {
    const start = routes.indexOf(`const ${name} = rateLimit({`);
    assert.ok(start >= 0, `${name} not found`);
    return routes.slice(start, routes.indexOf("});", start));
  };
  assert.match(block("loginLimiter"), /limit: 10,[\s\S]*skip: e2eRunRateLimitSkip\(\),/);
  assert.match(block("authActionLimiter"), /limit: 20,[\s\S]*skip: e2eRunRateLimitSkip\(\),/);
  assert.doesNotMatch(block("resendVerificationLimiter"), /skip/);
  assert.match(routes, /app\.post\("\/api\/auth\/login", loginLimiter,/);
  assert.match(routes, /app\.post\("\/api\/auth\/register", authActionLimiter,/);
});
