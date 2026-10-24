// Run ownership (Stage 2 preparation for Stage 3 cleanup).
//
// Every Playwright run gets one unguessable run token in E2E_RUN_ID
// (format from server/seeds/e2e/identities.ts). playwright.config.ts calls
// ensureRunId() in the main process before workers start, so all workers of
// a run inherit the same token. Temporary records a run creates carry it in
// their email (e2e-run-<runId>-<label>@tennisconnect.test), so later cleanup
// can be limited to exactly this run's records - never baseline or fixture
// data, never another run's data, never real users.
//
// Enforced, not just labelled:
//   - on Staging, requireRunOwnedEmail() refuses to produce an address
//     without a valid run token (so a test cannot create unowned users);
//   - postTestHook sends the token as X-E2E-Run-Id, and the Staging server
//     refuses record-creating hooks without it and refuses to act on
//     another run's users (server/lib/testHookSecurity.ts, layer 4).
// Stage 2 never deletes anything; Stage 3 cleanup will use the same token.

import { classifyEmail, generateRunId, isOwnedByRun, isValidRunId, runScopedEmail } from '../../server/seeds/e2e/identities';

export const RUN_ID_ENV = 'E2E_RUN_ID';

/** Returns this run's token, creating it if absent. A malformed preset value is refused. */
export function ensureRunId(env: Record<string, string | undefined> = process.env): string {
  const existing = env[RUN_ID_ENV];
  if (existing !== undefined && existing !== '') {
    if (!isValidRunId(existing)) {
      throw new Error(`${RUN_ID_ENV} is set but malformed - unset it to let the run generate one.`);
    }
    return existing;
  }
  const runId = generateRunId();
  env[RUN_ID_ENV] = runId;
  return runId;
}

/** This run's token, or undefined when none is set (e.g. outside Playwright). */
export function currentRunId(env: Record<string, string | undefined> = process.env): string | undefined {
  const value = env[RUN_ID_ENV];
  return isValidRunId(value) ? value : undefined;
}

/** A run-owned address when a run token is present, otherwise undefined. */
export function runOwnedEmail(label: string, env: Record<string, string | undefined> = process.env): string | undefined {
  const runId = currentRunId(env);
  return runId ? runScopedEmail(runId, label) : undefined;
}

export class RunOwnershipError extends Error {
  constructor(message: string) {
    super(`[e2e-run] ${message}`);
    this.name = 'RunOwnershipError';
  }
}

/**
 * Address for a record a test creates. On Staging a run token is mandatory
 * (refused otherwise); elsewhere returns undefined without one so local
 * runs outside Playwright keep the legacy format.
 */
export function requireRunOwnedEmail(label: string, env: Record<string, string | undefined> = process.env): string | undefined {
  const email = runOwnedEmail(label, env);
  if (!email && (env.TEST_ENV ?? '').trim().toLowerCase() === 'staging') {
    throw new RunOwnershipError(
      `${RUN_ID_ENV} is missing or malformed - records created on Staging must be owned by a run. Run tests through Playwright (playwright.config.ts sets it).`
    );
  }
  return email;
}

/**
 * Guard for destructive tests (admin delete, bulk delete): throws unless
 * every target address belongs to THIS run - never a permanent Stage 2
 * account, another run's user or a real user. Call it right before the
 * delete is confirmed. Without a run token (local, outside Playwright) it
 * still refuses anything that is not a non-permanent @tennisconnect.test
 * test address.
 */
export function expectRunOwned(...emails: string[]): void {
  if (emails.length === 0) throw new RunOwnershipError('expectRunOwned() needs at least one address');
  const runId = currentRunId();
  const staging = (process.env.TEST_ENV ?? '').trim().toLowerCase() === 'staging';
  if (staging && !runId) throw new RunOwnershipError(`${RUN_ID_ENV} is missing - refusing a destructive action on Staging`);
  for (const email of emails) {
    const kind = classifyEmail(email).kind;
    const owned = runId
      ? isOwnedByRun(email, runId)
      : kind !== 'baseline' && kind !== 'fixture' && /^[^\s@]+@tennisconnect\.test$/i.test(email.trim());
    if (!owned) throw new RunOwnershipError(`refusing a destructive action on ${email}: it does not belong to this test run`);
  }
}
