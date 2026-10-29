# E2E tests (Playwright)

Rules for writing and running tests: [`docs/CLAUDE_PLAYWRIGHT_RULES.md`](../docs/CLAUDE_PLAYWRIGHT_RULES.md).
How Staging is made safe for them: [`docs/staging-e2e-infrastructure.md`](../docs/staging-e2e-infrastructure.md).
CI: [`docs/ci-staging-e2e.md`](../docs/ci-staging-e2e.md).

This page covers running against **Railway Staging from your own machine**.

## One-time setup

### Windows PowerShell

Run these in the repository root:

```powershell
# 1. Create your local file from the template (keeps it UTF-8).
Copy-Item .env.e2e.staging.example .env.e2e.staging.local

# 2. Confirm git ignores it. Expected output: .gitignore:12:.env.*   .env.e2e.staging.local
git check-ignore -v .env.e2e.staging.local

# 3. Print the commit Staging should run; you'll paste it as EXPECTED_DEPLOY_SHA.
git fetch origin
git rev-parse origin/main

# 4. Edit the file (Notepad or VS Code; both save UTF-8).
notepad .env.e2e.staging.local

# 5. Clear old session variables so they can't override the file.
Remove-Item Env:E2E_TEST_HOOK_SECRET, Env:BASE_URL, Env:TEST_ENV, Env:EXPECTED_DEPLOY_SHA -ErrorAction SilentlyContinue

# 6. Check.
npm run e2e:staging:check
```

Don't create or edit the file with `Out-File`, `Set-Content` or `>`. Windows PowerShell 5.1 writes UTF-16 that way, and the check reports the file as unreadable.

### bash / zsh

```bash
cp .env.e2e.staging.example .env.e2e.staging.local
git check-ignore -v .env.e2e.staging.local
git fetch origin && git rev-parse origin/main
"${EDITOR:-nano}" .env.e2e.staging.local
npm run e2e:staging:check
```

### What goes in the file

| Key | Value |
|---|---|
| `TEST_ENV` | `staging` (already filled in) |
| `BASE_URL` | `https://tennisconnect-staging.up.railway.app` (already filled in, the only accepted value) |
| `E2E_TEST_HOOK_SECRET` | The value of `E2E_TEST_HOOK_SECRET` in the Railway **Staging** service's variables. No quotes, one line, at least 32 characters. |
| `EXPECTED_DEPLOY_SHA` | The 40-character output of `git rev-parse origin/main` |
| `E2E_*_PASSWORD` (5 keys) | Only for `npm run e2e:staging:auth-readonly`: passwords of the permanent Staging test accounts (ask the team). Not needed for the check. |

`.env.e2e.staging.local` is gitignored. Never commit it, and never paste it into chats or tickets. The settings then apply in every new PowerShell window; you don't have to set `$env:` variables any more.

## Everyday commands

```bash
git fetch origin; git rev-parse origin/main    # after a merge: put this in EXPECTED_DEPLOY_SHA
npm run e2e:staging:check                      # is Staging ready? (read-only, about 1-2 s)
npm run e2e:staging:auth-readonly              # read-only phase: runs the check first, then Playwright
```

Before the first `auth-readonly` run on a machine, install the browser once: `npx playwright install chromium`.

`npm run e2e:staging:check` changes nothing and starts no tests. It runs five steps, and the first failure stops it:

```
[staging-check]   .env.e2e.staging.local: loaded 3 value(s) (BASE_URL, E2E_TEST_HOOK_SECRET, EXPECTED_DEPLOY_SHA)
[staging-check]   E2E_TEST_HOOK_SECRET: set from .env.e2e.staging.local, 64 characters, sha256 1a2b3c4d... (value hidden)
[staging-check] 1/5 Local configuration: OK - target https://tennisconnect-staging.up.railway.app, expecting commit 4b58920...
[staging-check] 2/5 Staging reachable (dbEnv=staging): OK - /api/health answered, dbEnv=staging (180 ms)
[staging-check] 3/5 Deployed commit: OK - Staging runs 4b58920...
[staging-check] 4/5 Test-hook authentication: OK - secret accepted by POST /api/test-hooks/preflight
[staging-check] 5/5 Preflight rules: OK - email=capture, stripe=test

[staging-check] Staging is READY: ...
```

Exit code 0 means ready; 1 means not ready, and the failed step and what to do are printed. The secret is never printed. Only its length and the first 8 hex characters of its SHA-256 are shown, so two people can compare copies without revealing it.

### When it fails

| Step / kind | Meaning | What to do |
|---|---|---|
| 1 `config` | A value is missing or malformed (placeholder left in, quotes around the secret, short SHA...) | Fix the values listed. All problems are listed at once. |
| 1 `unsafe-target` | `BASE_URL` is a Production host or not the approved Staging URL, or `DB_ENV=production` is set in your shell | Use the approved Staging URL. Nothing is sent anywhere in this case. |
| 1 `WARNING ... differs` | A variable in your shell overrides the file (shell values always win) | If it's stale: `Remove-Item Env:NAME` (PowerShell) / `unset NAME` (bash) |
| 2 `timeout` / `network` | Staging didn't answer in time, or can't be reached | Check your connection / VPN and the service in Railway. `E2E_STAGING_CHECK_TIMEOUT_MS` raises the per-request limit (default 10000, max 60000). |
| 2 `http-404` / `http-status` | Wrong URL, or Staging is deploying or crashing (502/503) | Check the Railway deploy, then re-run. |
| 2 `not-staging` | The server doesn't report `dbEnv=staging` | Stop. Staging must have `DB_ENV=staging`. |
| 3 `deploy-mismatch` | Staging runs a different commit | Railway still deploying? Wait and re-run (`npm run e2e:verify-staging-deploy` waits up to 10 min). Otherwise update `EXPECTED_DEPLOY_SHA`. |
| 3 `deploy-unknown` | Staging doesn't report its commit | Redeploy from GitHub `main` (a manual or CLI deploy can't be verified). |
| 4 `http-401` | The secret doesn't match Staging's | Copy it again from Railway Staging (no quotes) and check for a stale shell variable. **Don't change the Railway value**: CI uses it. |
| 4 `http-404` | Test hooks are disabled on that server (not Staging, or no secret configured there) | Ask whoever manages Railway Staging. Hooks never exist on Production. |
| 4 `timeout` / `network` | The hook didn't answer in time | Re-run and check the Railway logs. |
| 5 `preflight-rules` | Staging would send real email, uses a live Stripe key, etc. | Server configuration. Tests stay blocked until it's fixed. |
| `deadline` | The whole check took too long (it never waits indefinitely) | Re-run and check Railway. |

## Which configuration a run uses

Every Staging command reads `.env.e2e.staging.local`: `e2e:staging:check`, the phase and read-only runners, `npm run test:e2e:staging*` and plain `playwright test` with `TEST_ENV=staging`, and `e2e:cleanup-run`. Values set in your shell take priority. **`.env` is never read for a Staging run**; local runs (`TEST_ENV=local`) still use `.env` as before.

Playwright prints where the configuration came from, as key names only. Before any test starts, global setup refuses a Staging run that is missing anything, listing what's missing:

| Run | Needs |
|---|---|
| Reviewed read-only / smoke selections (`*:readonly:ci`, `*:smoke:ci`) | nothing extra (no hooks, no logins) |
| One phase (`e2e:staging:auth-readonly`, `test:e2e:staging:phase:ci`) | `E2E_TEST_HOOK_SECRET`, the five `E2E_*_PASSWORD`, `EXPECTED_DEPLOY_SHA` |
| Anything else, e.g. `npm run test:e2e:staging` (unphased, includes data-changing tests) | the same, plus `E2E_CONFIRM_WRITES=full-regression` for that run |

The confirmation for an unphased run goes on the command line. It is refused if it's in the file:

```powershell
$env:E2E_CONFIRM_WRITES = 'full-regression'; npm run test:e2e:staging; Remove-Item Env:E2E_CONFIRM_WRITES
```

Prefer the reviewed phases, and run them only with the approval the Stage 3 plan requires. An unphased run creates run-owned users. Afterwards, list what was left (read-only): `npm run e2e:cleanup-run -- --residue`.

## Data-changing phases

`npm run e2e:staging:check` never starts tests, and nothing starts a data-changing phase automatically. The phases are defined in `tests/safety/staging-phases.ts`. Every phase except `auth-readonly` creates (and afterwards cleans up) run-owned data on Staging, so it starts only when all of these hold:

- an `E2E_RUN_ID` is given, so the separate cleanup step can use the same id;
- this run confirms **that exact phase**: `--confirm-writes=<phase>` or `E2E_CONFIRM_WRITES=<phase>` on the command line. It is refused if it comes from `.env.e2e.staging.local`;
- the full readiness check above passes;
- Playwright's own environment guard passes again.

Run these phases only with the separate approval the Stage 3 plan requires (`docs/testing/stage3-execution-plan.md`):

```bash
E2E_RUN_ID=<id> npm run test:e2e:staging:phase:ci -- --phase=mutating-core --confirm-writes=mutating-core
E2E_RUN_ID=<id> npm run e2e:cleanup-run -- --apply --verify      # always afterwards
```

## What the local file may contain

Only the keys listed in `.env.e2e.staging.example`. The whole file is refused, and nothing is loaded from it, if it contains any of these:

- database URLs, or Stripe, Supabase, session or other server-side settings;
- per-run switches (`E2E_CONFIRM_WRITES`, `E2E_RUN_ID`, `E2E_ENABLE_STRIPE_TESTS`, ...);
- a live Stripe key or a Production hostname.

`.env` is never read by these commands.

## Unit tests for this tooling

```bash
npm run test:e2e:guard     # includes tests/safety/staging-check.unit.ts (stubbed network only)
```
