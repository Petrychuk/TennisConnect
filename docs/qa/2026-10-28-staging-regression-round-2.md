# Staging E2E regression, round 2 (28 Oct 2026): root causes and fixes

Run: `playwright-report-staging-v2.zip`, Desktop Chrome against Staging.
281 tests: 232 passed, 37 failed, 12 skipped, 0 flaky.
Branch: `fix/staging-regression-round-2`, from `main` `941a63c` (PR #11).

The 37 failures come from **9 root causes**. Two were introduced by round 1 itself: the exact `'Message sent'` locator (root cause 5) and newest-first ordering exposing the rate bug (root cause 3).

| # | Root cause | Class | Tests |
|---|---|---|---|
| 1 | **Account switch race.** `loginWithCachedSession()` swapped cookies while the previous account's page was still open. Its polling kept running, and every authenticated response re-sets that account's cookie (`server/auth.ts` updates `lastActivity` on each request, so express-session rewrites the cookie). The player's cookie came back over the admin's. | TEST (helper) | ADMIN-001, ADMIN-007 (sidebar never appears: "You don't have admin privileges"), MSG-116 (`hide-user-*` missing), MSG-018 (`GET /api/admin/users` not OK), MSG-003 (the coach's inbox was really the player's, so no unread dot) |
| 2 | **Login limiter hit by worker restarts.** The cached session was keyed by `workerIndex`, which changes every time Playwright replaces a worker after a failure. Each replacement logged the admin in again, and after about 10 in 15 minutes the login limiter answered 429. | TEST (helper) | ORG-REPORT-010, ORG-REPORT-012, PLAY-002, PLAY-005, PLAY-006 |
| 3 | **Coaches missing from `/coaches`.** The page read the free-text hourly rate with `Number()`. `"$80/hr"`, which is the seed's format and close to the form's own placeholder "e.g. $80", becomes `NaN`, and `NaN <= maxPrice` is false, so the coach was dropped even with no price filter. It surfaced now because round 1's newest-first ordering put the seeded `$…/hr` coaches on page 1. It is also why coaches disappeared on localhost. | **APP_BUG** | PUBLIC-001, 002, 003, 004, MSG-012, MSG-SMOKE-002 |
| 4 | **`createSeason()` omitted `type`.** `seasons.type` is NOT NULL and the season form always sends one (default `social`). | TEST_OUTDATED | ORG-FLOW-001, ORG-RANK-004, ORG-RANK-006/007/008, ORG-REPORT-003/009, ORG-REPORT-004-007 |
| 5 | **Toast text locator.** Round 1 changed it to exact `'Message sent'`, but the quick-message modals title their toast `"Message sent!"`. Separately, `getByRole('region')` cannot see the toast list while a modal dialog makes the page `aria-hidden` (the failed delete in ADMIN-003). | TEST (round-1 regression) | MSG-005, 006, 007, 016, ADMIN-003 |
| 6 | **Cookie banner over the Filters footer.** Round 1 fixed the dropdown height; the footer now sits on screen, but the fixed cookie-consent banner is on top of it and took the clicks. Expected: consent comes first. | TEST_OUTDATED | SEARCH-030, 031, 032, 033, 034, 036, 037, 040 |
| 7 | **The same session appears twice on `/play`:** once in "Recommended for you", once in the results grid, so the locator matched two elements. | TEST_OUTDATED | PLAY-001 |
| 8 | **PLAY-004 used `play-page-filter-format`**, which no longer exists; the format filter is in the Filters panel and applies on "Show results". | TEST_OUTDATED | PLAY-004 |
| 9 | `net::ERR_NETWORK_IO_SUSPENDED`: Chrome reports this when the machine running the tests suspends its network (sleep or power saving), not when the server fails. | ENVIRONMENT | ORG-RANK-002/003 |

## Fixes

- **Root cause 1** (`tests/helpers/auth.ts`): `loginWithCachedSession()` navigates to `about:blank` before clearing and restoring cookies, so nothing from the old account can answer after the switch.
- **Root cause 2** (`tests/helpers/e2e-auth.ts`):
  - the state file is keyed by `parallelIndex`, which is stable across worker restarts;
  - a replacement worker validates the saved session with `GET /api/auth/me` (it must be the same account on the same server) and reuses it, otherwise it logs in.
  - The rate limiter is unchanged.
- **Root cause 3**:
  - `shared/coachDirectory.ts` (used by the API and the page): `parseHourlyRate()` reads the first number in the text (`"$80/hr"` → 80); `matchesMaxRate()` lists every coach when no price limit is set, and only known rates within the limit when one is. (`client/src/lib/coachRate.ts` re-exports them.)
  - `pages/coaches.tsx` shows "On request" instead of "$NaN" when there is no number.
  - See also "Coaches directory" below: the filters now run on the server.
- **Root cause 4** (`tests/helpers/organiser.ts`): `createSeason()` sends `type: 'social'` unless the test passes one.
- **Root cause 5** (messages, flows, admin-delete specs): `TOAST_LIST`, a CSS locator for the toast list that works while a dialog is open, plus `/^message sent!?$/i`.
- **Root cause 6** (`tests/public/hero-search.spec.ts`): `openHeroPage()` dismisses the cookie banner the way a visitor would. PLAY-004 does too.
- **Root causes 7-8** (`tests/play/play.spec.ts`): cards are scoped to `play-page-results`. "Never appears" checks (PLAY-002) stay page-wide. PLAY-004 uses Filters → Format → Show results.
- **Root cause 9:** no code change. Keep the runner machine awake for the run (or run in CI).

## Coaches directory: every coach by default, filters over the whole directory (follow-up, same branch)

Before: `/coaches` loaded one page of 16 from `GET /api/coaches` and applied search, location and price **in the browser to those 16 only**. A filter could say "No coaches found" while matches sat on page 2, the Location list only offered page-1 locations, and the page count ignored the filters.

Now:

- `GET /api/coaches?page=&limit=&q=&location=&maxRate=` filters the **whole** directory, then pages it (`shared/coachDirectory.ts`: `parseCoachDirectoryQuery`, `coachMatches`, `pageOfCoaches`). With no filters it returns every listed coach, newest first, 16 per page, including coaches whose rate has no number ("On request").
  - `q` matches name, title or location (case-insensitive, max 100 chars); `location` is exact; `maxRate` ≥ 150 (the slider's top) or junk = no limit; `location=all` = any.
  - The response adds `locations`: every location in the directory (not only the filtered result), for the Location filter.
  - `rate` in the response is unchanged (the coach's own text); a page past the end returns the last page.
  - Who is listed is unchanged: published, completed, approved, not hidden (`storage.getAllCoachesWithProfiles`). The public rate limiter is unchanged.
- `pages/coaches.tsx` sends the filters with the page; they settle for 300 ms (typing, slider), then the list restarts at page 1. A stale response is aborted. "No coaches found" waits until the filters have settled. An `sr-only` live region (`coaches-results-count`, `data-total`) announces the total.
- Tests:
  - `shared/coachDirectory.test.ts` (7, in `test:ui`): rates, no-filter = everyone across pages, filters over the whole directory, search fields, junk input, locations.
  - `server/routes/coaches.test.ts` (4, in `test:server-unit`): the real router over a loopback server with `storage` faked (40 coaches).
  - `uiConsistency.test.ts`: the page sends `q`/`location`/`maxRate`, resets to page 1, uses the API's locations, no page-only filtering.
  - Playwright (`tests/public/coaches-directory.spec.ts`, guest-only, GET-only): `PUBLIC-COACH-001` default list = API total and every page together = every coach; `-002` search finds a coach from the last page and clearing restores the total; `-003` every directory location is offered and the filter lists only that location; `-004` Under $70 filters the whole directory, pressing again lists everyone; `-005` a filter change on page 2 goes back to page 1. They are not in the Staging read-only allowlist (`tests/safety/staging-readonly.ts`); adding them is a separate reviewed decision.

## Not done / follow-up

- **Validation still to run:** `npm run check`, `npm run build`, `npm run test:server-unit` with real `express` installed, the targeted Playwright tests and the full Staging regression (no npm registry or Staging access from here).
