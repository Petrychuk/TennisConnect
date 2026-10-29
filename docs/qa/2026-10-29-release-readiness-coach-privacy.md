# Release readiness: coach contact privacy (29 Oct 2026)

Candidate branch: `fix/coach-contact-privacy`, from `main` `813ceb1`.

- `main` already contains the Production-safe expansion. Its v1 patch is identical to commit 813ceb1 and is **not** reapplied.
- This branch = `prod-safe-smoke-expansion-v2.patch` + the second security pass.

Status: **not ready for Production yet**. Staging validation is still open (the table below).

## What the release contains

| Area | Change |
|---|---|
| Coach contact privacy | `GET /api/coaches/:slug` returns allowlisted fields only. Phone and email are in `contact`, only for the coach, admins and approved, active, non-hidden members. |
| Profile visibility | One rule for the directory and the profile API. An unapproved, hidden, draft or inactive coach is a 404 for guests and members. The coach and admins can still open it. |
| Account metadata | `toPublicUser()` is an allowlist. No more `failedLoginAttempts` or `lockedUntil` (players and coaches). |
| Marketplace | Public listings no longer carry `sellerEmail` (the login email). |
| Organisations | Business contacts unchanged (intentional, entered by the organiser). |
| Inbox (MSG-003, MSG-101) | Phones see their inbox list. A slow thread can no longer replace the one the reader opened. |
| Tests | `SEC-011` and `SEC-012`; stricter `SEC-001` and `SEC-002`; `PROD-SAFE-033`, extended; unit and route tests; MSG-011/018/116 and PLAY-001 fixed |
| Future | Coach "Contact visibility" preference: hook only, no column or UI (`docs/product/coach-contact-visibility-preference.md`) |

### Changed files (22)

**Server:**
- `server/lib/publicProfiles.ts` (new)
- `server/lib/sanitizeUser.ts`
- `server/routes/coaches.ts`
- `server/routes/profileMarketplace.ts`
- `server/storage.ts`: one directory condition

**Client:**
- `client/src/pages/coach-profile.tsx`
- `client/src/components/messages/MessagesInbox.tsx`
- `client/src/pages/marketplace.tsx`

**Tests:**
- `server/lib/publicProfiles.test.ts` (new)
- `server/routes/coachContact.test.ts` (new)
- `client/src/lib/uiConsistency.test.ts`
- `tests/security/security-regression.spec.ts`
- `tests/messages/messages.spec.ts`
- `tests/messages/messages-flows.spec.ts`
- `tests/play/play.spec.ts`
- `tests/prod-safe/prod-safe.spec.ts`

**Guards and config:**
- `tests/safety/environment-guard.ts`: allowlist, `PROD-SAFE-033`
- `tests/safety/staging-phases.ts`: `PROD-SAFE-033` in `auth-readonly`; `SEC-011` and `SEC-012` in `mutating-core`
- `package.json`: `test:server-unit` list

**Docs:**
- `docs/qa/2026-10-29-coach-contact-security.md`
- `docs/qa/2026-10-29-prod-safe-smoke-expansion.md`
- `docs/qa/2026-10-29-release-readiness-coach-privacy.md` (this file)
- `docs/product/coach-contact-visibility-preference.md`

Not changed: `playwright.config.ts`, `tests/fixtures/prod-safe.ts`, environment-guard logic, global setup and teardown, rate limiters, authentication.

## Validation

| Check | Here | Your side (required) |
|---|---|---|
| `npm run check` | Not possible: no npm registry, so no `@types`. No new errors in the changed server and test files. | ☐ |
| `npm run build` | Client bundle only: 393 modules, 0 errors | ☐ |
| `npm run test:ui` | **44 / 44** | ☐ |
| `npm run test:server-unit` | Unit tests **19 / 19**. Route tests `coaches` 4/4 and `coachContact` 6/6 ran on the real router, but with a minimal Express stand-in. | ☐ with real Express |
| `npm run test:e2e:guard` | **162 / 162** | ☐ |
| `playwright --list` | 316 tests in 41 files; Production: 33 tests in 1 file | — |
| Staging, the six earlier failures: MSG-003, MSG-101, MSG-011, MSG-018, MSG-116, PLAY-001 | Not reachable from here | ☐ must pass |
| Staging security: SEC-001, SEC-002, SEC-002b, SEC-011, SEC-012 | Not reachable | ☐ must pass |
| Staging coach and profile specs: `coaches-directory`, `coach-complete-and-edit`, `edit-coach-profile`, `MSG-001`, `MSG-002`, `MSG-011` | Not reachable | ☐ |
| Staging read-only + `prod-safe` against Staging | Not reachable | ☐ |
| Production, after the approved deploy: `npm run test:e2e:prod-safe` (33) and a manual guest `GET /api/coaches/<slug>` | — | ☐ after approval |

Suggested Staging order:

1. `npm run test:e2e:staging:smoke`
2. The `mutating-core` phase, which includes SEC-011 and SEC-012
3. The `hub-msg-admin` phase, which includes the MSG tests and PLAY-001
4. The read-only set

Record failures, skips and run ids in `docs/qa/2026-10-29-coach-contact-security.md`.

## Behaviour changes users will notice

- A signed-in account that is **not approved yet** no longer sees a coach's phone and email. It sees "appear once your account is approved", and can still send a message.
- An unapproved or hidden coach's profile link now returns to `/coaches` for everyone but the coach and admins. Before, it opened.
- On phones, the inbox list shows instead of "No messages yet".

## Remaining risks

1. **Player profiles by slug:** `GET /api/players/:slug` still serves hidden and unapproved players. Same class of issue; needs a follow-up ticket.
2. **Validation:** the route tests used an Express stand-in, and nothing ran against Postgres or a browser here. Staging is the first real run.
3. **Approved-members rule:** members who aren't approved yet lose in-page contacts. This is the agreed policy; support may get questions.
4. **Business contacts:** organisation phone and email stay public by design. Needs a product sign-off.

Production deployment requires explicit approval after Staging passes.
