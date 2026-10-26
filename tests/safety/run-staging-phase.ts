// Runs ONE reviewed Stage 3 phase against Staging (tests/safety/staging-phases.ts).
//
//   npm run e2e:staging:auth-readonly                                   (read-only phase)
//   E2E_RUN_ID=<id> npm run test:e2e:staging:phase:ci -- --phase=mutating-core --confirm-writes=mutating-core
//   E2E_PHASE=<phase> E2E_RUN_ID=<id> E2E_CONFIRM_WRITES=<phase> npm run test:e2e:staging:phase:ci   (CI)
//
// Before Playwright starts, in this order - any failure exits 1:
//   1. loads .env.e2e.staging.local (never .env; shell values win);
//   2. TEST_ENV=staging, a reviewed phase, a valid E2E_RUN_ID. For a
//      phase that writes it must be pre-set (the cleanup step needs the same
//      id); the read-only auth phase gets a fresh one if none is given;
//   3. a phase that writes needs this run's explicit confirmation of that
//      exact phase (assertWriteConfirmation);
//   4. the full Staging readiness check (staging-check.ts): approved
//      Staging URL, dbEnv=staging, expected commit, secret, preflight rules.
// Playwright's own guard (tests/global-setup.ts) still verifies the target
// again before any test runs.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureRunId } from '../fixtures/run-id';
import { resolveTarget } from './environment-guard';
import { errorText, runStagingCheck } from './staging-check';
import { STAGING_LOCAL_ENV_FILE, loadStagingLocalEnv } from './staging-local-env';
import { assertWriteConfirmation, phaseRunRequirements, stagingPhaseArgs } from './staging-phases';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);

async function main() {
  const local = loadStagingLocalEnv(process.env, { rootDir: ROOT });

  let requirements;
  try {
    if (local.problems.length > 0) {
      throw new Error(`${STAGING_LOCAL_ENV_FILE} was refused (nothing loaded from it):\n  - ${local.problems.join('\n  - ')}`);
    }
    if (resolveTarget(process.env).testEnv !== 'staging') throw new Error('run-staging-phase requires TEST_ENV=staging');
    const phaseArg = argv.find(arg => arg.startsWith('--phase='))?.slice('--phase='.length) ?? process.env.E2E_PHASE;
    if (phaseArg === 'auth-readonly' && !process.env.E2E_RUN_ID) ensureRunId(process.env);
    requirements = phaseRunRequirements(process.env, argv);
    assertWriteConfirmation(requirements.phase, process.env, argv);
  } catch (error) {
    console.error(`[staging-phase] refused: ${errorText(error)}`);
    process.exit(1);
  }

  const check = await runStagingCheck({
    env: { ...process.env, ...(requirements.phase === 'stripe' ? { E2E_REQUIRE_PAYMENTS: '1' } : {}) },
    rootDir: ROOT,
    localEnv: local,
    log: line => console.log(line),
  });
  if (!check.ok) {
    console.error(`[staging-phase] refused: Staging is not ready - phase ${requirements.phase} was not started.`);
    process.exit(1);
  }

  console.log(`[staging-phase] ${requirements.phase} - run ${requirements.runId}`);
  const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
  const extra = argv.filter(arg => !arg.startsWith('--phase=') && !arg.startsWith('--confirm-writes='));
  const result = spawnSync(process.execPath, [cli, ...stagingPhaseArgs(requirements.phase, extra)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...requirements.env },
  });
  process.exit(result.status ?? 1);
}

main().catch(error => {
  console.error(`[staging-phase] unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
