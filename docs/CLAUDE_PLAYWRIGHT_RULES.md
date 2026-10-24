# TennisConnect — Claude AI Rules for Playwright Test Automation
**Updated:** 24 October 2026  
**Purpose:** Paste into Claude project instructions or a dedicated repository rule file after review.

## Mandatory principles

1. **Safety first.** Never run or generate a test that can alter Production data. Production is restricted to explicitly allowlisted, verified read-only `@prod-safe` tests. Preserve the existing environment guard; never bypass it using another config, custom URL or disabled checks.
2. **Understand the code before editing.** Inspect `playwright.config.ts`, test fixtures, relevant API routes, authentication, test hooks, existing specs and environment setup. Reuse existing helpers; avoid duplicate utilities.
3. **Tests must be deterministic and isolated.** Every stateful test creates its own data or receives uniquely scoped fixtures. Never rely on shared mutable users, messages, sessions, clubs or organisations.
4. **Use safe test identities.** Use `@tennisconnect.test` only in controlled non-Production environments with outbound email suppressed. Never use `@test.com`, `@mail.com`, arbitrary real email domains, or real user accounts.
5. **Cleanup is mandatory.** Track every created entity by test/run ID; remove only test-owned entities. Cleanup must run even if the test fails. Do not delete real or pre-existing data; do not create broad delete endpoints.
6. **Protect secrets and personal data.** Load credentials from dedicated local E2E configuration or protected GitHub environment secrets. Never hard-code secrets, write them to Git, print them, or expose them in traces, screenshots or reports. Prefer API authentication/storage state over typing passwords in recorded UI flows.
7. **Use the right test layer.** Prefer pure unit tests for business rules, route/integration tests for API validation and authorization, and Playwright for user-visible journeys. Avoid slow E2E tests for behaviour that is adequately covered at lower layers.
8. **Use meaningful assertions.** Check the expected status, data, permissions and UI outcomes. Do not accept `page did not navigate to /500` as a sufficient security assertion. Check denied access, ownership and absence of leaked fields where relevant.
9. **Prefer stable Playwright locators.** Use `getByRole`, `getByLabel`, `getByText` where unambiguous, or `data-testid` where needed. Avoid brittle CSS, indexes, arbitrary sleeps and hard-coded timeouts. Wait for observable UI/network conditions.
10. **Use descriptive test names.** Keep TennisConnect IDs (`AUTH-`, `REG-`, `ACCESS-`, `MSG-`, `ORG-`, `PLAY-`, `PROFILE-`, `SEC-`, `SUPPORT-`) and unique IDs. Describe expected behaviour in plain English.
11. **Tag accurately.** `@smoke` means fast critical-path coverage, not necessarily read-only. Mark read-only Staging eligibility separately and enforce it with an explicit allowlist. `@prod-safe` must never create, update, delete, send messages, initiate payments, or trigger outgoing emails.
12. **No unsafe retries.** For mutating Staging tests, default to zero retries until idempotency and cleanup are verified. Limit concurrency to prevent collisions and auth rate limits. Never disable security/rate limiting in Production to make tests pass.
13. **Payments and communications require explicit isolation.** Stripe Checkout tests must use test keys and test data, never live payment keys. Registration and password-reset tests must not send real email to external addresses.
14. **Verify target before any run.** Confirm `TEST_ENV`, `BASE_URL`, `/api/health`, `DB_ENV`, and deployed SHA as appropriate. If they disagree or cannot be verified, fail closed.
15. **Keep scope small.** Do not modify unrelated application code, schema, migrations, CI, secrets or Railway variables while writing tests without explicit permission.
16. **No autonomous deployment.** Never commit, push, merge, deploy, reset databases or trigger destructive Staging runs without explicit approval.

## Before implementing a new test

Provide a short test plan containing:
- feature and test IDs;
- risk and target environment;
- fixtures/users/data to be created;
- whether the test sends emails, messages, payments or uploads;
- cleanup strategy;
- assertions and expected outcomes;
- safe run command and required environment variables (names only, not values).

## After implementing a test

- Show exact changed files and why each changed.
- Run static checks and relevant local tests if the environment is available; otherwise say clearly **not run**.
- Confirm tests are isolated, safe on their intended environment, and do not leak secrets.
- Provide pass/fail counts and a Playwright HTML report location if actually generated.
- Do not call a test 'passed' based only on code review, `--list`, or type checking.
- Do not silently weaken assertions, skip failing tests, increase timeouts, add retries, or bypass auth/rate limits to obtain green results.

## Current known migration tasks (do not silently implement)

- 192 Playwright tests / 44 files inventoried on 24 Oct 2026.
- 36 provisionally read-only Staging-safe; 115 need preparation; 41 need rewrite/removal.
- Replace seeded `@test.com` accounts; prevent Resend deliveries; inspect Production-to-Staging data sync.
- Implement scoped cleanup and isolated credentials; address rate limits and unnecessary auth setup tests.
- Rewrite security payload tests, remove example/debug specs, and correct AUTH-011.
- Preserve existing Playwright HTML reports; add GitHub Actions artifacts only when requested.

**Stop and ask before proceeding** whenever a proposed test could access Production, send an email, create a Stripe session, delete shared data, or expose personal information.
