// CI step (staging-smoke job), also usable locally:
//
//   TEST_ENV=staging BASE_URL=https://tennisconnect-staging.up.railway.app \
//   EXPECTED_DEPLOY_SHA=<full sha> npm run e2e:verify-staging-deploy
//
// Waits (default 10 min, DEPLOY_WAIT_MINUTES to change) until Railway
// Staging reports the expected commit on /api/health, then exits 0.
// Any failure exits 1 - tests must not run. See tests/safety/deployed-commit.ts.

import { EXPECTED_DEPLOY_SHA_ENV, waitForDeployedCommit } from './deployed-commit';

async function main() {
  const minutes = Number(process.env.DEPLOY_WAIT_MINUTES ?? '10');
  const timeoutMs = Number.isFinite(minutes) && minutes >= 0 && minutes <= 30 ? minutes * 60_000 : 10 * 60_000;

  const { origin, commit } = await waitForDeployedCommit(process.env, process.env[EXPECTED_DEPLOY_SHA_ENV], {
    timeoutMs,
    log: message => console.log(message),
  });

  console.log(`[deploy-check] OK: ${origin} reports dbEnv=staging and commit ${commit}.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
