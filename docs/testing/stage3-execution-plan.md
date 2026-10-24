# Stage 3 — Staging E2E execution preparation

**Status:** audit and proposal for review. No code changed, nothing seeded, run, committed or deployed.
**Audited:** `main` at `86de95c` (PR #5 merged). Full per-test table: `stage3-test-inventory.csv`.

---

## 1. Test inventory and safety classification (192 tests, 44 files)

| Category | Tests | Phase |
|---|---|---|
| **1. Read-only, safe now** — already automated (32 read-only workflow + 4 smoke) | 36 | A |
| **1. Read-only, add after review** — ORG-AUTH-003, REG-003, REG-004, AUTH-007, AUTH-008 | 5 | A |
| **2. Needs seeded accounts**, no writes after login — ACCESS-003…006, AUTH-SMOKE-001, MSG-SMOKE-003…005 | 8 | D |
| **3. Modifies data, needs run-scoped cleanup** | 87 | D / E |
| **4. Unsafe or blocked** until fixed | 56 | — |

**Category 3 by area:**
- Messaging: 31
- Auth and registration: 10
- Organiser Hub: 11
- Play: 6
- Admin: 9
- Profile: 8
- Security regression: 12

**Category 4, why each group is blocked:**

| Tests | Problem | Fix |
|---|---|---|
| `example.spec.ts` (2) | Visits playwright.dev, not TennisConnect | Delete |
| `profile/test-auth.spec.ts` (1) | Failed logins against `player@test.com`, possibly a real account | Delete |
| `setup/*.setup.spec.ts` (2) | Legacy UI login; writes a storage-state file nothing uses | Delete; use `tests/helpers/e2e-auth.ts` |
| SEC-NAME (11) | Registers `test<ts>@mail.com`, creating **non-test users** cleanup must never touch | Run-owned emails |
| SEC-003/004/005, SEC-001 (sql), SEC-002 (xss) (5) | Register `@test.com` addresses | Run-owned emails |
| AUTH-006 (1) | Forgot-password for `player@test.com` | Run-owned account |
| SEC-LOGIN (11) | 11 failed logins exceed the **10 / 15 min / IP** login limit and lock out every later login in the run | Run last in its own job, or cut to ≤ 5 payloads |
| SEC-FORGOT (11) | Uses the shared **20 / 15 min** auth-action budget (registration uses it too) | Separate job within budget |
| PROFILE-003…008, PROFILE-012, IMG-001/002 (9) | Edit or upload to **shared** legacy accounts; breaks other tests, files land in Supabase Storage | Run-owned accounts |
| MSG-006 (1) | Shared coach messages shared player: nothing run-owned, so cleanup can't remove it | Run-owned coach and player |
| SUPPORT-007/008 (2) | Create Stripe Checkout sessions | Opt-in only: `E2E_REQUIRE_PAYMENTS=1`, preflight `stripeMode=test`, explicit approval |

---

## 2. Verification of Stage 2 components

| Component | Status | Finding |
|---|---|---|
| Fixture seeder (dry run, gate, idempotency, conflicts) | ✅ 36/36 unit tests on `main` | Never run against Staging (Phase B/C) |
| Environment preflight / deployed-commit guard | ✅ guard 91/91 | Reuse unchanged |
| Run token (`E2E_RUN_ID`) | ✅ generated per run, sent on test hooks, server enforces ownership on Staging | Server rules are live only if Staging runs a commit at or after `338e339`. Check `/api/health` |
| Test-hook security | ✅ 27/27 + 22/22 | `seed-players`, `seed-session` and `issue-verification-token` are compatible: `becomeOrganiser()` and `registerPlayer()` create run-owned users |
| Auth helper (`e2e-auth.ts`, per-worker storage state, rememberMe) | ✅ unit-tested | **No test uses it yet** |
| Accounts / roles | ⚠️ | Tests use **legacy `TEST_USERS`** (`TEST_PLAYER_EMAIL` …, slugs `player-playwright` / `coach-playwright` / `admin-playwright`). None of these exist in Stage 2, and no workflow provides them |

---

## 3. Blockers and gaps

1. **Auth rate limits (hard blocker).**
   - The full suite makes about **99 UI registrations and 76 UI logins** from one runner IP, against limits of 20 and 10 per 15 minutes.
   - *Proposed:* a Staging-only limiter skip for **run-scoped emails only** (`DB_ENV=staging` and the email matches `e2e-run-<runId>-…`). Baseline accounts, including `e2e-admin`, stay rate-limited, and Production is unchanged. Plus cached storage state for all non-auth tests, which cuts admin and seeded logins to one per worker.
   - *Alternative without a server change:* budget-paced phases, which take about 2 hours or more.
2. **No cleanup mechanism exists.** Every mutating test leaves users, organisations, published `/play` sessions, messages and uploaded files behind.
3. **Organisation cascade gap.**
   - `cascadeDeleteOrganizations()` never deletes `seasons`, `series`, `session_templates` or `session_updates`, all of which have foreign keys to the organisation or its sessions. Deleting an organisation that has any of them should fail on a foreign key.
   - Organiser tests create seasons and series, so their cleanup would fail. The same gap probably affects the admin "Delete Organization" action today.
4. **Uploaded files are never deleted.** `deleteUserAccounts()` removes rows but not Supabase Storage objects (`players/<userId>/…`, `coaches/<userId>/…`, `sessions/<userId>/…`, marketplace and tournament photos).
5. **Staging storage project unverified.** Nothing confirms that Staging's `SUPABASE_URL` is a separate project from Production. Upload tests must not run until this is confirmed.
6. **Legacy shared accounts.**
   - Migrate `TEST_USERS` to the Stage 2 baseline identities (emails, slugs and `E2E_*_PASSWORD`).
   - Move every profile-editing or upload test to run-owned accounts.
7. **Admin destructive tests.** ADMIN-002/003/005…009 delete users through the real admin UI and API. Before confirming, each test must assert that every target email is owned by this run.
8. **Traces would hold session cookies.** Authenticated Staging phases need `trace: 'off'` (screenshots and video are fine), and artifacts should be kept for 7 days.
9. **Gitleaks.** The merged remote branch `feature/staging-e2e-fixtures` (`66a11b8`) still contains the synthetic finding. CI checks out all branches, so the next scan on `main` fails. I verified this with v8.24.3: 1 finding with the branch, 0 without. **Delete that remote branch.**
10. **Data from earlier ad-hoc runs** (`test_player_*`, `seed_player_*` on `@tennisconnect.test`, "Playwright Club …" organisations) isn't run-owned. It needs a separate, report-only sweep. Out of scope for automatic cleanup.

---

## 4. Safe cleanup strategy

**Principle:** delete only what is provably owned by **exactly one run**. Never baseline or fixture data, other runs, legacy test data or real users. No wildcard or "delete all test data" endpoint.

**Server: `POST /api/test-hooks/cleanup-run`**
- Gated like the other hooks: Staging or development only, secret header, `X-E2E-Run-Id` required.
- **Dry run by default.** `{ apply: true, confirmRunId }` must repeat the header's run ID.
- **Selection:** users where `isTestUser = true` AND the email matches `e2e-run-<runId>-%@tennisconnect.test`, then re-validated in code with `isOwnedByRun()`. Baseline and fixture addresses can never match.
- **One transaction:**
  1. Organisations owned by those users go through an extended cascade: the existing steps plus seasons, series, session templates and session updates. Fix the gap in shared code, since admin "Delete Organization" needs it too.
  2. The users themselves go through the existing `deleteUserAccounts()` cascade. It already removes messages in both directions (so the shared coach's or admin's replies go too), registrations in run sessions (including fixture accounts registered in them), memberships, profiles, marketplace items and tournament history.
- **After commit:** remove Storage objects under `players|coaches|sessions/<runUserId>/` plus collected marketplace and tournament photo paths, all within the `media` bucket.
- **Returns counts.** A follow-up dry run must report 0.

**Client:**
- Playwright `globalTeardown` calls `cleanup-run` for `E2E_RUN_ID`.
- The workflow repeats it in an `if: always()` step, so cleanup runs even if Playwright crashes.
- `npm run e2e:cleanup-run -- --run-id=<id> [--apply]` covers manual recovery of a specific run ID. Never a wildcard.

**Residue:** a read-only hook lists run IDs that still own records, so failed runs can be cleaned explicitly by ID.

**Fixtures:** never deleted. If fixture data drifts, re-run the idempotent seed.

---

## 5. Stage 3 execution plan

| Phase | What | Entry criteria | Exit criteria |
|---|---|---|---|
| **A** Read-only | `staging-readonly.yml` (32) + CI smoke (4); review and add the 5 candidates | Staging on the expected `main` commit | 41 / 41 green |
| **B** Fixture dry run | Operator runs `npm run e2e:seed:staging` (dry run) | `E2E_APPROVED_STAGING_DB` set; `PROD_DATABASE_URL` set for the comparison | 0 conflicts; plan reviewed; "valid until" date noted |
| **C** Seeding (**explicit approval**) | `--apply --confirm=<user>@<host>/<db>` | Phase B approved; baseline passwords in the operator shell and GitHub Environment | A second dry run shows 0 creates and 0 conflicts; the 5 baseline logins work |
| **D** Authenticated | D1 `auth-readonly` (8); D2 `mutating-core` (auth, registration, run-owned profile, security regression, fixed security tests) | Code changes 1–8 below merged and deployed; cleanup hook live; storage project verified | All green; cleanup dry run reports 0 for the run |
| **E** Hub, messaging, admin | `hub-msg-admin` (organiser, play, messaging, admin with run-ownership asserts); then `security-last` (SEC-LOGIN/FORGOT); Stripe opt-in separately | Phase D passed twice in a row | All green; 0 residue; baseline and fixture counts unchanged |
| **F** Cleanup and regression | Residue check across recent runs; read-only and smoke again; second seed dry run (no drift) | Phase E done | 0 residue; Phase A green; seed dry run shows no changes |

Run settings throughout: 1 worker, `retries: 0` for mutating phases, one Staging job at a time (shared `staging-smoke` concurrency group).

---

## 6. Required code changes (proposed, not implemented)

1. **Phase allowlists:** `tests/safety/staging-phases.ts` (reviewed IDs per phase, like `staging-readonly.ts`), a runner script `test:e2e:staging:phase:ci`, and unit tests.
2. **Accounts:**
   - `TEST_USERS` comes from `BASELINE_IDENTITIES` and `E2E_*_PASSWORD`.
   - Authenticated tests use `authenticatedContext()`.
   - Admin grants and approvals go through the API with a cached admin context, not a UI login per test.
3. **Remove** `example.spec.ts`, `profile/test-auth.spec.ts` and `setup/*.setup.spec.ts`.
4. **Run-owned emails** in SEC-NAME, `security.spec`, `sql-injection`, `xss`, AUTH-006 and REG-005. **Move to run-owned accounts:** PROFILE-003…008, PROFILE-012, IMG-001/002 and MSG-006.
5. **Rate limits:** Staging-only skip for run-scoped emails in `server/routes.ts`, with unit tests proving Production and baseline accounts stay limited. Needs a Staging deploy.
6. **Cleanup:** `cleanup-run` hook, extended organisation cascade, storage removal, residue listing, `globalTeardown` and the CLI. Unit tests with in-memory fakes, plus a route test proving another run's, baseline, fixture, legacy and non-test users are untouched.
7. **Admin tests:** assert run ownership of every target before confirming a delete.
8. **Playwright config:** `trace: 'off'` when `TEST_ENV=staging` and the phase is authenticated.
9. **Preflight:** report the Supabase Storage host (not secret). The workflow compares it with a repository variable `STAGING_SUPABASE_HOST`.
10. **Workflow:** `.github/workflows/staging-e2e.yml` (draft: `staging-e2e.yml.draft`, passes actionlint).

You need to: delete the remote branch `feature/staging-e2e-fixtures`, create the `staging-e2e` GitHub Environment with a required reviewer and Staging-only secrets, and confirm the Staging Supabase project.

---

## 7. Proposed GitHub Actions workflow (summary)

- `workflow_dispatch` only. Inputs: `phase` (choice), `confirm` (must be `STAGING`), `expected_sha`, `wait_minutes`.
- `environment: staging-e2e`: required reviewer; holds only Staging secrets (`E2E_TEST_HOOK_SECRET`, `E2E_*_PASSWORD`).
- Fixed `TEST_ENV=staging` and Staging `BASE_URL`, plus the Playwright guard. The commit must be on `main` and reported by `/api/health`. The preflight must show email capture and Stripe test mode.
- One `E2E_RUN_ID` per dispatch, generated before tests and passed to Playwright and to the always-run cleanup step, followed by a verification dry run that must report 0.
- 1 worker, no retries, report kept for 7 days, shared concurrency group. Never on push or pull request; no Production secrets anywhere.

---

## 8. Acceptance criteria

1. Every one of the 192 tests sits in exactly one phase allowlist or is removed or blocked; a unit test fails on any unclassified test.
2. No test on Staging uses a non-`@tennisconnect.test` address or legacy `TEST_USERS`. Every test-created user is run-owned (enforced client- and server-side).
3. A full Phase D + E run passes from one runner with no 429 responses.
4. After every run, cleanup reports 0 remaining records and 0 storage objects for that run ID, including when the run fails or is cancelled midway.
5. Baseline and fixture record counts and a seed dry run are unchanged before and after each phase.
6. Cleanup unit and route tests prove that another run's, baseline, fixture, legacy-test and non-test users are never deleted.
7. The Production guard still rejects every non-`@prod-safe` test, and no workflow holds a Production secret.
8. No session cookies or secrets appear in uploaded artifacts; Gitleaks is clean on all branches.
9. CI type-check, build, unit, guard, test-hook, staging-safety and fixture suites pass.

**Validation done for this audit (on `main`):**
- Unit suites: seed tests 36/36, test-hooks 27/27 and 22/22, staging-safety 18/18, live engine 8/8, guard 91/91.
- Playwright discovery: 192 local / 192 staging / 5 production.
- Draft workflow: passes actionlint.
- Gitleaks simulation: as described in blocker 9.
- `npm run check` / `npm run build` can't run here (package registry blocked), so run both locally.

---

## 9. Implementation status (Stage 3 branch, not yet deployed)

| Plan item | Status |
|---|---|
| 1. Phase allowlists + runner + unit test | ✅ `tests/safety/staging-phases.ts`, `run-staging-phase.ts`; every one of the 187 remaining tests classified exactly once |
| 2. Accounts → Stage 2 baseline + cached sessions; admin via cached session | ✅ `TEST_USERS`, `login()`/`logout()`, `e2e-auth.ts` |
| 3. Remove `example.spec.ts`, `profile/test-auth.spec.ts`, `setup/*.setup.spec.ts` | ✅ (192 → 187 tests) |
| 4. Run-owned emails / accounts for blocked tests | ✅ `uniqueTestEmail()`, `signInAsNewPlayer/Coach()`; MSG-006 recipient run-owned. Also fixed AUTH-011/012/013 and SEC-009 (were not run-owned) |
| 5. Staging-only rate-limit exemption | ✅ `server/lib/e2eRateLimit.ts`, wired into login + auth-action limiters |
| 6. Cleanup hook, organisation cascade fix, storage removal, residue, teardown, CLI | ✅ plus refusals for outside rows pointing at run data; file deletion gated by `E2E_STORAGE_CLEANUP=enabled` |
| 7. Admin tests assert run ownership of targets | ✅ `expectRunOwned()`; ADMIN-009 local only |
| 8. Traces off for phase runs | ✅ `--trace=off` in the phase runner |
| 9. Preflight reports the storage host | ✅ upload tests also need `E2E_STORAGE_ISOLATION_VERIFIED=1` on Staging |
| 10. Workflow | Draft only, updated - promote after deployment and verification |

Not done yet (needs your approval): deploy to Staging, Phase B/C seeding,
any write-enabled run, verifying Staging storage isolation, creating the
`staging-e2e` environment and secrets.
