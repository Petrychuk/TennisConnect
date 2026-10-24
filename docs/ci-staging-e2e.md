# CI against Railway Staging — current state and Full E2E design

## What runs today

| Job | Trigger | Touches Railway? | Secrets |
|---|---|---|---|
| Typecheck, dependency audit, secret scan | push to `main`, every PR | No | None |
| Playwright environment guard (`npm run test:e2e:guard`) | push to `main`, every PR | No | None |
| Test-hooks security (`npm run test:test-hooks`) | push to `main`, every PR | No | None |
| **staging-smoke** | Manual only (`workflow_dispatch`) | Yes, read-only | None |

`staging-smoke` runs only the reviewed list in `tests/safety/staging-smoke.ts`
(HOME-001, PUBLIC-SMOKE-001, PUBLIC-SMOKE-002, MSG-SMOKE-001): public pages,
guest views, no login, no writes. It never uses `--grep @smoke`, because
`@smoke` also covers registration (REG-001/REG-002) and authenticated flows.

## Deployed-commit verification

Railway Staging auto-deploys `main`. A healthy endpoint does not prove
*which* code is running, so before any test:

1. The expected SHA (workflow input, or the dispatched commit) must be a full
   40-character SHA **on `main`**.
2. `GET /api/health` on Staging must return `dbEnv: "staging"` **and**
   `commit: <that SHA>` (`tests/safety/deployed-commit.ts`). The job waits up
   to `wait_minutes` for Railway to finish deploying, then fails.
3. Playwright's global setup re-checks the same thing (`EXPECTED_DEPLOY_SHA`).

`commit` comes from `RAILWAY_GIT_COMMIT_SHA`, which Railway sets **only for
deploys triggered from GitHub** ([Railway variables reference](https://docs.railway.com/variables/reference)).
It is exposed only on non-production instances (`server/lib/health.ts`).

**Known gaps (all fail closed):**

- Until a build containing the `commit` field in `/api/health` is deployed to
  Staging, every `staging-smoke` run fails with "does not report a deployed
  commit". Expected — merge to `main`, let Railway deploy, then run.
- A manual Railway **Redeploy**, a rollback, or a CLI (`railway up`) deploy may
  not set `RAILWAY_GIT_COMMIT_SHA` (several Railway Station threads report
  this). The check then fails instead of guessing. Redeploy from a GitHub
  push, or extend the check (below).
- A rollback to an older deployment reports the older SHA → mismatch → fail.
  Correct behaviour.

**Optional stronger cross-check (needs new configuration, not done):** query
Railway's public GraphQL API with a *project token scoped to the staging
environment* for the latest successful deployment of the service and compare
its commit with the SHA from `/api/health`. Needs, as a GitHub environment
secret: `RAILWAY_STAGING_TOKEN` (read-only project token), plus the project,
environment and service IDs. This would also catch "health says X but Railway
is mid-deploy of Y". Not required for read-only smoke.

Not verified from this workspace: whether Railway's GitHub integration posts
GitHub Deployments / deployment statuses for this repo. If it does, a future
trigger could be `deployment_status` (state `success`, environment = staging)
instead of manual dispatch — the commit check above would still run.

## Future Full E2E jobs (design only — not wired up)

Registration, authentication, messaging, organiser sessions, scoring and CRUD
write data. They must not run until isolated test data and cleanup exist.

### Prerequisites

1. **Test-data isolation**
   - Every account created by E2E uses the reserved `@tennisconnect.test`
     domain (already the case) and is `isTestUser=true` (already enforced on
     dev/staging registration and in `seed-players`).
   - Tag each run: put `GITHUB_RUN_ID` in generated emails/names
     (e.g. `e2e_<runId>_<rand>@tennisconnect.test`) so a run's data can be found
     and cleaned up without touching anyone else's.
   - Organiser Hub data only via test users and organizations they own
     (already enforced by `seed-session`).
2. **Cleanup**
   - New authenticated test hook, e.g. `POST /api/test-hooks/cleanup-run`
     `{ runTag }`: deletes only `isTestUser=true` users whose email matches the
     run tag, and their dependent rows (sessions, registrations, matches,
     messages, organizations, uploads). Same guard as other hooks
     (dev/staging only, secret required), hard limits, dry-run mode, and its
     own unit tests proving it cannot delete non-test data.
   - Scheduled sweeper for leftovers older than N days (same boundary).
3. **Seeded fixtures** on Staging for login-based tests: the Stage 2
   `e2e-*@tennisconnect.test` accounts (passwords in `E2E_*_PASSWORD`)
   created by the operator seed `server/seeds/e2e/` (`npm run
   e2e:seed:staging`), all `isTestUser=true`. The old `TEST_*_EMAIL`
   variables are only honoured for `TEST_ENV=local`. Run cleanup and
   phases: see `docs/staging-e2e-infrastructure.md` (Stage 3).

### Job layout

```yaml
staging-e2e:
  if: github.event_name == 'workflow_dispatch' && inputs.suite != ''
  environment: staging          # GitHub environment: required reviewers,
                                # secrets scoped to this environment only
  needs: []                     # independent of PR jobs
  concurrency: { group: staging-e2e, cancel-in-progress: false }
  strategy:
    max-parallel: 1             # one writer against Staging at a time
    matrix:
      suite: [auth, messaging, organiser, scoring, crud]
  env:
    TEST_ENV: staging
    BASE_URL: https://tennisconnect-staging.up.railway.app
    E2E_RUN_TAG: ${{ github.run_id }}
  steps:
    # 1. resolve + verify expected commit on main (same as staging-smoke)
    # 2. npm run e2e:verify-staging-deploy
    # 3. run the suite (explicit spec list per suite, not tag greps)
    #      env: E2E_TEST_HOOK_SECRET / TEST_* from environment secrets
    # 4. cleanup-run (if: always())
    # 5. upload report (traces must not contain secrets - hook calls use
    #    Node fetch, see tests/helpers/test-hooks.ts)
```

### Rules that must hold

- Never on `pull_request` / `pull_request_target`; secrets only through the
  protected `staging` GitHub environment.
- Never `ALLOW_PROD`; never a Production URL or Production credentials;
  the environment guard already rejects both.
- `E2E_TEST_HOOK_SECRET` only in jobs that need hooks; read-only smoke never
  gets it.
- Each suite is an explicit list of spec files, reviewed like
  `tests/safety/staging-smoke.ts`.
