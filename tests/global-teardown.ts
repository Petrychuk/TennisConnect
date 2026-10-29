import { currentRunId } from './fixtures/run-id';
import { TEST_HOOK_SECRET_ENV } from './helpers/test-hooks';
import { applyRunCleanup, planRunCleanup, summarisePlan } from './helpers/run-cleanup';

// Runs once after all tests (Stage 3). Reports - and only when explicitly
// enabled, removes - the data THIS run created (E2E_RUN_ID).
//
//   default                       dry run: logs what this run left behind
//   E2E_CLEANUP_ON_TEARDOWN=1     deletes it (the staging-e2e workflow sets
//                                 this; it also repeats cleanup in an
//                                 always-run step in case Playwright crashes)
//
// Skipped silently when the run has no test-hook secret (e.g. the
// read-only and smoke workflows), on Production, or without a run id.
// The server decides what belongs to the run and refuses anything else.

export default async function globalTeardown() {
  const testEnv = (process.env.TEST_ENV ?? 'local').trim().toLowerCase();
  const runId = currentRunId();
  if (testEnv === 'production' || !runId || !process.env[TEST_HOOK_SECRET_ENV]) return;

  try {
    const plan = await planRunCleanup(runId);
    if (plan.users.length === 0) {
      console.log(`[e2e-cleanup] run ${runId}: nothing to clean up`);
      return;
    }
    console.log(`[e2e-cleanup] ${summarisePlan(plan)}`);

    if (process.env.E2E_CLEANUP_ON_TEARDOWN !== '1') {
      console.log(`[e2e-cleanup] dry run only - to remove it: npm run e2e:cleanup-run -- --run-id=${runId} --apply`);
      return;
    }
    if (plan.refusals.length > 0) {
      throw new Error(`cleanup refused for run ${runId}: ${plan.refusals.join('; ')}`);
    }
    const result = await applyRunCleanup(runId);
    console.log(`[e2e-cleanup] run ${runId}: deleted ${result.usersDeleted} user(s), ${result.storage.removed} file(s)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.E2E_CLEANUP_ON_TEARDOWN === '1') throw new Error(`[e2e-cleanup] teardown cleanup failed: ${message}`);
    console.warn(`[e2e-cleanup] teardown dry run failed (ignored): ${message}`);
  }
}
