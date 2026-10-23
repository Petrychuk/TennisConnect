import type { FullConfig } from '@playwright/test';
import {
  VERIFIED_TARGET_ENV_KEY,
  assertProjectsSafe,
  serializeVerifiedTarget,
  verifyTargetEnvironment,
} from './safety/environment-guard';

// Runs once before any test. FAILS CLOSED - every check below must pass
// or the whole run is refused (see tests/safety/environment-guard.ts):
//
// 1. TEST_ENV + BASE_URL are valid and consistent (local = loopback,
//    staging = non-prod https host, production = known prod host). The
//    removed ALLOW_PROD bypass is rejected outright.
//
// 2. The live server is asked which environment it is: GET /api/health
//    must return 200 JSON { dbEnv } (from DB_ENV, see server/env.ts), twice,
//    with the same answer, and that answer must match TEST_ENV. Unreachable,
//    redirecting, non-JSON, "unknown" or mismatching answers all block.
//
// 3. The resolved project config still targets that origin on every
//    project, and on Production is still restricted to the
//    PROD_SAFE_ALLOWLIST and @prod-safe (a CLI --grep is applied on top of
//    the config grep, so it can only narrow the selection, never widen it).
//
// On success the verified target is exported to workers via
// TC_E2E_VERIFIED_TARGET; tests/fixtures/prod-safe.ts requires it on
// Production.
export default async function globalSetup(config: FullConfig) {
  // A marker inherited from a parent shell must never count as verification.
  delete process.env[VERIFIED_TARGET_ENV_KEY];

  const verified = await verifyTargetEnvironment(process.env);

  assertProjectsSafe(config.projects, verified);

  process.env[VERIFIED_TARGET_ENV_KEY] = serializeVerifiedTarget(verified);

  console.log(
    `[e2e-guard] Target verified: TEST_ENV=${verified.testEnv}, ` +
    `${verified.origin} reports dbEnv=${verified.serverEnv}` +
    (verified.testEnv === 'production' ? ' - running PROD-SAFE allowlist only.' : '.')
  );
}
