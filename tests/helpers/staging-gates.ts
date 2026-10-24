import { test } from '@playwright/test';

/*
  Opt-in gates for tests with side effects outside the database.

  Uploads write files to the Supabase project the target server uses. On
  Staging that is only allowed once Staging is verified NOT to share
  Production's storage project (preflight reports the storage host; the
  operator compares it and then sets E2E_STORAGE_ISOLATION_VERIFIED=1).
  Locally the developer's own configuration applies. Production never runs
  these tests at all (environment guard / prod-safe allowlist).

  Stripe tests create Checkout sessions, so they are off everywhere unless
  E2E_ENABLE_STRIPE_TESTS=1 is set explicitly (and the regression preflight
  then also requires Stripe test mode).
*/

export const STORAGE_ISOLATION_ENV = 'E2E_STORAGE_ISOLATION_VERIFIED';
export const STRIPE_TESTS_ENV = 'E2E_ENABLE_STRIPE_TESTS';

type Env = Record<string, string | undefined>;

const targetEnv = (env: Env) => (env.TEST_ENV ?? 'local').trim().toLowerCase();

/** Why upload tests may not run here, or null when they may. */
export function uploadTestsBlockedReason(env: Env = process.env): string | null {
  const target = targetEnv(env);
  if (target === 'production') return 'upload tests never run against Production';
  if (target === 'staging' && env[STORAGE_ISOLATION_ENV] !== '1') {
    return `upload tests are off on Staging until its storage project is verified separate from Production (${STORAGE_ISOLATION_ENV}=1)`;
  }
  return null;
}

/** Why Stripe tests may not run here, or null when they may. */
export function stripeTestsBlockedReason(env: Env = process.env): string | null {
  if (targetEnv(env) === 'production') return 'Stripe tests never run against Production';
  if (env[STRIPE_TESTS_ENV] !== '1') return `Stripe tests are off by default (${STRIPE_TESTS_ENV}=1 to enable)`;
  return null;
}

/** Call first thing in a test that uploads files. */
export function skipUnlessUploadsAllowed() {
  const reason = uploadTestsBlockedReason();
  test.skip(reason !== null, reason ?? '');
}

/** Call first thing in a test that creates Stripe Checkout sessions. */
export function skipUnlessStripeEnabled() {
  const reason = stripeTestsBlockedReason();
  test.skip(reason !== null, reason ?? '');
}
