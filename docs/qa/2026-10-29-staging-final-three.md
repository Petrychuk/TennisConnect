# Staging regression: the last three failures (29 Oct 2026)

Baseline: `main` `56ff34d`. Run: 316 tests, 301 passed, 3 failed, 12 skipped, 0 flaky.
Branch: `fix/sec-011-contact-access`. One patch against `main` covers all three.

| Test | Class | Root cause | Fix |
|---|---|---|---|
| **SEC-011** | APP_BUG | `GET /api/coaches/:slug` decided contact access from `req.user`, the session copy built by `server/auth.ts` `deserializeUser`. That copy has no `isApproved` and no `isHidden`, so every approved member got `pending-approval`. | `currentViewer()` in `server/routes/coaches.ts` reads the signed-in account from the database. A missing account is treated as a guest. Details: `docs/qa/2026-10-29-coach-contact-security.md` §4. |
| **MSG-016** | TEST (helper) | `dismissCookieBanner()` waited the full 5 s for the cookie banner on every call. After the first acceptance, the consent is stored in `localStorage` for the browser context, and the banner never comes back. MSG-016 calls it four times, across three accounts, an admin step and two UI logins. The 28 Oct report shows 4 × 5.0 s "Wait for selector cookie-banner-accept-button" in a 56.5 s run. With slightly slower Staging responses that crossed 60 s. The messaging flow itself was never slow: the send, the toast and the delivery took about 3 s. | `tests/helpers/auth.ts`: if this context already has consent (same key and version check as the app's `getStoredConsent`), return at once. Otherwise wait for and accept the banner as before. The constants come from `client/src/lib/cookieConsent.ts`, which now exports the storage key. No timeout changed; every multi-step test gets faster. Expected MSG-016 time: about 36 s. |
| **PROD-SAFE-021** | **APP_BUG (UI)** | The project is on Tailwind 4, but `components/ui/select.tsx` still used v3 syntax: `max-h-[--radix-select-content-available-height]`. Tailwind 4 compiles that to `max-height: --radix-select-content-available-height;`, which is invalid, and the browser drops it. So the Select list had **no max height**. With a long list (all coach locations since the 28 Oct directory change), the dropdown runs past the window, or above it when it opens upward from a low trigger. Radix locks page scroll while a Select is open, so users couldn't reach those options; Playwright reported "element is outside of the viewport". | v4 syntax `max-h-(--radix-select-content-available-height)` → `max-height: var(...)`. The list is capped at the space Radix measures, and it scrolls. Same fix for every `-[--radix-…]` class in `components/ui` (select, popover, tooltip, dropdown-menu, menubar, hover-card, context-menu). In those it's the `origin` of the open animation, plus the context menu's max height. The test is unchanged: no `force`, nothing skipped. |

## Evidence

- **SEC-011:** control run. The route test file run against the unfixed route fails 4 tests, including the SEC-011 scenario. With the fix all 9 pass.
- **MSG-016:** step timings from `playwright-report-staging-v2.zip`, quoted above.
- **PROD-SAFE-021:**
  - Tailwind 4.3 compile: the old class gives `max-height: --radix-select-content-available-height;`, the new one `max-height: var(--radix-select-content-available-height);`.
  - Chromium check of a fixed list of 40 options at 1440×900, old vs new rule:
    - old: `maxHeight: none`, 1280 px tall, last option at y = 1880, **outside the viewport**;
    - new: `maxHeight: 276px`, last option at y = 876, reachable.
  - Guard: `uiConsistency.test.ts` fails on the old `select.tsx` and passes on the fix.

## Not changed (same Tailwind 3 syntax, follow-up)

- `pages/complete-profile.tsx`: `w-[--radix-popover-trigger-width]`. The country and city pickers fall back to the popover's default width instead of the trigger's. This page's layout was just approved, so it wasn't changed silently.
- `components/ui/calendar.tsx` (`[--cell-size]`) and `components/ui/chart.tsx` (`[--color-…]`): the same class of issue, with visible effects. Each needs a visual check.

## Validation

Here:

- `test:e2e:guard`: 162 / 162
- `test:ui`: 45 / 45
- server unit tests: 19 / 19
- route tests `coaches` 4/4 and `coachContact` 9/9, with an Express stand-in
- client bundle: 393 modules, 0 errors
- `--list`: 316 tests; Production: 33 tests in 1 file
- tsc on the changed files: no new errors

Full `npm run check` and `npm run build` need the real dependencies.

After deploying this branch to Staging, run only these three. PowerShell:

```powershell
$env:EXPECTED_DEPLOY_SHA = (git rev-parse HEAD)
npm run e2e:staging:check
npm run test:e2e:staging:phase:ci -- --phase=mutating-core --confirm-writes=mutating-core --grep "SEC-011 "
npm run test:e2e:staging:phase:ci -- --phase=hub-msg-admin --confirm-writes=hub-msg-admin --grep "MSG-016 "
npm run e2e:staging:auth-readonly -- --grep "PROD-SAFE-021 "
Remove-Item Env:EXPECTED_DEPLOY_SHA
```
