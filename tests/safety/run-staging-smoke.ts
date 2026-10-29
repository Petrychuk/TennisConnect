// npm run test:e2e:staging:smoke:ci
//
// Runs ONLY the explicit read-only selection in tests/safety/staging-smoke.ts
// against Railway Staging. Refuses anything but TEST_ENV=staging; the
// environment guard (tests/global-setup.ts) then re-verifies BASE_URL and
// /api/health dbEnv=staging, and the deployed commit when
// EXPECTED_DEPLOY_SHA is set. Extra args (e.g. --list) are passed through.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveTarget } from './environment-guard';
import { stagingSmokeArgs } from './staging-smoke';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

try {
  const target = resolveTarget(process.env);
  if (target.testEnv !== 'staging') {
    throw new Error(`run-staging-smoke requires TEST_ENV=staging (got ${target.testEnv}).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const result = spawnSync(process.execPath, [cli, ...stagingSmokeArgs(process.argv.slice(2))], {
  cwd: ROOT,
  stdio: 'inherit',
  // Reviewed smoke selection: no hooks or logins needed (staging-run-config.ts).
  env: { ...process.env, E2E_STAGING_SCOPE: 'smoke' },
});

process.exit(result.status ?? 1);
