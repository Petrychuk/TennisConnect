# Test users

Updated 30 Oct 2026. Code: `server/seeds/e2e/identities.ts`, `tests/fixtures/test-users.ts`, `tests/helpers/e2e-auth.ts`, `tests/helpers/auth.ts`.

## Baseline Staging accounts (permanent, shared)

Created only by the operator seed (`npm run e2e:seed:staging`), never by tests.

| Key in `TEST_USERS` | Email | Password variable | Role |
|---|---|---|---|
| `admin` | `e2e-admin@tennisconnect.test` | `E2E_ADMIN_PASSWORD` | Admin |
| `player` | `e2e-player@tennisconnect.test` | `E2E_PLAYER_PASSWORD` | Player, completed profile |
| `player2` | `e2e-player-2@tennisconnect.test` | `E2E_PLAYER_2_PASSWORD` | Player |
| `coach` | `e2e-coach@tennisconnect.test` | `E2E_COACH_PASSWORD` | Coach |
| `organiser` | `e2e-organiser@tennisconnect.test` | `E2E_ORGANISER_PASSWORD` | Organiser, owns an organisation |

- Signed in through the API (`loginViaApi()`), once per worker and role. The session is verified with `GET /api/auth/me` and cached in `playwright/.auth/` (gitignored, mode 0600).
- Tests may read and message these accounts but must not change their profiles, photos or settings.
- A missing password fails with the variable **name** only. A failed login reports HTTP status and server code, never the body or password.
- **Verify before relying on them:** `npm run e2e:staging:check` logs in as each account and checks it. Not verified from this environment (no Staging access).

## Temporary accounts (per test, per run)

- `registerPlayer()` / `registerCoach()`: registration through the UI. Email verification goes through the `issue-verification-token` hook (Staging/local only, `@tennisconnect.test` only), then the real `/verify-email` flow. The account ends on `/complete-profile`, i.e. an **incomplete** profile; `completePlayerProfile()` completes it.
- `becomeOrganiser()`: registers a player; `e2e-admin` grants organiser access through the Admin → Users UI; then the organiser's organisation is created through the API. **New 30 Oct:** each step checks the server state and fails with the cause:
  - signed in as the admin and `isAdmin`;
  - grant response is 200;
  - the player is still signed in with `isOrganizer: true`.
- `seedPlayers()`: verified, approved, profile-complete players via the `seed-players` hook.
- All are `e2e-run-<runId>-…@tennisconnect.test`, removed by run cleanup.

## Legacy variables (`TEST_ADMIN_*`, `TEST_PLAYER_*`, `TEST_COACH_*`)

**ORG-AUTH-001 root cause (30 Oct 2026).** These variables replaced the baseline account silently whenever `TEST_ENV` was `local`, which is the default when it's unset. A local run reads `.env`. A developer `.env` that still had `TEST_ADMIN_EMAIL` made `becomeOrganiser()` → `grantOrganizerAccess()` → `login()` use the retired shared admin through the login form. That account doesn't exist on the Staging database that local runs use; or `TEST_ADMIN_PASSWORD` was missing and the password was empty. Result: HTTP 401, and the test stayed on `/auth`. ACCESS-004's coach login went through the same lookup.

**Now:**

| Situation | Account used |
|---|---|
| Any `TEST_ENV`, no opt-in | The baseline `e2e-*` account. Legacy variables are ignored, and the run log lists them by name |
| `TEST_ENV=local` + `E2E_LEGACY_LOCAL_ACCOUNTS=1` + both `TEST_<ROLE>_EMAIL` and `TEST_<ROLE>_PASSWORD` | The legacy local account (for a local database without the seed) |
| Opt-in with only one of the pair | Error naming the missing variable, never a mixed or empty credential |
| `TEST_ENV=staging` / `production` | Always baseline (Staging also refuses these keys in `.env.e2e.staging.local`) |

No variable was deleted. The only consumer is `tests/fixtures/test-users.ts`. Unit tests: `tests/safety/e2e-auth.unit.ts`.

**Action for developers:** remove `TEST_ADMIN_*`, `TEST_PLAYER_*` and `TEST_COACH_*` from your `.env` unless you run against a local database on purpose. Set `E2E_*_PASSWORD` instead.

## Production identities

None configured, and none approved. The Production suite is guest-only and GET-only (`PRODUCTION_SMOKE_POLICY.md`). If authenticated Production smoke tests are ever approved, they need their own dedicated accounts and variables. Staging credentials and run accounts must never be used there; the guards above refuse them.
