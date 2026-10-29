# Production-safe smoke suite: expansion to 33 tests (29 Oct 2026)

Branch: `qa/prod-safe-smoke-expansion`, from `main` `92c6f77` (the commit deployed to Production).
Target: `https://www.tennisconnect.com.au`, run only through `npm run test:e2e:prod-safe`.

## What changed

| File | Change |
|---|---|
| `tests/prod-safe/prod-safe.spec.ts` | 28 new tests, `PROD-SAFE-006` to `PROD-SAFE-033`. The existing five are unchanged. |
| `tests/safety/environment-guard.ts` | `PROD_SAFE_ALLOWLIST` lists the 28 new ids. The file list is unchanged: one file. |
| `tests/safety/prod-safe-suite.unit.ts` (new, in `test:e2e:guard`) | Source checks for the allowlisted file and behaviour checks for global setup and teardown on Production (below). |
| `tests/safety/staging-phases.ts` | The 28 new ids are in the existing `auth-readonly` phase: guest-only, no writes. `PROD-SAFE-001..005` stay in the Staging read-only set. |
| `package.json` | `test:e2e:guard` also runs `prod-safe-suite.unit.ts`. |

`playwright.config.ts`, the prod-safe fixture, the environment guard logic, global setup and teardown are **not** changed.

## Coverage

| Area | Ids | What is checked |
|---|---|---|
| Health, home (existing) | 001, 002 | `/api/health` matches the verified target; the homepage renders. |
| Navigation | 006, 007 | Desktop: each main-nav link (Players, Games, Coaches, Clubs, Travels, Articles) opens its page and is marked current; the logo goes home. Phone: the menu lists the six links and navigates, then closes. |
| Sign-in and reset | 008, 009, 010 | The sign-in form renders and `/api/auth/me` says guest. The forgot-password form opens; nothing is typed or sent. `/reset-password` without a token says "Invalid Reset Link" and shows no form. |
| Guest gates | 005 (existing), 011, 012, 013 | `/messages` and `/admin` are gated. Five Organiser Hub pages send a guest to `/auth`. Eight organiser, admin and inbox APIs answer 401 with only `{ message }`: no records or counts. |
| Play | 014-017 | The list equals `GET /api/play/sessions`. Typing a search filters with a GET and shows "no matches"; clearing it restores the list. The Format filter (Americano) sends `format=americano`, every returned session is Americano, and the count matches. Quick View opens for a listed event and offers a guest sign-in (or the partner's site), never Join. |
| Coaches (existing 003) | 018-022 | The default list equals the API total, across pages. A search finds a coach from the last page and shows the empty state for no match. "Under $70": the server's count equals parsing every coach's own rate text (`"$80/hr"` → 80) with the shared `parseHourlyRate`, and pressing it again lists everyone. The location filter lists only that location. A coach profile opens, and its Contact tab asks a guest to sign in. |
| Players (existing 004) | 023-025 | The list renders and search narrows it, with an empty state. "Looking to Play" sends `lookingToPlay=true` and lists exactly those players. A player profile opens with the player's name. |
| Clubs | 026, 027 | The list renders and search narrows it, with an empty state. A premium club's detail page opens. |
| Travel | 028-030 | Every active retreat from `/api/travel` is listed. Exactly the ended retreats carry "Archived" (same `isRetreatArchived` the page uses, Sydney calendar), and they come after upcoming ones. A retreat detail page opens. |
| Articles | 031, 032 | Every published article is listed, and search narrows the list with an empty state. An article page opens from its card. |
| Private data | 033 | Guest API contract (security fix of 29 Oct, `docs/qa/2026-10-29-coach-contact-security.md`): no directory entry and no coach profile carries `phone`, `email` or account fields; `contact` is `null` with `contactAccess: "sign-in"`; no marketplace item has `sellerEmail`. Checks keys only; no value is read into the report. **Passes only once the fix is deployed.** |

No fixed ids or assumed records: each test reads the environment with GET and compares the page with it. Tests that need a record that may not exist skip themselves with a reason: 017 (a session), 019 and 022 (a coach), 021 (a coach location), 023 (players), 025 (real players, not the demo cards), 027 (a premium club), 029 and 030 (a retreat), 032 (an article).

## Why it cannot write

- **Runtime (unchanged, every environment):** `tests/fixtures/prod-safe.ts` aborts any browser request that is not GET, HEAD or OPTIONS. A write aimed at the app fails the test. The `request` fixture's `post`/`put`/`patch`/`delete` throw.
- **Selection (unchanged):** on Production only `tests/prod-safe/prod-safe.spec.ts` can load, and only `@prod-safe` titles in the allowlist run. `--list` confirms 33 tests in 1 file, also with `--grep '.*'`.
- **Source (new, `prod-safe-suite.unit.ts`):** the allowlisted file must not contain any of these:
  - login, logout or registration calls;
  - test hooks or seeded credentials;
  - write requests, or API calls through the page's or context's own request client, which the browser route guard can't see;
  - a second context;
  - request rewriting;
  - uploads or payments;
  - submit, send, join or register clicks;
  - pressing Enter. On `/play`, Enter and the search button run the AI smart search, which is a POST.
  - typing an email address;
  - a runtime import from `@playwright/test`.
- **Global setup (new check):** on Production it sends only `GET /api/health`.
- **Global teardown (new check):** on Production it makes **no** network call, even with a test-hook secret, a run id and `E2E_CLEANUP_ON_TEARDOWN=1`. A control check shows the same teardown does call the server on Staging, so the Production result is meaningful.
- **Sessions:** guest requests don't create session rows (`saveUninitialized: false`, `server/auth.ts`). No public GET used here records views or writes data. The geocoding cache is written only on profile and admin saves.

## Validation

| Check | Result |
|---|---|
| `npm run test:e2e:guard` | 162 / 162 pass |
| `playwright test --list`, `TEST_ENV=production` | 33 tests, 1 file (also with `--grep '.*'`) |
| `--list`, staging / local | 315 tests, 41 files (286 before + 28 prod-safe + SEC-011) |
| Staging phase classification | every test classified exactly once (`staging-phases.unit.ts`) |

**Not run here:** the suite itself. This environment cannot reach Production or Staging, and has no app server. To run it, use PowerShell:

```powershell
npm run test:e2e:guard

$env:BASE_URL = "https://www.tennisconnect.com.au"
try {
    npm run test:e2e:prod-safe
}
finally {
    Remove-Item Env:BASE_URL -ErrorAction SilentlyContinue
}
npx playwright show-report
```

The HTML report is written to `playwright-report/`. Its metadata records `testEnv` and `target`. Run it locally first if you can (`npx playwright test tests/prod-safe` against `npm run dev`): the same fixture blocks writes there too.

## Findings

1. **Coach contact details were public through the API.** `GET /api/coaches/:slug` returned the whole `coach_profiles` row, including `phone` and `email`, to guests. **Fixed in the same branch**, see `docs/qa/2026-10-29-coach-contact-security.md`. `PROD-SAFE-033` guards it.
2. **Staging phase change:** the 28 new ids join the `auth-readonly` phase. The Staging read-only set (fixed at 32 ids) is unchanged.

Any failure on Production should be recorded here, with root cause and steps to reproduce: the test id, the URL, what the API returned compared with what the page showed, and the trace or screenshot from the report.
