// Client for the Stage 3 run-scoped cleanup hook (POST /api/test-hooks/cleanup-run).
// Used by tests/global-teardown.ts and the operator CLI
// (tests/safety/cleanup-run-cli.ts). The server decides what belongs to
// the run and refuses anything else - see server/services/e2eRunCleanup.ts.

import { isValidRunId } from '../../server/seeds/e2e/identities';
import { RUN_ID_ENV } from '../fixtures/run-id';
import { postTestHook } from './test-hooks';

export interface CleanupPlanResponse {
  mode: 'dry-run';
  runId: string;
  users: { id: string; email: string }[];
  organizationIds: string[];
  counts: Record<string, number>;
  refusals: string[];
  storageFiles: number | null;
  /** "disabled" until E2E_STORAGE_CLEANUP=enabled is set on the server. */
  storageCleanup?: 'enabled' | 'disabled';
  storageError?: string;
}

export interface CleanupApplyResponse {
  mode: 'apply';
  usersDeleted: number;
  storage: { removed: number; skipped: boolean };
  organizations: Record<string, number> | null;
}

export class RunCleanupClientError extends Error {
  constructor(message: string) {
    super(`[e2e-cleanup] ${message}`);
    this.name = 'RunCleanupClientError';
  }
}

/** Env for one run: the run id travels as X-E2E-Run-Id (postTestHook reads E2E_RUN_ID). */
function envForRun(runId: string, env: Record<string, string | undefined>) {
  if (!isValidRunId(runId)) throw new RunCleanupClientError(`invalid run id "${runId}"`);
  const target = (env.TEST_ENV ?? 'local').trim().toLowerCase();
  if (target !== 'local' && target !== 'staging') {
    throw new RunCleanupClientError(`run cleanup is for local/staging only (TEST_ENV=${env.TEST_ENV})`);
  }
  return { ...env, [RUN_ID_ENV]: runId };
}

export function planRunCleanup(runId: string, env: Record<string, string | undefined> = process.env) {
  return postTestHook<CleanupPlanResponse>('cleanup-run', {}, envForRun(runId, env));
}

export function applyRunCleanup(runId: string, env: Record<string, string | undefined> = process.env) {
  // Applying deletes a whole run in one transaction - allow longer than a plain hook call.
  return postTestHook<CleanupApplyResponse>('cleanup-run', { apply: true, confirmRunId: runId }, envForRun(runId, env), { timeoutMs: 120_000 });
}

export function summarisePlan(plan: CleanupPlanResponse): string {
  const counts = Object.entries(plan.counts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  return (
    `run ${plan.runId}: ${plan.users.length} user(s), ${plan.organizationIds.length} organisation(s)` +
    (counts ? `, ${counts}` : '') +
    `, files=${plan.storageFiles ?? 'unknown'}` +
    (plan.storageCleanup ? ` (file cleanup ${plan.storageCleanup})` : '') +
    (plan.refusals.length ? ` - REFUSED: ${plan.refusals.join('; ')}` : '')
  );
}
