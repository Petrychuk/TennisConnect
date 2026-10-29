// Full-regression preflight (future staging-full-regression workflow), also
// usable locally:
//
//   TEST_ENV=staging BASE_URL=https://tennisconnect-staging.up.railway.app \
//   EXPECTED_DEPLOY_SHA=<full sha> E2E_TEST_HOOK_SECRET=<from env> \
//   [E2E_REQUIRE_PAYMENTS=1] npm run e2e:verify-staging-preflight
//
// Asks Staging for its environment facts (tests/safety/preflight.ts) and
// exits 1 on any problem. Prints modes only - never secrets.

import { resolveTarget } from './environment-guard';
import { EXPECTED_DEPLOY_SHA_ENV, normaliseExpectedSha } from './deployed-commit';
import { assertPreflight, isPreflightReport } from './preflight';
import { postTestHook } from '../helpers/test-hooks';

async function main() {
  const target = resolveTarget(process.env);
  if (target.testEnv !== 'staging') {
    throw new Error(`preflight is for TEST_ENV=staging only (got ${target.testEnv}).`);
  }

  const expectedSha = normaliseExpectedSha(process.env[EXPECTED_DEPLOY_SHA_ENV]);
  const requirePayments = process.env.E2E_REQUIRE_PAYMENTS === '1';
  const uploads = process.env.E2E_REQUIRE_UPLOADS === '1'
    ? { stagingHost: process.env.STAGING_SUPABASE_HOST, productionHost: process.env.PRODUCTION_SUPABASE_HOST }
    : undefined;

  const report = await postTestHook<unknown>('preflight', {});
  if (!isPreflightReport(report)) {
    throw new Error('preflight: unexpected response shape from the server.');
  }

  assertPreflight(report, { expectedSha, requirePayments, uploads });

  console.log(
    `[preflight] OK: ${target.origin} dbEnv=${report.dbEnv} commit=${report.commit} ` +
    `email=${report.emailTransport} stripe=${report.stripeMode}` +
    (requirePayments ? ' (payment tests enabled)' : '') +
    (uploads ? ` (upload tests enabled, storage=${report.storageHost})` : '')
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
