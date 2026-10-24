import type { FullConfig } from '@playwright/test';
import {
  EnvironmentGuardError,
  VERIFIED_TARGET_ENV_KEY,
  type FetchLike,
  assertProjectsSafe,
  serializeVerifiedTarget,
  verifyTargetEnvironment,
} from './safety/environment-guard';
import {
  EXPECTED_DEPLOY_SHA_ENV,
  assertDeployedCommit,
  normaliseExpectedSha,
  readHealth,
} from './safety/deployed-commit';

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
// 4. Optional: when EXPECTED_DEPLOY_SHA is set (CI staging-smoke sets it),
//    the server must also report exactly that commit on /api/health
//    (tests/safety/deployed-commit.ts). Staging only.
//
// On success the verified target is exported to workers via
// TC_E2E_VERIFIED_TARGET; tests/fixtures/prod-safe.ts requires it on
// Production.
export default async function globalSetup(config: FullConfig) {
  // A marker inherited from a parent shell must never count as verification.
  delete process.env[VERIFIED_TARGET_ENV_KEY];

  const verified = await verifyTargetEnvironment(process.env);

  assertProjectsSafe(config.projects, verified);

  const expectedSha = process.env[EXPECTED_DEPLOY_SHA_ENV];
  if (expectedSha) {
    if (verified.testEnv !== 'staging') {
      throw new EnvironmentGuardError(
        `${EXPECTED_DEPLOY_SHA_ENV} is only supported with TEST_ENV=staging (got ${verified.testEnv}).`
      );
    }
    const snapshot = await readHealth(verified.origin, globalThis.fetch as unknown as FetchLike);
    assertDeployedCommit(snapshot, normaliseExpectedSha(expectedSha), verified.origin);
    console.log(`[e2e-guard] Deployed commit verified: ${snapshot.commit}`);
  }

  process.env[VERIFIED_TARGET_ENV_KEY] = serializeVerifiedTarget(verified);

  console.log(
    `[e2e-guard] Target verified: TEST_ENV=${verified.testEnv}, ` +
    `${verified.origin} reports dbEnv=${verified.serverEnv}` +
    (verified.testEnv === 'production' ? ' - running PROD-SAFE allowlist only.' : '.')
  );
}
