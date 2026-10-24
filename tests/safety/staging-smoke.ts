/*
  STAGING SMOKE SELECTION (CI staging-smoke job)

  The @smoke tag is NOT a safety boundary - across tests/ it includes
  registration (REG-001/REG-002), logins and security payloads. CI against
  Railway Staging therefore runs an explicit, reviewed list of test ids,
  not `--grep @smoke`.

  Rules for an entry:
  - Read-only: public pages / guest views only. No registration, no login
    (it needs seeded credentials and writes sessions), no form submits,
    uploads, admin actions or deletes.
  - No dependency on secrets (no TEST_*_PASSWORD, no E2E_TEST_HOOK_SECRET).
  - Must be tagged @smoke in STAGING_SMOKE_FILE.

  Candidates deliberately left out for now:
  - MSG-SMOKE-002: needs the seeded "coach-playwright" profile on Staging.
  - AUTH-SMOKE-001, MSG-SMOKE-003..005: need seeded test credentials.
  They belong in the future authenticated jobs (docs/ci-staging-e2e.md).
*/

export const STAGING_SMOKE_FILE = 'tests/smoke/smoke.spec.ts';

export const STAGING_SMOKE_TEST_IDS: readonly string[] = [
  'HOME-001',
  'PUBLIC-SMOKE-001',
  'PUBLIC-SMOKE-002',
  'MSG-SMOKE-001',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches "@smoke <ID> " exactly, so e.g. HOME-001 can't match HOME-0011. */
export function stagingSmokeGrep(ids: readonly string[] = STAGING_SMOKE_TEST_IDS): string {
  return `@smoke (${ids.map(escapeRegExp).join('|')}) `;
}

export function stagingSmokeArgs(extra: readonly string[] = []): string[] {
  return ['test', STAGING_SMOKE_FILE, '--grep', stagingSmokeGrep(), ...extra];
}
