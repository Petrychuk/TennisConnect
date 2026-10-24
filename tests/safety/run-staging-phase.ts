// Runs ONE reviewed Stage 3 phase against Staging (tests/safety/staging-phases.ts).
//
//   E2E_PHASE=<phase> E2E_RUN_ID=<id> npm run test:e2e:staging:phase:ci
//   npm run test:e2e:staging:phase:ci -- --phase=mutating-core
//
// Refuses unless TEST_ENV=staging, the phase is reviewed and E2E_RUN_ID is
// already set (the workflow generates it once and passes the same id to
// its always-run cleanup step). Playwright's own guard still verifies the
// target before any test runs.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTarget } from './environment-guard';
import { phaseRunRequirements, stagingPhaseArgs } from './staging-phases';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);

let requirements;
try {
  if (resolveTarget(process.env).testEnv !== 'staging') throw new Error('run-staging-phase requires TEST_ENV=staging');
  requirements = phaseRunRequirements(process.env, argv);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log(`[staging-phase] ${requirements.phase} - run ${requirements.runId}`);
const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const extra = argv.filter(arg => !arg.startsWith('--phase='));
const result = spawnSync(process.execPath, [cli, ...stagingPhaseArgs(requirements.phase, extra)], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, ...requirements.env },
});
process.exit(result.status ?? 1);
