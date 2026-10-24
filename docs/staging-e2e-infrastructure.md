# Staging E2E infrastructure

Operational guide for running Playwright regression against Railway Staging
(`https://tennisconnect-staging.up.railway.app`). Production is never a
target: the environment guard (`tests/safety/environment-guard.ts`) refuses it
for everything except the read-only `@prod-safe` allowlist.

Built in reviewable stages. This document grows with each stage.

| Stage | Scope | Status |
|---|---|---|
| 1 | Email capture, Stripe test-mode safeguards, regression preflight | Merged |
| 2 | Dedicated test accounts and deterministic fixtures | Merged (seed not yet run) |
| 3 | Run-scoped cleanup, organisation delete fix, rate-limit exemption, test migration, phase allowlists | In review (not deployed, nothing run on Staging) |
| 4 | Execute the phases on Staging (after approval) | Planned |
| 5 | Manual full-regression workflow (promote the draft) | Planned |

## Stage 1 — safety foundations

### Email: captured on Staging (except allowlisted team addresses)

All outgoing email goes through `sendEmail()` in
`server/services/emailService.ts`. The transport is decided per send by
`resolveEmailTransport()` (`server/services/emailCapture.ts`):

| Environment | `EMAIL_TRANSPORT` | Result |
|---|---|---|
| `DB_ENV=production` | anything | Delivered through Resend (unchanged) |
| `DB_ENV=staging` | unset | **Captured** (default) - except recipients on `STAGING_EMAIL_ALLOWLIST`, which are delivered |
| any non-production | `capture` | Captured |
| any non-production | `resend` | Delivered (explicit opt-out) |
| local development | unset | Delivered as before |

- Captured emails are kept **in server memory**: at most 500, for 60 minutes,
  lost on restart. This assumes a single Staging instance.
- The log line names the subject only, never the recipient, links or tokens.
- Tests read them through `POST /api/test-hooks/emails` (secret required).
  The hook only returns emails for exactly one `@tennisconnect.test`
  recipient. A captured email to anyone else (for example a real user's
  password reset on Staging) is never returned, even with the secret.
- Client helpers: `getCapturedEmails()` and `waitForCapturedEmail()` in
  `tests/helpers/test-hooks.ts`. They make plain HTTP calls from the test
  runner, so links and tokens never pass through the browser, traces or
  screenshots.

Consequence: with this deployed, **nobody receives email from Staging**,
including manual testers, unless `EMAIL_TRANSPORT=resend` is set there (which
makes the regression preflight fail).

### Stripe: test mode only outside Production

`server/lib/stripeMode.ts`, used by `server/routes/support.ts`:

- Outside Production, a live (`sk_live_`/`rk_live_`) or unrecognised secret
  key blocks checkout creation (HTTP 503) and logs the reason, never the key.
- Outside Production, a webhook event with `livemode: true` is rejected (400)
  and never marks a payment as paid.
- Production behaviour is unchanged.

### Regression preflight

`POST /api/test-hooks/preflight` (secret required, disabled on Production)
returns modes and booleans only:

```json
{ "dbEnv": "staging", "commit": "<sha>", "emailTransport": "capture",
  "stripeMode": "test", "stripeWebhookConfigured": true }
```

`npm run e2e:verify-staging-preflight` checks it (`tests/safety/preflight.ts`)
and exits 1, listing every problem, unless all of these hold:

- `dbEnv` is `staging`;
- the reported commit equals `EXPECTED_DEPLOY_SHA`;
- `emailTransport` is `capture`;
- Stripe is not live or unrecognised;
- with `E2E_REQUIRE_PAYMENTS=1`, Stripe is `test` and a webhook secret is
  configured.

### Configuration (names only, never values)

| Name | Where | Purpose |
|---|---|---|
| `DB_ENV=staging` | Railway Staging | Identifies Staging (already set) |
| `E2E_TEST_HOOK_SECRET` | Railway Staging + GitHub secret | Test-hook access (already set) |
| `EMAIL_TRANSPORT` | Railway Staging (optional) | Leave unset (= capture). Never set on Production |
| `STAGING_EMAIL_ALLOWLIST` | Railway Staging (optional) | Real team addresses (`anna@gmail.com`) or domains (`@tennisconnect.com.au`) that DO receive Staging email (e.g. password reset for manual testing). Never matches `@tennisconnect.test`; ignored with `EMAIL_TRANSPORT=capture` and on Production |
| `APP_URL` | Optional | Base URL for links in emails. Unset = the known site of the environment (Staging links point at Staging); the request `Origin` is only used if it is a known site |
| `STRIPE_SECRET_KEY` | Railway Staging | Must be a test key (`sk_test_`/`rk_test_`) |
| `STRIPE_WEBHOOK_SECRET` | Railway Staging | Needed only for payment tests |
| `EXPECTED_DEPLOY_SHA` | Workflow input | Commit Staging must run |
| `E2E_REQUIRE_PAYMENTS` | Workflow input | `1` when payment tests are included |

### Local checks

```bash
npm run test:staging-safety   # email transport rules, capture store, Stripe guards
npm run test:test-hooks       # test-hook security incl. preflight/emails hooks
npm run test:e2e:guard        # environment guard, selections, preflight rules
```

## Stage 2 — test accounts and deterministic fixtures

Everything lives in `server/seeds/e2e/` (seed) and `tests/helpers/e2e-auth.ts`
(Playwright). Nothing seeds automatically: the seed is an explicit operator
command, refused in CI, and defaults to a read-only dry run.

### Identities (all on the reserved `tennisconnect.test` domain)

| Kind | Address | Logs in? | Owner |
|---|---|---|---|
| baseline | `e2e-player@`, `e2e-player-2@`, `e2e-coach@`, `e2e-organiser@`, `e2e-admin@` | Yes, password from `E2E_*_PASSWORD` | Seed (persistent) |
| fixture | `e2e-fixture-<player\|coach>-NN@` | No (random password) | Seed (persistent) |
| run | `e2e-run-<runId>-<label>@` | Per test | One Playwright run (Stage 3 cleanup) |

- Classification is by exact whole-address pattern (`identities.ts`), never a
  prefix match. Every seeded user is `isTestUser = true`.
- **Admin** exists only as `e2e-admin`, created by the operator seed. Public
  registration strips `isAdmin`; test hooks never create admins.
- Every Playwright run gets `E2E_RUN_ID` (set once in `playwright.config.ts`,
  inherited by workers). Run ownership is **enforced**, not just labelled:
  - `generateTestUser()` creates run-owned addresses, and on Staging refuses
    to create a user at all without a valid run token;
  - every test-hook call sends the token as `X-E2E-Run-Id`. The Staging server
    refuses `seed-players`, `seed-session` and `issue-verification-token`
    without it (400). Users created by `seed-players` are run-owned.
    `seed-session` accepts only a creator from the same run, and participants
    from the same run or seeded baseline/fixture accounts. Verification tokens
    are issued only for the same run's users. Another run's users, and
    accounts without a run token, get 403;
  - locally (no `DB_ENV=staging`) the header stays optional, so older local
    runs keep working. A malformed token is refused everywhere.

  The server-side rules take effect on Staging only after the next deploy.
  Stage 2 never deletes anything; Stage 3 cleanup will use the same token.

### Fixture inventory

Deterministic: the same anchor date always produces identical data.

**Dates.** Past items (completed sessions, the past tournament, the season
start) sit before the anchor and stay past forever. Every future item
(upcoming, cancelled and draft sessions; upcoming tournaments; the season end)
sits at least **180 days** after the anchor. The anchor is today by default
and may be at most 7 days old, so one seed keeps upcoming data upcoming for
about six months. The seed prints the exact "valid until" date; re-running it
before then refreshes the dates in place on the same records. Time-window
views such as "Play This Week" (next 7 days) can't be covered by persistent
data, so tests for them must create their own run-owned session.
Fictional people, real Australian places. Titles start with `[E2E]`; slugs
with `e2e-`; organisations/clubs/tournaments carry the contact marker
`e2e-fixtures@tennisconnect.test`.

- **49 users**: 5 baseline + 24 fixture players + 20 fixture coaches, all with
  complete public profiles (admin is unlisted). 21 listed coaches (> 16 per
  page) and 27 listed players (> 20 per page) make directory pagination real
  (PUBLIC-003 / PUBLIC-007).
- **Community** `e2e-harbourside-social`, owned by `e2e-organiser`; memberships
  accepted (`e2e-player`), pending (`e2e-player-2`), declined (fixture player 01).
- **Clubs** `e2e-club-moore-park`, `e2e-club-kooyong`, `e2e-club-new-farm` (published), one follow.
- **Tournaments** two upcoming, one past with winner/finalist.
- **Organiser Hub**: one season, one series and 7 sessions — full with a
  2-person waitlist, open clinic, two completed sessions with rounds and
  confirmed scores (leaderboard data), cancelled, draft, tournament.
- **Messages**: player ↔ coach and player → player-2 conversations.

### Running the seed (Staging only, operator action)

Every condition must hold or nothing happens (`safety.ts`):

1. `DB_ENV` is exactly `staging` and `NODE_ENV` exactly `development` (set by
   the npm script, so `server/db.ts` can never load `.env`, the Production config);
2. not in CI (`CI` / `GITHUB_ACTIONS` set to anything);
3. no `PGHOST`, `PGHOSTADDR`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGSERVICE`,
   `PGSERVICEFILE` or `PGOPTIONS` (they could redirect the connection);
4. `DATABASE_URL` is one postgres URL with an explicit user, one plain host
   and one database, and no routing query parameters (`?host=`, `?dbname=`,
   `?options=`, `?service=` …; only `sslmode`, `application_name`,
   `connect_timeout`, `pgbouncer` are accepted);
5. its identity `<user>@<host>/<database>` equals `E2E_APPROVED_STAGING_DB`.
   The user is included because Supabase projects can share one pooler host
   and all use database `postgres`, so only the project ref in the user name
   (`postgres.<ref>`) tells Staging and Production apart;
6. `PROD_DATABASE_URL`, if set, must parse and must not share that identity
   or its user/project ref;
7. after `server/db.ts` loads (its dotenv may add variables), the whole gate
   runs again, and `current_database()` / `current_user` must match before
   anything else is queried;
8. a read-only plan finds **no conflicts** — a non-test user holding a fixture
   address, a fixture slug used by another account, or a club/organisation/
   tournament slug without the fixture marker stops the run before any write;
9. writes need `--apply --confirm=<user>@<host>/<database>` and run in one
   transaction (any error rolls everything back).

```bash
# Dry run (default) - reads only; prints the plan, conflicts, the
# "valid until" date and which passwords --apply will need
DB_ENV=staging DATABASE_URL=... E2E_APPROVED_STAGING_DB=<user>@<host>/<db> npm run e2e:seed:staging

# Write (idempotent: re-running updates the same records, never duplicates).
# Passwords are needed only for baseline accounts that don't exist yet.
E2E_PLAYER_PASSWORD=... E2E_PLAYER_2_PASSWORD=... E2E_COACH_PASSWORD=... \
E2E_ORGANISER_PASSWORD=... E2E_ADMIN_PASSWORD=... \
DB_ENV=staging DATABASE_URL=... E2E_APPROVED_STAGING_DB=<user>@<host>/<db> \
npm run e2e:seed:staging -- --apply --confirm=<user>@<host>/<db>
```

The seed writes rows directly — no registration, email or Stripe code runs.
It prints `user@host/database`, counts and conflicts only.

**Passwords are written on creation only.** Re-running never touches an
existing account's password, so a tester's working credentials are never
silently reset. To rotate the baseline passwords on purpose, add
`--rotate-passwords` (with `--apply`). Fixture passwords are random and never
re-set. Re-running does clear a baseline account's failed-login lockout.

### Logging in from tests

```ts
import { authenticatedContext } from '../helpers/e2e-auth';

const context = await authenticatedContext(browser, 'organiser', testInfo);
const page = await context.newPage();
// ...
await context.close();
```

API login (`POST /api/auth/login`, verified with `GET /api/auth/me`), state
saved per role **per worker** to `playwright/.auth/` (gitignored, mode 0600),
using a remembered session (the server logs out other sessions after 1 hour idle).
Each test gets a new context; a worker reuses its login per role (the login
endpoint allows 10 attempts per 15 minutes per IP). Tests that log out must
pass `{ fresh: true }`. Refused when `TEST_ENV=production`.

### Configuration (names only, never values)

| Name | Where | Purpose |
|---|---|---|
| `E2E_APPROVED_STAGING_DB` | Operator shell | `<user>@<host>/<database>` of Staging — the only target the seed accepts |
| `E2E_PLAYER_PASSWORD`, `E2E_PLAYER_2_PASSWORD`, `E2E_COACH_PASSWORD`, `E2E_ORGANISER_PASSWORD`, `E2E_ADMIN_PASSWORD` | Operator shell (seed); GitHub secrets later (tests) | Baseline passwords, ≥ 16 characters |
| `E2E_RUN_ID` | Set by Playwright | Run token; leave unset |

### Local checks

```bash
npm run test:staging-fixtures   # identities, fixtures, dates, seed gate, seeder (in-memory store) - also in CI
npm run test:test-hooks         # now includes run-ownership enforcement
npm run test:e2e:guard          # also covers the auth helpers, run ids and the repo secret guard
```

### Never committed

`.env*` (except `.env.example`), `playwright/.auth/`, any `**/.auth/`
directory, `*storageState*.json` / `*storage-state*.json` / `*auth-state*.json`,
`.pgpass`, keys and `credentials.json` are gitignored.
`tests/safety/repo-secrets.unit.ts` (part of `test:e2e:guard`, in CI) checks
those paths are ignored. It also fails if any tracked file is such a file,
contains Playwright storage state, or holds a real-looking
`postgres://user:password@host` string. This complements the gitleaks job.

## Stage 3 — run-scoped cleanup and execution preparation

Plan and per-test inventory: `docs/testing/stage3-execution-plan.md`,
`docs/testing/stage3-test-inventory.csv`. The phased workflow is still a
draft (`docs/testing/drafts/staging-e2e.yml.draft`). Nothing in this stage
has been deployed or run against Staging.

### Organisation deletion fix

`server/lib/organizationCascade.ts` is the one organisation cascade (admin
"Delete Organization", account deletion, run cleanup). It now also removes
seasons, series, session templates and session update posts, and detaches
discovery activities that reference the organisation or its sessions -
before, any of those made the delete fail on a foreign key.
`server/lib/userCascade.ts` holds the account-row deletion (moved unchanged
from `storage.deleteUserAccounts()`, plus `external_activities.reviewed_by`).
`organizationCascade.test.ts` reads the real schema and fails if a foreign
key into these tables is not handled.

### Run cleanup (`POST /api/test-hooks/cleanup-run`)

- Gated like every test hook (development/Staging only, secret header) and
  always needs `X-E2E-Run-Id`. **Dry run by default**; deleting needs
  `{ "apply": true, "confirmRunId": "<same id>" }`.
- Deletes only users that are `isTestUser` with an
  `e2e-run-<runId>-…@tennisconnect.test` address of exactly that run, their
  organisations (full cascade) and their account rows. Stage 2 baseline and
  fixture accounts, other runs, legacy test users and real users never match.
- **Refuses (409, nothing deleted)** when anyone outside the run is involved:
  registrations, memberships or messages from real users or other runs;
  rows run users created in organisations the run does not own; or outside
  rows that point at the run's data (another organisation's series or
  sessions, tournament history, messages, discovery activities, matches).
  The shared Stage 2 accounts may take part in a run's data.
- One transaction that re-checks the plan; aborts if the run's users change
  (e.g. the run is still going).
- **Uploaded files** under `players|coaches|sessions|marketplace/<runUserId>/`
  are deleted only when the server has `E2E_STORAGE_CLEANUP=enabled` (set on
  Staging after verifying it does not share Production's storage project).
  Without it files are only listed, and cleanup refuses while a run still
  has files - nothing is orphaned and no storage write happens.
- `POST /api/test-hooks/run-residue` (read-only) lists run ids that still
  own users, so each can be cleaned explicitly by id. There is no wildcard.

```bash
npm run e2e:cleanup-run -- --run-id=<id>                    # dry run
npm run e2e:cleanup-run -- --run-id=<id> --apply --verify   # delete, then require 0 left
npm run e2e:cleanup-run -- --residue                        # runs that left data
```

Playwright's global teardown reports the run's leftovers after every run and
deletes them only with `E2E_CLEANUP_ON_TEARDOWN=1` (set by the phase runner
for writing phases).

### Rate limits

On Staging only (`DB_ENV=staging`), login / register / forgot-password
requests for **run-owned** addresses are not counted by the per-IP limiters,
so a CI run from one IP is not throttled (`server/lib/e2eRateLimit.ts`).
Production, the permanent `e2e-*` accounts and everyone else keep the 10 / 20
per 15 minutes limits; the per-account lockout still applies to everyone.

### Accounts in tests

- `TEST_USERS` (`tests/fixtures/test-users.ts`) are the Stage 2 baseline
  accounts. `login()` reuses one cached API session per worker for them (no
  password typed, no extra login request); `logout()` clears that context's
  cookies instead of ending the shared session. `{ ui: true }` keeps the
  real form for tests of the login itself (AUTH-SMOKE-001).
- Tests that change an account use their own run-owned one
  (`signInAsNewPlayer/Coach`, `tests/helpers/accounts.ts`); every new
  address comes from `uniqueTestEmail()`.
- Admin actions assert that every target belongs to the run
  (`expectRunOwned()`); ADMIN-009 (targets the admin's own account) is local only.
- Upload tests skip on Staging unless `E2E_STORAGE_ISOLATION_VERIFIED=1`;
  Stripe tests skip unless `E2E_ENABLE_STRIPE_TESTS=1`.
- Removed: `example.spec.ts` (playwright.dev), `profile/test-auth.spec.ts`
  (logged in as `player@test.com`), `setup/*.setup.spec.ts` (unused legacy
  storage state).

### Phases

`tests/safety/staging-phases.ts` puts every test in exactly one place:
the read-only sets (Phase A), `auth-readonly`, `mutating-core`,
`hub-msg-admin`, `security-last`, `stripe` (opt-in), or local-only.
`staging-phases.unit.ts` lists every test through Playwright and fails on
anything unclassified, duplicated, or selected by the wrong phase.

```bash
E2E_PHASE=<phase> E2E_RUN_ID=<id> npm run test:e2e:staging:phase:ci   # 1 worker, no retries, traces off
```

### Configuration (names only)

| Name | Where | Purpose |
|---|---|---|
| `E2E_STORAGE_CLEANUP` | Railway Staging, **only after** verifying storage isolation | `enabled` lets run cleanup delete run users' files |
| `E2E_STORAGE_ISOLATION_VERIFIED` | Workflow / repository variable | `1` lets upload tests run on Staging |
| `E2E_ENABLE_STRIPE_TESTS` | Workflow input | `1` enables the Stripe phase (test mode only) |
| `E2E_CLEANUP_ON_TEARDOWN` | Set by the phase runner | `1` = teardown deletes the run's data |
| `E2E_TEST_PG_URL` | Local / CI only | Loopback Postgres for database integration tests |

### Local checks

```bash
npm run test:cleanup          # cascade coverage, rate-limit exemption, cleanup client/CLI/teardown
E2E_TEST_PG_URL=postgres://postgres@127.0.0.1:5432/tc_it npm run test:db-integration   # real Postgres (loopback only)
npm run test:e2e:guard        # now includes the phase allowlists
```
