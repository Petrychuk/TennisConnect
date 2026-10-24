// Stage 3: Staging-only rate-limit exemption for TEMPORARY E2E run accounts.
//
// A full Staging regression run registers ~100 throwaway users and logs in
// many times from one CI runner IP, far beyond the per-IP auth limits
// (login 10 / 15 min, register + forgot-password 20 / 15 min). Those limits
// stay exactly as they are for everyone else. The exemption applies ONLY when
// ALL of these hold:
//
//   1. the server is Staging: DB_ENV is "staging" (trimmed, any case).
//      Production, "unknown", development or a missing DB_ENV never exempt;
//   2. the request body's email is a run-scoped address -
//      e2e-run-<runId>-<label>@tennisconnect.test, matched exactly by
//      classifyEmail() (server/seeds/e2e/identities.ts).
//
// Never exempt: the permanent Stage 2 accounts (e2e-player, e2e-admin, ...
// and e2e-fixture-*), legacy test users, real users, malformed or missing
// emails. Per-account protection is unchanged: the 10-failure account
// lockout still applies to run accounts too.
//
// Run accounts are disposable test users on the reserved .test domain (no
// real mailbox, random passwords, removed by run cleanup), so lifting the
// per-IP cap for them on Staging protects nothing real.
//
// Pure module - unit-tested in server/lib/e2eRateLimit.test.ts.

import { classifyEmail } from "../seeds/e2e/identities";

export interface RateLimitEnvironment {
  dbEnv: string | undefined;
}

export function isStagingServer(config: RateLimitEnvironment): boolean {
  return (config.dbEnv ?? "").trim().toLowerCase() === "staging";
}

/** True only on Staging, only for a run-scoped e2e-run-* address in the body. */
export function isE2ERunRateLimitExempt(config: RateLimitEnvironment, body: unknown): boolean {
  if (!isStagingServer(config)) return false;
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const email = (body as { email?: unknown }).email;
  if (typeof email !== "string" || email.length > 254) return false;
  return classifyEmail(email).kind === "run";
}

/**
 * `skip` option for express-rate-limit. The environment is read on every
 * request (like the test-hook configuration), never cached at startup.
 */
export function e2eRunRateLimitSkip(getConfig: () => RateLimitEnvironment = () => ({ dbEnv: process.env.DB_ENV })) {
  return (req: { body?: unknown }): boolean => isE2ERunRateLimitExempt(getConfig(), req.body);
}
