# Staging E2E infrastructure

Operational guide for running Playwright regression against Railway Staging
(`https://tennisconnect-staging.up.railway.app`). Production is never a
target: the environment guard (`tests/safety/environment-guard.ts`) refuses it
for everything except the read-only `@prod-safe` allowlist.

Built in reviewable stages. This document grows with each stage.

| Stage | Scope | Status |
|---|---|---|
| 1 | Email capture, Stripe test-mode safeguards, regression preflight | In review |
| 2 | Dedicated test accounts and deterministic fixtures | Planned |
| 3 | Run-scoped cleanup and recovery | Planned |
| 4 | Test audit and migration of the 192 existing tests | Planned |
| 5 | Manual full-regression workflow | Planned |

## Stage 1 — safety foundations

### Email: captured on Staging, never delivered

All outgoing email goes through `sendEmail()` in
`server/services/emailService.ts`. The transport is decided per send by
`resolveEmailTransport()` (`server/services/emailCapture.ts`):

| Environment | `EMAIL_TRANSPORT` | Result |
|---|---|---|
| `DB_ENV=production` | anything | Delivered through Resend (unchanged) |
| `DB_ENV=staging` | unset | **Captured** (default) |
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
