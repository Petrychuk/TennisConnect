# Regression results

## 30 Oct 2026, `feature/organiser-hub-v2` (P0 E2E stabilisation)

**No Playwright test was run against Staging or Production for this change.** This environment has no access to Staging or Production and no npm registry, so it can't run the app either. Everything below marked "Passed" ran here; everything else is **Not run**. The ticket's acceptance criteria that need a Staging regression are **open**.

### Executed here

| Check | Result |
|---|---|
| `npm run test:e2e:guard` (environment guard, selection, hooks client, credentials, phases, prod-safe suite) | **Passed** 165/165 |
| `npm run test:ui` (Organiser Hub source guards, categories, policies, actions, organisation profile, UI consistency) | **Passed** 73/73 |
| Server route tests `server/routes/organizerOwnership.test.ts` (express stub, fake storage) | **Passed** 8/8 |
| `playwright test --list` | 339 tests in 47 files; every test classified (staging-phases unit) |
| `TEST_ENV=production playwright test --list` | 33 tests in 1 file (prod-safe only), unchanged |
| Type check of the new and changed specs and helpers against Playwright's types | **Passed**, no errors |
| Client bundle (esbuild) | **Passed**, 0 errors |

### Root causes

| Test | Class | Root cause | Fix |
|---|---|---|---|
| **ORG-AUTH-001** | **Authentication / configuration** (test fixture) | `TEST_USERS.admin` silently became `TEST_ADMIN_EMAIL` whenever `TEST_ENV` was `local` (the default) and `.env` still had the retired variable. Local runs use the Staging database, where that account doesn't exist (or `TEST_ADMIN_PASSWORD` was empty), so the login form got HTTP 401 and the test stayed on `/auth`. That symptom is only possible on this path: the `e2e-admin` path logs in through the API and throws `[e2e-auth] …` instead. | Legacy accounts only with `E2E_LEGACY_LOCAL_ACCOUNTS=1` on local, never a half pair (`tests/fixtures/test-users.ts`). Ignored keys are listed in the run log. `grantOrganizerAccess()` / `becomeOrganiser()` now check `isAdmin`, the grant status and `isOrganizer`. Unit tests in `e2e-auth.unit.ts`. **Needs a Staging re-run.** |
| ACCESS-004 | **Authentication / configuration** (same lookup), otherwise **outdated exclusion** | The coach login uses the same `TEST_USERS` resolution. App behaviour verified in code: `/admin` keeps its own "Admin Access Required" gate ahead of the Hub chrome (not changed by Batch 1); `/api/admin/*` uses `requireAdmin`. | Covered by the fix above. **Needs a re-run** (it was excluded from the 28 Oct run). |
| SEARCH-017 | Flaky (unconfirmed) | See `docs/qa/2026-10-28-staging-regression.md` §2 | Re-run with a trace (traces are now kept on failure) |
| MSG-111 / MSG-112 | Environment (duration) | Multi-account flows near the time limit | Confirm on Staging that `test.slow()` is enough |

No newer Staging report than 29 Oct (`docs/qa/2026-10-29-staging-final-three.md`) exists in the repository, so other failures can't be classified until a run.

### Defects found and fixed while writing the tests (application)

| Where | Defect | Fix |
|---|---|---|
| Players tab → share card | Copied `/sessions/:id`, a page that doesn't exist (404 for every player), and had a "QR Code" button that only said "isn't wired up yet" | Real public link `/play/:id`, only while the session has a public page; QR removed |
| Overview tab (phone) | "Invite Players" only showed "isn't wired up yet" | Opens the real invite dialog; hidden when invites aren't allowed |
| Results tab | "Export" only showed "isn't wired up yet" | Real standings CSV (formula-safe) |
| Create Session | "View example sessions" only showed "isn't wired up yet" | Removed (no examples exist) |
| `GET /sessions/:id/rounds` | Owner-only, while every other session read also allows admins: an admin's Rounds tab failed | Same read rule as the other session reads |
| Play session page | No category, and no link to the organiser's public page | Category badge; organiser name links to `/organisations/:slug` |
| `postTestHook()` | Would send the Staging hook secret to a Production server (the server refuses, but the secret had already left) | Refused client-side before sending |
| Playwright config | Traces only "on first retry"; Staging runs have 0 retries, so failures never had a trace | `trace: 'retain-on-failure'` |

A source guard (`organiserHub.test.ts`) now fails on any Hub toast that says a control isn't wired up or is coming soon.

### To run on Staging (in this order)

1. `npm run e2e:staging:check`: confirms the URL, the deployed commit, the hook secret and that all five `e2e-*` accounts log in.
2. `npm run e2e:staging:auth-readonly`
3. `hub-msg-admin` phase with a fresh `E2E_RUN_ID` (`TEST_ENVIRONMENTS.md`). It includes:
   - the ORG-AUTH tests;
   - the new ORG-PERM, ORG-WIZ, ORG-WS and ORG-ACT tests;
   - ORG-RESP-001…003;
   - PLAY-001…009.

   Optionally add `E2E_ALLOW_PUBLISH_REVIEW=1` (see the matrix).
4. The other phases (`mutating-core`, `security-last`; `stripe` only if wanted).
5. `npm run e2e:cleanup-run -- --run-id=<id>`: dry run first, then `--apply`.
6. Send the HTML report (`npm run test:e2e:report`) and the failure screenshots/traces back for classification.

Deploy order: migration `0034_sessions_policies.sql` must be on Staging before the Batch 2 code (`docs/organiser-hub/KNOWN_LIMITATIONS.md`).
