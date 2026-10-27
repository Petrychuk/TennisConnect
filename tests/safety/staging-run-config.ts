/*
  WHAT A STAGING PLAYWRIGHT RUN NEEDS - checked in tests/global-setup.ts
  before any test starts (no network, names only, never values).

  Scope (E2E_STAGING_SCOPE, set by the runner that started Playwright):
    readonly / smoke   the reviewed CI selections (run-staging-readonly.ts,
                       run-staging-smoke.ts): no test hooks, no logins -
                       nothing extra is required (as before).
    phase:<name>       run-staging-phase.ts: one reviewed phase, already
                       confirmed and preflighted by the runner.
    (unset) = full     anything else, e.g. `npm run test:e2e:staging`:
                       the unphased suite, which also runs data-changing
                       tests - needs this run's explicit confirmation.

  phase and full runs need the test-hook secret, every test-account
  password and the expected deployed commit. Missing configuration used to
  surface as dozens of misleading test failures; now the run is refused
  up front with the list of missing names.
*/

import { EXPECTED_DEPLOY_SHA_ENV } from './deployed-commit';
import { secretProblems } from './staging-check';
import { STAGING_LOCAL_ENV_FILE, STAGING_TEST_ACCOUNT_PASSWORD_KEYS } from './staging-local-env';
import { CONFIRM_WRITES_ENV } from './staging-phases';

export const STAGING_SCOPE_ENV = 'E2E_STAGING_SCOPE';
/** Confirmation value for an unphased Staging run (it includes data-changing tests). */
export const FULL_REGRESSION_CONFIRMATION = 'full-regression';

export type StagingScope = { kind: 'readonly' } | { kind: 'smoke' } | { kind: 'phase'; phase: string } | { kind: 'full' };

export function stagingScope(env: Record<string, string | undefined>): StagingScope {
  const raw = (env[STAGING_SCOPE_ENV] ?? '').trim();
  if (raw === 'readonly' || raw === 'smoke') return { kind: raw };
  if (raw.startsWith('phase:') && raw.length > 'phase:'.length) return { kind: 'phase', phase: raw.slice('phase:'.length) };
  if (raw === '') return { kind: 'full' };
  throw new Error(`${STAGING_SCOPE_ENV}="${raw}" is not a known scope (set only by the Staging runners)`);
}

/** Every problem that would make this Staging run fail for configuration reasons. Empty = OK. */
export function stagingRunProblems(env: Record<string, string | undefined>): string[] {
  const scope = stagingScope(env);
  if (scope.kind === 'readonly' || scope.kind === 'smoke') return [];

  const problems: string[] = [];
  problems.push(...secretProblems(env.E2E_TEST_HOOK_SECRET));
  const missing = STAGING_TEST_ACCOUNT_PASSWORD_KEYS.filter(key => !env[key]?.trim());
  if (missing.length > 0) {
    problems.push(`test-account password(s) not set: ${missing.join(', ')} (add them to ${STAGING_LOCAL_ENV_FILE})`);
  }
  if (!env[EXPECTED_DEPLOY_SHA_ENV]?.trim()) {
    problems.push(`${EXPECTED_DEPLOY_SHA_ENV} is not set - the commit Staging must run (git rev-parse origin/main)`);
  }
  if (scope.kind === 'full' && env[CONFIRM_WRITES_ENV] !== FULL_REGRESSION_CONFIRMATION) {
    problems.push(
      `this is an unphased Staging run, which includes tests that create (run-owned) data. ` +
      `Prefer one reviewed phase (tests/README.md). To run everything anyway, confirm this run: ` +
      `${CONFIRM_WRITES_ENV}=${FULL_REGRESSION_CONFIRMATION} (command line only, never in ${STAGING_LOCAL_ENV_FILE})`
    );
  }
  return problems;
}
