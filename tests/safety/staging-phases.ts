/*
  STAGING E2E PHASES (Stage 3 - docs/testing/stage3-execution-plan.md)

  Every discovered Playwright test belongs to exactly ONE place:
    - the already-automated read-only sets (staging-readonly.ts + the CI
      staging-smoke selection) - Phase A;
    - one of the phases below - run one at a time by the manual staging
      E2E workflow (docs/testing/drafts/staging-e2e.yml.draft, still a draft);
    - LOCAL_ONLY_TESTS - never run on Staging.
  tests/safety/staging-phases.unit.ts lists every test through Playwright
  and fails on any test that is unclassified, classified twice, or would be
  selected by a phase it is not declared in.

    auth-readonly   signed in as the permanent Stage 2 accounts (cached
                    sessions) or guest-only checks - no writes
    mutating-core   registration, auth, run-owned profiles, security
                    regression - writes only run-owned data
    hub-msg-admin   Organiser Hub, Play, messaging, admin actions on
                    run-owned users
    security-last   failed-login / forgot-password payloads: they use up the
                    per-IP auth budget, so they always run last
    stripe          creates Stripe Checkout sessions - opt-in only

  Upload tests stay listed in their phase but skip themselves on Staging
  until storage isolation is verified (tests/helpers/staging-gates.ts).
  Adding a test here is a reviewed decision.
*/

import { isValidRunId } from '../../server/seeds/e2e/identities';

export interface PhaseEntry {
  file: string;
  ids: readonly string[];
}

export type StagingPhase = 'auth-readonly' | 'mutating-core' | 'hub-msg-admin' | 'security-last' | 'stripe';

export const STAGING_PHASE_ORDER: readonly StagingPhase[] = [
  'auth-readonly',
  'mutating-core',
  'hub-msg-admin',
  'security-last',
  'stripe',
];

export const STAGING_PHASES: Readonly<Record<StagingPhase, readonly PhaseEntry[]>> = {
  'auth-readonly': [
    { file: 'tests/access/admin-access.spec.ts', ids: ['ACCESS-005', 'ACCESS-006'] },
    { file: 'tests/access/guest-access.spec.ts', ids: ['ACCESS-003', 'ACCESS-004'] },
    { file: 'tests/smoke/smoke.spec.ts', ids: ['AUTH-SMOKE-001', 'MSG-SMOKE-003', 'MSG-SMOKE-004', 'MSG-SMOKE-005'] },
    // Guest-only, no writes (reviewed in Stage 3; candidates for the read-only set).
    { file: 'tests/organiser/organiser-auth.spec.ts', ids: ['ORG-AUTH-003'] },
    { file: 'tests/auth/reg-validation.spec.ts', ids: ['REG-003', 'REG-004'] },
    { file: 'tests/auth/forgot-password.spec.ts', ids: ['AUTH-007', 'AUTH-008'] },
    // Coaches directory filters (29 Oct 2026): guest-only, no login, no seeded
    // credentials; only GET /api/coaches (page + page.request) and the cookie
    // banner's localStorage consent. PUBLIC-001..004 in the same file stay in
    // the read-only set (staging-readonly.ts); moving these there is a
    // separate reviewed decision.
    {
      file: 'tests/public/coaches-directory.spec.ts',
      ids: ['PUBLIC-COACH-001', 'PUBLIC-COACH-002', 'PUBLIC-COACH-003', 'PUBLIC-COACH-004', 'PUBLIC-COACH-005'],
    },
    // Production-safe smoke expansion (29 Oct 2026): guest-only and GET-only,
    // enforced by the prod-safe fixture on every environment. PROD-SAFE-001..005
    // stay in the read-only set (staging-readonly.ts).
    {
      file: 'tests/prod-safe/prod-safe.spec.ts',
      ids: Array.from({ length: 28 }, (_, i) => `PROD-SAFE-${String(i + 6).padStart(3, '0')}`),
    },
  ],
  'mutating-core': [
    { file: 'tests/auth/email-case-insensitive.spec.ts', ids: ['AUTH-011', 'AUTH-012', 'AUTH-013'] },
    { file: 'tests/auth/forgot-password.spec.ts', ids: ['AUTH-006'] },
    { file: 'tests/auth/login-coach.spec.ts', ids: ['AUTH-004'] },
    { file: 'tests/auth/login-player.spec.ts', ids: ['AUTH-003', 'AUTH-014'] },
    { file: 'tests/auth/logout.spec.ts', ids: ['AUTH-005'] },
    { file: 'tests/auth/reg-coach.spec.ts', ids: ['REG-002'] },
    { file: 'tests/auth/reg-player.spec.ts', ids: ['REG-001'] },
    { file: 'tests/auth/reg-validation.spec.ts', ids: ['REG-005'] },
    { file: 'tests/profile/coach-complete-and-edit.spec.ts', ids: ['PROFILE-009', 'PROFILE-010', 'PROFILE-011', 'PROFILE-012', 'PROFILE-013'] },
    { file: 'tests/profile/edit-coach-profile.spec.ts', ids: ['PROFILE-004'] },
    { file: 'tests/profile/edit-player-profile.spec.ts', ids: ['PROFILE-003'] },
    { file: 'tests/profile/player-profile-redesign.spec.ts', ids: ['PROFILE-RD-001', 'PROFILE-RD-002', 'PROFILE-RD-003', 'PROFILE-RD-004'] },
    // Upload tests: skip on Staging until storage isolation is verified.
    { file: 'tests/profile/coach-avatar.spec.ts', ids: ['PROFILE-008'] },
    { file: 'tests/profile/coach-cover.spec.ts', ids: ['PROFILE-006'] },
    { file: 'tests/profile/player-avatar.spec.ts', ids: ['PROFILE-007'] },
    { file: 'tests/profile/player-cover.spec.ts', ids: ['PROFILE-005'] },
    { file: 'tests/profile/image-optimization.spec.ts', ids: ['IMG-001', 'IMG-002'] },
    {
      file: 'tests/security/security-regression.spec.ts',
      ids: ['SEC-001', 'SEC-002', 'SEC-002b', 'SEC-003', 'SEC-004', 'SEC-004b', 'SEC-005', 'SEC-006', 'SEC-007', 'SEC-008', 'SEC-009', 'SEC-010', 'SEC-011', 'SEC-012'],
    },
    { file: 'tests/security/security.spec.ts', ids: ['SEC-003', 'SEC-004', 'SEC-005'] },
    { file: 'tests/security/sql-injection.spec.ts', ids: ['SEC-001'] },
    { file: 'tests/security/xss.spec.ts', ids: ['SEC-002'] },
    { file: 'tests/security/security-payloads.spec.ts', ids: ['SEC-NAME'] },
  ],
  'hub-msg-admin': [
    { file: 'tests/organiser/organiser-auth.spec.ts', ids: ['ORG-AUTH-001', 'ORG-AUTH-002'] },
    { file: 'tests/organiser/organiser-critical-flows.spec.ts', ids: ['ORG-FLOW-001', 'ORG-FLOW-003'] },
    { file: 'tests/organiser/organiser-rankings.spec.ts', ids: ['ORG-RANK-002', 'ORG-RANK-004', 'ORG-RANK-006'] },
    { file: 'tests/organiser/organiser-reports.spec.ts', ids: ['ORG-REPORT-003', 'ORG-REPORT-004', 'ORG-REPORT-010', 'ORG-REPORT-012'] },
    { file: 'tests/play/play.spec.ts', ids: ['PLAY-001', 'PLAY-002', 'PLAY-003', 'PLAY-004', 'PLAY-005', 'PLAY-006'] },
    {
      file: 'tests/messages/messages.spec.ts',
      ids: [
        'MSG-001', 'MSG-002', 'MSG-003', 'MSG-003b', 'MSG-004', 'MSG-005', 'MSG-006', 'MSG-007', 'MSG-008',
        'MSG-009', 'MSG-010', 'MSG-011', 'MSG-014', 'MSG-015', 'MSG-016', 'MSG-017', 'MSG-018',
      ],
    },
    {
      file: 'tests/messages/messages-flows.spec.ts',
      ids: [
        'MSG-101', 'MSG-102', 'MSG-103', 'MSG-104', 'MSG-105', 'MSG-106', 'MSG-107', 'MSG-108',
        'MSG-109', 'MSG-110', 'MSG-111', 'MSG-112', 'MSG-113', 'MSG-115', 'MSG-116',
      ],
    },
    { file: 'tests/admin/users/admin-user-approval.spec.ts', ids: ['ADMIN-001'] },
    { file: 'tests/admin/users/admin-unverified-visibility.spec.ts', ids: ['ADMIN-004'] },
    { file: 'tests/admin/users/admin-bulk-delete.spec.ts', ids: ['ADMIN-005', 'ADMIN-006'] },
    { file: 'tests/admin/users/admin-user-delete.spec.ts', ids: ['ADMIN-002', 'ADMIN-003', 'ADMIN-007', 'ADMIN-008'] },
  ],
  'security-last': [{ file: 'tests/security/security-payloads.spec.ts', ids: ['SEC-LOGIN', 'SEC-FORGOT'] }],
  stripe: [{ file: 'tests/support/back-the-rally.spec.ts', ids: ['SUPPORT-007', 'SUPPORT-008'] }],
};

/**
 * Never run on Staging:
 * - ADMIN-009 targets the permanent e2e-admin account;
 * - SEARCH-001..094 (hero search, guest-only and read-only - the Games
 *   smart-search POST is answered in the browser) are new and not yet
 *   reviewed for the Staging read-only set. Moving them there is a
 *   reviewed decision (tests/safety/staging-readonly.ts).
 */
export const HERO_SEARCH_TEST_IDS: readonly string[] = Array.from({ length: 94 }, (_, i) => `SEARCH-${String(i + 1).padStart(3, '0')}`);

export const LOCAL_ONLY_TESTS: readonly PhaseEntry[] = [
  { file: 'tests/admin/users/admin-user-delete.spec.ts', ids: ['ADMIN-009'] },
  { file: 'tests/public/hero-search.spec.ts', ids: HERO_SEARCH_TEST_IDS },
];

export function isStagingPhase(value: unknown): value is StagingPhase {
  return typeof value === 'string' && (STAGING_PHASE_ORDER as readonly string[]).includes(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** First test id in a title (after optional tags), e.g. "@smoke PLAY-001 ..." -> PLAY-001, "SEC-NAME: x" -> SEC-NAME. */
export function testIdOf(title: string): string | undefined {
  return title.match(/(?:^|\s)([A-Z]+(?:-[A-Z]+)*-(?:\d+[a-z]?|NAME|LOGIN|FORGOT))(?=[\s:]|$)/)?.[1];
}

/** Whole-id match, also before ":" (payload tests are titled "SEC-NAME: <payload>"). */
export function phaseGrep(ids: readonly string[]): string {
  return `(^|\\s)(${ids.map(escapeRegExp).join('|')})(\\s|:|$)`;
}

export function phaseFiles(phase: StagingPhase): string[] {
  return Array.from(new Set(STAGING_PHASES[phase].map(entry => entry.file)));
}

export function phaseIds(phase: StagingPhase): string[] {
  return Array.from(new Set(STAGING_PHASES[phase].flatMap(entry => entry.ids)));
}

/** One worker, no retries, traces off (they would hold session cookies). */
export function stagingPhaseArgs(phase: StagingPhase, extra: readonly string[] = []): string[] {
  return [
    'test',
    ...phaseFiles(phase),
    '--grep', phaseGrep(phaseIds(phase)),
    '--workers=1',
    '--retries=0',
    '--trace=off',
    '--reporter=list,html',
    ...extra,
  ];
}

export interface PhaseRunRequirements {
  phase: StagingPhase;
  runId: string;
  /** Environment additions for the Playwright process. */
  env: Record<string, string>;
}

/**
 * Checks a phase run can start: TEST_ENV=staging, a reviewed phase, a
 * valid pre-generated E2E_RUN_ID (shared with the workflow's cleanup step)
 * and the Stripe phase only with E2E_ENABLE_STRIPE_TESTS=1. Every phase that
 * writes cleans up after itself in global teardown.
 */
export function phaseRunRequirements(env: Record<string, string | undefined>, argv: readonly string[]): PhaseRunRequirements {
  if ((env.TEST_ENV ?? '').trim().toLowerCase() !== 'staging') {
    throw new Error(`staging phases need TEST_ENV=staging (got ${env.TEST_ENV ?? 'nothing'})`);
  }
  const phaseArg = argv.find(arg => arg.startsWith('--phase='))?.slice('--phase='.length) ?? env.E2E_PHASE;
  if (!isStagingPhase(phaseArg)) {
    throw new Error(`unknown phase "${phaseArg ?? ''}" (allowed: ${STAGING_PHASE_ORDER.join(', ')})`);
  }
  const runId = env.E2E_RUN_ID;
  if (!isValidRunId(runId)) {
    throw new Error('E2E_RUN_ID must be set to a valid run id before the run (the cleanup step needs the same id)');
  }
  if (phaseArg === 'stripe' && env.E2E_ENABLE_STRIPE_TESTS !== '1') {
    throw new Error('the stripe phase needs E2E_ENABLE_STRIPE_TESTS=1 (and Stripe test mode on Staging)');
  }
  return {
    phase: phaseArg,
    runId,
    env: phaseArg === 'auth-readonly' ? {} : { E2E_CLEANUP_ON_TEARDOWN: '1' },
  };
}

/** Per-run confirmation for phases that write (never read from .env.e2e.staging.local). */
export const CONFIRM_WRITES_ENV = 'E2E_CONFIRM_WRITES';

/**
 * Phases other than auth-readonly create and delete (run-owned) data on
 * Staging. They start only when this run explicitly confirms the exact
 * phase - `--confirm-writes=<phase>` or E2E_CONFIRM_WRITES=<phase> - so a
 * left-over "yes" can't start a different phase. auth-readonly needs none.
 */
export function assertWriteConfirmation(phase: StagingPhase, env: Record<string, string | undefined>, argv: readonly string[]) {
  if (phase === 'auth-readonly') return;
  const confirmed = argv.find(arg => arg.startsWith('--confirm-writes='))?.slice('--confirm-writes='.length) ?? env[CONFIRM_WRITES_ENV];
  if (confirmed !== phase) {
    throw new Error(
      `phase "${phase}" writes test data on Staging - confirm this run explicitly with ` +
      `--confirm-writes=${phase} (or ${CONFIRM_WRITES_ENV}=${phase}). ` +
      (confirmed ? `Got a confirmation for "${confirmed}", which is a different phase.` : 'No confirmation was given.')
    );
  }
}
