// Operator CLI for the Stage 3 run-scoped cleanup.
//
//   npm run e2e:cleanup-run -- --run-id=<id>                 dry run (default)
//   npm run e2e:cleanup-run -- --run-id=<id> --apply         delete that run's data
//   npm run e2e:cleanup-run -- --run-id=<id> --apply --verify  ...then require 0 left
//   npm run e2e:cleanup-run -- --residue                     list runs that left data
//
// --run-id defaults to E2E_RUN_ID. Needs TEST_ENV=staging (or local),
// BASE_URL and E2E_TEST_HOOK_SECRET. Never a wildcard: one run per call.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTarget } from './environment-guard';
import { loadE2EEnv } from './load-e2e-env';
import { RUN_ID_ENV } from '../fixtures/run-id';
import { postTestHook } from '../helpers/test-hooks';
import { applyRunCleanup, planRunCleanup, summarisePlan } from '../helpers/run-cleanup';

export interface CleanupCliArgs {
  runId: string | undefined;
  apply: boolean;
  verify: boolean;
  residue: boolean;
}

export function parseCleanupArgs(argv: readonly string[], env: Record<string, string | undefined>): CleanupCliArgs {
  const args: CleanupCliArgs = { runId: env[RUN_ID_ENV], apply: false, verify: false, residue: false };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--verify') args.verify = true;
    else if (arg === '--residue') args.residue = true;
    else if (arg.startsWith('--run-id=')) args.runId = arg.slice('--run-id='.length);
    else throw new Error(`unknown argument "${arg}" (allowed: --run-id=<id>, --apply, --verify, --residue)`);
  }
  if (args.verify && !args.apply) throw new Error('--verify only makes sense with --apply');
  if (!args.residue && !args.runId) throw new Error(`--run-id=<id> (or ${RUN_ID_ENV}) is required`);
  return args;
}

async function main() {
  // Same configuration as the other Staging commands (.env.e2e.staging.local; never .env on Staging).
  loadE2EEnv(process.env, { rootDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..') });
  const target = resolveTarget(process.env);
  if (target.testEnv === 'production') throw new Error('run cleanup never runs against Production');
  const args = parseCleanupArgs(process.argv.slice(2), process.env);

  if (args.residue) {
    const { runs } = await postTestHook<{ runs: { runId: string; users: number; oldestCreatedAt: string | null }[] }>('run-residue', {});
    if (runs.length === 0) console.log('[e2e-cleanup] no run left data behind');
    for (const run of runs) console.log(`[e2e-cleanup] ${run.runId}: ${run.users} user(s), oldest ${run.oldestCreatedAt ?? 'unknown'}`);
    return;
  }

  const runId = args.runId!;
  const plan = await planRunCleanup(runId);
  console.log(`[e2e-cleanup] ${summarisePlan(plan)}`);
  if (!args.apply) {
    console.log('[e2e-cleanup] dry run - nothing deleted. Add --apply to delete this run\'s data.');
    return;
  }
  if (plan.refusals.length > 0) throw new Error(`refused: ${plan.refusals.join('; ')}`);
  if (plan.users.length > 0) {
    const result = await applyRunCleanup(runId);
    console.log(`[e2e-cleanup] deleted ${result.usersDeleted} user(s), ${result.storage.removed} file(s)`);
  }
  if (args.verify) {
    const after = await planRunCleanup(runId);
    if (after.users.length > 0 || (after.storageFiles ?? 0) > 0) {
      throw new Error(`verification failed - still left: ${summarisePlan(after)}`);
    }
    console.log(`[e2e-cleanup] verified: run ${runId} left nothing behind`);
  }
}

// Run only as a script (the unit test imports parseCleanupArgs).
if (process.argv[1] && /cleanup-run-cli\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
