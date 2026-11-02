# Production smoke policy

Updated 30 Oct 2026. Production smoke tests check that critical public pages are **available and usable**. They don't repeat the Staging regression.

## Rules

1. Only tests in `PROD_SAFE_ALLOWLIST` (`tests/safety/environment-guard.ts`) can run with `TEST_ENV=production`. Today that's 33 tests (PROD-SAFE-001…033) in one file, `tests/prod-safe/prod-safe.spec.ts`. `@smoke` alone never qualifies.
2. **Guest only, read only.** The prod-safe fixture (`tests/fixtures/prod-safe.ts`):
   - aborts every non-GET/HEAD request the page makes;
   - refuses `request.fetch()` with any other method;
   - fails the test if any write was attempted.
3. Never on Production:
   - registering users;
   - verification, password-reset or invitation emails;
   - creating organisations, sessions, tournaments or registrations;
   - messages or announcements;
   - profile or permission changes;
   - uploads or deletions;
   - check-in, scoring, cancellation or payment;
   - test hooks or cleanup.

   The guards in `TEST_ENVIRONMENTS.md` (controls 8–11) refuse these in code, not just by convention.
4. Production has **no** test accounts. Staging credentials, baseline `e2e-*` accounts and run accounts are refused there. Authenticated Production smoke tests would need a separate, explicit approval and dedicated identities.
5. A scenario that can't be checked without a write is tested on Staging only.
6. Running the suite needs explicit approval each time: `npm run test:e2e:prod-safe` with `BASE_URL` set to the Production host. Listing it (`--list`) is safe.

## Second suite: internal TC Live validation (`@prod-live-internal`)

A separate, opt-in suite (TC Live v1, `docs/live/LIVE_RUNBOOK.md`). It's the only Production suite that writes, and only to the Live routes of **one internal test session**. It is never part of the prod-safe run:

- selected only with `E2E_PROD_SUITE=prod-live-internal`, every `E2E_PROD_LIVE_*` variable, and `E2E_CONFIRM_PROD_LIVE_INTERNAL` equal to the session id;
- refused on any non-Production target; the two suites are never mixed (checked again in global setup);
- the fixture lets a write through only if it's sign-in/out or a Live control route of that session. Everything else is aborted and fails the test. Every write goes to `test-results/prod-live-internal-audit.jsonl`. DELETE is never allowed and nothing is cleaned up;
- the server is the real barrier: the session must be `isInternalTest`, which only internal accounts (`TC_INTERNAL_TEST_EMAILS`) can create or join, and is invisible to the public;
- runs only after Staging sign-off and explicit approval. No retries.

## Coverage on Production

| Area | Tests |
|---|---|
| Health and target | PROD-SAFE-001 |
| Home, navigation, mobile menu | 002, 006, 007 |
| Sign-in, forgot / reset password pages (nothing sent) | 008, 009, 010 |
| Access gates: messages, admin, Organiser Hub, organiser/admin/inbox APIs | 005, 011, 012, 013 |
| Play: list, search, format filter, Event Quick View (guests can't join) | 014–017 |
| Coaches: directory, search, price and location filters, profile with private contacts hidden | 003, 018–022, 033 |
| Players: directory, search, Looking to Play, profile | 004, 023–025 |
| Clubs: directory, search, premium club details | 026, 027 |
| Travel & Retreats: listings, archived retreats, details | 028–030 |
| Articles: directory, search, article | 031, 032 |

## Reviewed for this change (30 Oct 2026)

- No Production test added or changed. The selection is still 33 tests in 1 file (`--list` with `TEST_ENV=production`).
- Organiser Hub Phase 2 changes visible to guests:
  - category and format badges on the Play session page;
  - policies on the Play session page and in Event Quick View;
  - the organiser link to `/organisations/:slug`;
  - contacts on the organisation page.

  All are GET-only. **Candidate** for a future reviewed addition: a guest opening a listed session's details page and its organiser's public page. Not added without approval.
- Live entry points are hidden on Production (`/api/health` `dbEnv`). The Staging specs ORG-WS-002 and ORG-WS-004 assert the hiding and the 404 off Staging, when run against a non-Staging server.
