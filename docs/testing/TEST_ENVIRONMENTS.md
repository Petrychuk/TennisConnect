# Test environments

Updated 30 Oct 2026 (branch `feature/organiser-hub-v2`). The single source of truth in code is `tests/safety/environment-guard.ts`; this page explains it.

## Environments and databases

| `TEST_ENV` | `BASE_URL` | Database the server reports (`GET /api/health` → `dbEnv`) | What may run |
|---|---|---|---|
| `local` (default when unset) | loopback only (`http://localhost:3000` by default) | `local`, `development`, `test` or `staging`. A local server usually points at the **Staging database** | Full suite, for development and debugging |
| `staging` | the approved Railway Staging URL, https, never a Production host | `staging` only | Full suite, one reviewed phase at a time (`tests/safety/staging-phases.ts`) |
| `production` | a known Production host (`tennisconnect.com.au`, `www.tennisconnect.com.au`), https | `production` only | Only the `@prod-safe` allowlist (`PROD_SAFE_ALLOWLIST`), 33 tests in `tests/prod-safe/prod-safe.spec.ts` |

Local and Staging can share the Staging database but stay distinguishable by target. Local is always a loopback URL and Staging is always the Railway https URL. Run IDs keep their data apart (see below).

## Safety controls (all fail closed)

| # | Control | Where |
|---|---|---|
| 1 | `TEST_ENV`, `BASE_URL` and the server's own `dbEnv` must agree before any test runs | `resolveTarget()` at config load; `verifyTargetEnvironment()` in `tests/global-setup.ts` |
| 2 | The target is identified by `GET /api/health`; unreachable or `unknown` → refused | `fetchServerEnvironment()`, `assertServerEnvMatches()` |
| 3 | A Production host with `TEST_ENV=local` or `staging` → refused | `resolveTarget()` |
| 4 | A Staging (non-Production) host with `TEST_ENV=production` → refused | `resolveTarget()` |
| 5 | `ALLOW_PROD` is removed; any value refuses the run | `resolveTarget()` |
| 6 | No fallback: a missing Staging URL, password or hook secret stops the run; nothing switches to Production | `loadE2EEnv()`, `e2eCredentials()`, `getTestHookSecret()` |
| 7 | `TEST_ENV=staging` reads only `.env.e2e.staging.local` (allowed keys only), never `.env`. A `.env` that says `TEST_ENV=staging` is refused | `tests/safety/load-e2e-env.ts`, `staging-local-env.ts` |
| 8 | On Production only allowlisted `@prod-safe` tests are listed (`testMatch` + `grep`), and each one re-checks itself at runtime | `productionTestMatch()`, `assertProdSafeTest()`, `tests/fixtures/prod-safe.ts` |
| 9 | Test hooks (seed, verify email, cleanup) are refused **client-side** on Production before anything is sent, so the hook secret never reaches a Production server. The server also answers 404 there | `postTestHook()` (`tests/helpers/test-hooks.ts`, **new 30 Oct**), `server/routes/testHooks.ts` |
| 10 | Run cleanup never runs on Production (teardown, CLI and client) | `tests/global-teardown.ts`, `tests/safety/cleanup-run-cli.ts`, `tests/helpers/run-cleanup.ts` |
| 11 | Baseline `e2e-*` accounts can't be used on Production | `assertE2EAuthAllowed()` |
| 12 | Legacy `TEST_<ROLE>_*` accounts never replace the `e2e-*` accounts unless explicitly opted in on a local run (**new 30 Oct**, see `TEST_USERS.md`) | `resolveTestUser()` in `tests/fixtures/test-users.ts` |

All of these are unit-tested by `npm run test:e2e:guard` (165 tests).

## Configuration and variables (names only)

| Variable | Local | Staging | Production | Notes |
|---|---|---|---|---|
| `TEST_ENV` | optional (`local`) | `staging` | `production` | Set by the npm scripts |
| `BASE_URL` | optional (loopback) | required | required | |
| `E2E_TEST_HOOK_SECRET` | required for hooks | required | **never** | Same value as the target server's. Staging only |
| `E2E_ADMIN_PASSWORD`, `E2E_PLAYER_PASSWORD`, `E2E_PLAYER_2_PASSWORD`, `E2E_COACH_PASSWORD`, `E2E_ORGANISER_PASSWORD` | required | required | never | Baseline accounts (`TEST_USERS.md`) |
| `EXPECTED_DEPLOY_SHA` | — | required for phase runs | optional | `git rev-parse origin/main` |
| `E2E_RUN_ID` | auto | set per run for writing phases | — | Never from a file |
| `E2E_CONFIRM_WRITES`, `E2E_PHASE`, `E2E_STAGING_SCOPE`, `E2E_CLEANUP_ON_TEARDOWN`, `E2E_ENABLE_STRIPE_TESTS` | — | per run | — | Never from a file |
| `E2E_ALLOW_PUBLISH_REVIEW` | optional | optional, per run | — | **New.** Enables ORG-WIZ-004 (see `E2E_COVERAGE_MATRIX.md`) |
| `E2E_LEGACY_LOCAL_ACCOUNTS`, `TEST_ADMIN_*`, `TEST_PLAYER_*`, `TEST_COACH_*` | optional, local only | ignored (refused in the Staging file) | ignored | Legacy, see `TEST_USERS.md` |
| `E2E_PROD_SUITE`, `E2E_CONFIRM_PROD_LIVE_INTERNAL`, `E2E_PROD_LIVE_SESSION_ID`, `E2E_PROD_LIVE_ORGANISER_EMAIL`, `E2E_PROD_LIVE_ORGANISER_PASSWORD`, `E2E_PROD_LIVE_PLAYER_SLUGS` | refused | refused | only for the internal Live suite, per run | TC Live v1, `PRODUCTION_SMOKE_POLICY.md` |
| **Server:** `TC_LIVE_ENABLED`, `TC_INTERNAL_TEST_EMAILS` | as needed | `TC_LIVE_ENABLED=true` for LIVE-* | `false` → `internal` → `true` (each approved) | `docs/live/LIVE_RUNBOOK.md` |
| `E2E_PROD_SUITE`, `E2E_CONFIRM_PROD_LIVE_INTERNAL`, `E2E_PROD_LIVE_SESSION_ID`, `E2E_PROD_LIVE_ORGANISER_EMAIL`, `E2E_PROD_LIVE_ORGANISER_PASSWORD`, `E2E_PROD_LIVE_PLAYER_SLUGS` | refused | refused | only for the internal Live suite, per run | TC Live v1, `PRODUCTION_SMOKE_POLICY.md` |
| **Server:** `TC_LIVE_ENABLED`, `TC_INTERNAL_TEST_EMAILS` | as needed | `TC_LIVE_ENABLED=true` for LIVE-* | `false` → `internal` → `true` (each approved) | `docs/live/LIVE_RUNBOOK.md` |

Configuration files: `.env.e2e.staging.local` (Staging, gitignored, template `.env.e2e.staging.example`); `.env` (local and production runs). Shell variables always win. No value is ever printed: the run log names keys only.

## Safe commands

```powershell
# Guards and unit tests (no network)
npm run test:e2e:guard
npm run test:ui
npm run test:server-unit

# Local app (loopback), e.g. one spec
npm run test:e2e:local -- tests/organiser/organiser-auth.spec.ts

# Staging: check the setup, then one reviewed phase at a time
npm run e2e:staging:check
npm run e2e:staging:auth-readonly
$env:E2E_RUN_ID = "<new run id>"
npm run test:e2e:staging:phase:ci -- --phase=hub-msg-admin --confirm-writes=hub-msg-admin
npm run e2e:cleanup-run -- --run-id=$env:E2E_RUN_ID            # dry run
npm run e2e:cleanup-run -- --run-id=$env:E2E_RUN_ID --apply    # explicit

# Production: only after explicit approval, prod-safe only
npm run test:e2e:prod-safe
```

Reports: `npm run test:e2e:report` (HTML). Every failed test keeps a screenshot, a video and, from 30 Oct, a trace (`trace: 'retain-on-failure'`). Staging runs use 0 retries, so the old `on-first-retry` never recorded one.

## Test data lifecycle

- **Run IDs.** Every run gets one (`E2E_RUN_ID`, `ensureRunId()`). Temporary accounts are `e2e-run-<runId>-…@tennisconnect.test` (`uniqueTestEmail()`); Staging refuses a run without one.
- **Ownership.** Organisations, sessions, seasons, series and templates created by those accounts belong to the run. Seeded players come from `seed-players`, seeded sessions from `seed-session`; both refuse non-test users and data the creator doesn't own.
- **Baseline accounts** (`e2e-*@tennisconnect.test`) are permanent and shared. They're never deleted, and tests must not change their profiles.
- **Cleanup** (`server/services/e2eRunCleanup.ts`) is limited to one run ID, has a dry-run plan and an explicit `--apply`, and refuses the whole run, deleting nothing, if anything outside the run would be affected: a real user's registration, membership or message, rows in another organisation, or files without verified storage isolation. Teardown runs it automatically; `E2E_CLEANUP_ON_TEARDOWN=1` makes a failed cleanup fail the run.
- **Partial failures.** Cleanup keys on the run ID, not on test success, so a failed test's data is still removed.
- **Shared database.** Local and Staging runs get different run IDs, so neither can remove the other's data.
