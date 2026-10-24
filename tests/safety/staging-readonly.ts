/*
  STAGING READ-ONLY SELECTION (manual workflow: staging-readonly.yml)

  The reviewed read-only Staging tests from the 24 Oct 2026 safety audit
  (docs/CLAUDE_PLAYWRIGHT_RULES.md), minus the 4 already run by the
  staging-smoke job (tests/safety/staging-smoke.ts): 36 - 4 = 32.

  Every entry was re-checked on 24 Oct 2026 (main 265b376):
  - guest-only: no login, no registration, no seeded credentials
    (TEST_USERS is only used for the public `coach-playwright` slug);
  - no form submits, uploads, messages, admin actions or deletes;
  - no Stripe Checkout (SUPPORT-007/008 are deliberately excluded);
  - no outgoing email;
  - no analytics: client/index.html skips gtag.js when
    navigator.webdriver is true, which Playwright always sets.

  Adding an id here is a reviewed decision - it must meet the same rules,
  and tests/safety/staging-readonly.unit.ts checks the basics.
*/

import { STAGING_SMOKE_TEST_IDS } from './staging-smoke';

export interface ReadonlyEntry {
  file: string;
  ids: readonly string[];
}

export const STAGING_READONLY_TESTS: readonly ReadonlyEntry[] = [
  {
    file: 'tests/support/back-the-rally.spec.ts',
    ids: [
      'SUPPORT-001', 'SUPPORT-002', 'SUPPORT-003', 'SUPPORT-004', 'SUPPORT-005',
      'SUPPORT-006', 'SUPPORT-009', 'SUPPORT-010', 'SUPPORT-011', 'SUPPORT-012',
      'SUPPORT-013', 'SUPPORT-014', 'SUPPORT-015', 'SUPPORT-016',
    ],
  },
  { file: 'tests/public/coaches-directory.spec.ts', ids: ['PUBLIC-001', 'PUBLIC-002', 'PUBLIC-003', 'PUBLIC-004'] },
  { file: 'tests/public/players-directory.spec.ts', ids: ['PUBLIC-005', 'PUBLIC-006', 'PUBLIC-007', 'PUBLIC-008'] },
  {
    file: 'tests/prod-safe/prod-safe.spec.ts',
    ids: ['PROD-SAFE-001', 'PROD-SAFE-002', 'PROD-SAFE-003', 'PROD-SAFE-004', 'PROD-SAFE-005'],
  },
  { file: 'tests/smoke/smoke.spec.ts', ids: ['MSG-SMOKE-002'] },
  { file: 'tests/access/guest-access.spec.ts', ids: ['ACCESS-001', 'ACCESS-002'] },
  { file: 'tests/messages/messages.spec.ts', ids: ['MSG-012', 'MSG-013'] },
];

/** Never in this suite, whatever else changes. */
export const STAGING_READONLY_EXCLUDED_IDS: readonly string[] = ['SUPPORT-007', 'SUPPORT-008'];

export const STAGING_READONLY_IDS: readonly string[] = STAGING_READONLY_TESTS.flatMap(entry => entry.ids);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a whole test id in the title (optionally after a tag such as
 * "@smoke " or "@prod-safe "), so PUBLIC-001 can't match PUBLIC-0011.
 */
export function stagingReadonlyGrep(ids: readonly string[] = STAGING_READONLY_IDS): string {
  return `(^|\\s)(${ids.map(escapeRegExp).join('|')})\\s`;
}

/** One worker, no retries, list + HTML report - fixed here, not in the workflow. */
export function stagingReadonlyArgs(extra: readonly string[] = []): string[] {
  return [
    'test',
    ...STAGING_READONLY_TESTS.map(entry => entry.file),
    '--grep', stagingReadonlyGrep(),
    '--workers=1',
    '--retries=0',
    '--reporter=list,html',
    ...extra,
  ];
}

export function overlapWithStagingSmoke(): string[] {
  return STAGING_READONLY_IDS.filter(id => STAGING_SMOKE_TEST_IDS.includes(id));
}
