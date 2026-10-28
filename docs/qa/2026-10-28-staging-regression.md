# Staging E2E regression, 28 Oct 2026: root causes and fixes

Run: Desktop Chrome against `https://tennisconnect-staging.up.railway.app`, deployed SHA `a48b708` (main after PR #10).
280 tests: 201 passed, 67 failed, 12 skipped, 0 flaky.
Branch: `fix/staging-regression-and-covers` (from `a48b708`).

Classes: `APP_BUG`, `TEST_OUTDATED`, `TEST_DATA`, `ENVIRONMENT`, `FLAKY`.

The 67 failures come from **14 root causes**. The biggest cause, the HTML-instead-of-JSON response, accounts for 17 failures.

## 1. Organiser Hub and Play: HTML instead of JSON (17 tests)

ORG-AUTH-001, ORG-FLOW-001/003, ORG-RANK-002/003, 004, 006/007/008, ORG-REPORT-003/009, 004-007, 010, 012, PLAY-001 to PLAY-006.

| | |
|---|---|
| Request | `POST /api/organizations`, from `tests/helpers/organiser.ts` `becomeOrganiser()` |
| Status | 200, `text/html`, body = `index.html` |
| Root cause | **TEST_OUTDATED** (wrong path since the helper was written in 3d6abe9). The endpoint is `POST /api/organizer/organizations`. The other helpers (admin and messages specs) already used the right path. |
| Why it looked like a parse error | **APP_BUG**: an unknown `/api/*` path fell through to the SPA catch-all (`server/static.ts`, `server/vite.ts`) and returned 200 + `index.html` instead of a 404. |
| Fix | `tests/helpers/organiser.ts`: the correct path, plus a check that the 2xx response is JSON. `server/index.ts` + `server/lib/apiNotFound.ts`: `app.use("/api", apiNotFound)` after all API routes, so any unknown API path is now `404 {"message":"Not found: POST /api/..."}`. Unit test: `server/lib/apiNotFound.test.ts`. |

## 2. Public search, filters, pagination

| Tests | Class | Root cause | Fix |
|---|---|---|---|
| SEARCH-011, 016, 021, 058, 086 | **APP_BUG** | Coaches, Clubs, Travels, Articles and Players showed "No … found" while the list was still loading. The test saw that empty state, counted 0 as "all results", and was later contradicted by the loaded cards. The video shows it: the empty state appears, then the cards. | The empty state shows only after the first load; the site loader shows while loading. Files: `pages/coaches.tsx`, `partners.tsx`, `clubs.tsx`, `travel.tsx`, `articles.tsx`. Guard test in `uiConsistency.test.ts`. |
| SEARCH-030 to 034, 036, 037, 040 | **APP_BUG** | On desktop the Filters dropdown was capped at `80vh` and opens under a button low in the hero. On an 800px-tall window its "Show results" footer hung below the bottom edge and could not be clicked ("element is outside of the viewport", 60 s). A real user on a laptop could not reach it either. | `components/shared/hero-filters.tsx`: `max-h-[min(36rem, var(--radix-popover-content-available-height))]`. The footer stays on screen and the fields scroll instead. |
| SEARCH-079, 084 | **TEST_OUTDATED** | The trigger's accessible name was read while the phone filter modal was still open. A modal makes the rest of the page `aria-hidden`, so the name was `""`. The name itself is correct (`Filters`, `Filter clubs`). | Close the panel ("Show results") before asserting. |
| SEARCH-004, 009, 014, 019, 024, 029 | **TEST_OUTDATED** | v10 changed the accent; `--primary-text` is now `rgb(88, 113, 20)`. The test hard-coded the old `rgb(85, 118, 10)`. | Resolve `--primary-text` in the page and compare with it. The 1px width and "no outline ring" checks are unchanged. |
| SEARCH-060 | **ENVIRONMENT** | The lazy `/coaches` route chunk took more than 5 s on Staging (the screenshot shows the route loader), so the first assertion ran before the page existed. | `openHeroPage()` waits for the page's search pill (a real element, up to 20 s) after `goto`. The underlying slowness is addressed in section 7. |
| SEARCH-017 | **FLAKY** (unconfirmed) | Clubs: the Search button scrolled to the results, but Enter after `scrollTo(0,0)` did not (video). Not reproducible here; Enter works the same on the other pages through the same `HeroSearch` form. | None. Re-run with a trace. |
| PUBLIC-003, PUBLIC-007 | **TEST_OUTDATED** + **APP_BUG** | Test: it read the first card right after clicking "next", before page 2 had rendered (the pager marks page 2 immediately). App: `getAllPlayers()` and `getAllCoachesWithProfiles()` had no `ORDER BY` while the route paginates with `slice()`, so Postgres may return a different order per query and page 2 can repeat or skip people. | Test: wait for the `page=2` response and assert the first card changes, with auto-retry. App (`server/storage.ts`): `.orderBy(desc(users.createdAt), desc(users.id))` for players, players looking to play, and coaches. **Visible change: directories list newest members first.** |

## 3. Messages

| Tests | Class | Root cause | Fix |
|---|---|---|---|
| MSG-103, 104, 108 (and latent in every count) | **TEST_OUTDATED** | The 5 Sep inbox redesign gave each row's delete button `message-item-delete-<id>` and its unread dot `message-item-unread-<id>`. `[data-testid^="message-item-"]` therefore counted each conversation two or three times (5 for 2, 2 for 1). | `CONVERSATION_ROW` (`tests/helpers/messages.ts`) matches the row buttons only. Used in the messages, flows, smoke and prod-safe specs. |
| MSG-104, MSG-003b | **TEST_OUTDATED** | A brand-new account has an unread "Welcome to Tennis Connect" message (MSG-108 itself checks this). A page-wide "0 unread" can never hold. | The unread check is scoped to the conversations the test started. |
| MSG-101, 102 | **TEST_DATA** | Subject `'Hi'`; `messageSchema` needs 3+ characters, so the client rejected it with a toast and never sent a POST, and `waitForResponse` timed out after 60 s. | `'Hello'`. |
| MSG-101, MSG-003b | **TEST_OUTDATED** | Player profiles have no Contact tab since the player-profile redesign; the test waited for `contact-tab`. | `sendPlayerProfileMessage()` (the "Message" modal) for player targets. |
| MSG-001 (and the same pattern in ADMIN-003, toasts in MSG-103 and ADMIN) | **TEST_OUTDATED** | `getByText(/message sent/i)` matched the toast and the toast's aria-live announcer (strict mode). | The exact toast title, or the "Notifications" region. |
| MSG-003 | **APP_BUG** + **FLAKY** test | On open, the inbox auto-selects the newest conversation and marks it read. On phones it also switched straight to the chat view, so phone users never landed on their list, and the newest message was marked read unseen. On desktop the new conversation's unread dot existed only for a moment, which the test raced. | `MessagesInbox.tsx`: auto-open only at ≥1024px, in both auto-select paths. MSG-003 checks the unread dot at phone width and waits for the mark-read PUT before reloading. |
| MSG-002, 016, 115, 116, AUTH-012, AUTH-014 | **TEST_OUTDATED** + **APP gap** | `logout()` clicks the header's profile menu, but `/complete-profile`, where `registerPlayer()` leaves a new account, has no site header (it never had one), so it waited 60 s. `login()` treated the `/complete-profile` redirect for an incomplete account as a failure, although that redirect is exactly what AUTH-014 requires. The page also had no way to sign out at all. | `complete-profile.tsx`: a "Sign out" button (`complete-profile-logout`). `logout()` uses it when there is no header; `login()` accepts the `/complete-profile` redirect. |
| MSG-017, MSG-018 | **APP_BUG** (ordering) + **TEST_DATA** | The approved target was not on page 1 of `/players`: the unordered query plus many residual approved test players on Staging. | The ordering fix in section 2 (newest first) puts the new target on page 1. |
| MSG-106, 110, 111, 112, 115, 116 | **ENVIRONMENT** | Multi-account flows (2 or 3 accounts registered and verified through the UI, plus admin steps) take 55-78 s on Staging against a 60 s budget. MSG-111/112 hit the timeout mid-step. | `test.slow()` on these tests only (3x), with the measured durations in the comment. Follow-up: create accounts through the API instead of the UI. |

## 4. Authentication and profile

| Tests | Class | Root cause | Fix |
|---|---|---|---|
| AUTH-011 | **TEST_OUTDATED** | Email uniqueness **is** case-insensitive: `getUserByEmail` compares `lower(email)`, and new rows are stored in lower case. Since 7334421 (18 Sep, user-enumeration fix) a duplicate signup deliberately returns the same `201 "check your email"` as a new one and e-mails the existing owner instead. The test still expected the old leaking `400 "already exists"`. | Assert the generic 201, that the message doesn't reveal the duplicate, and that the "Someone tried to sign up…" alert reached the existing lower-case address (captured e-mail), which is only sent from the duplicate branch. |
| AUTH-012, AUTH-014 | **TEST_OUTDATED** | `logout()` from `/complete-profile` (see section 3). | As in section 3. |
| PROFILE-004, PROFILE-012 | **APP_BUG** | `coach-profile.tsx` saves by sending back the whole loaded profile. A newly onboarded coach's empty fields are `null` (and the e-mail form default is `""`), but the server schema accepted only strings or a missing key: `400 Invalid input`. A new coach could not save any edit. | `server/lib/coachProfileUpdate.ts`: `null`/`""` means empty (stored as null) for nullable columns; `title`/`location` treat `null` as "not sent" and still reject `""`; e-mail is still validated when given; rating/reviews are still never accepted. Unit test: `coachProfileUpdate.test.ts`. |
| PROFILE-011 | **TEST_OUTDATED** | `toHaveClass(/opacity-50/)` also matches the `disabled:opacity-50` variant every Button now carries, so "not dimmed" could never pass. | Match a standalone `opacity-50` class. |

## 5. Admin user management

| Tests | Class | Root cause | Fix |
|---|---|---|---|
| ADMIN-001, 005, 007 | **TEST_OUTDATED** (helper) | After `registerPlayer()`, switching to the cached admin session added the admin cookie on top of the browser's player session. `/admin` then showed "Admin Access Required" (screenshot), so the sidebar link never appeared. | `loginWithCachedSession()` clears the context's cookies before restoring the cached one. `test.slow()` for these 65-78 s flows. |
| ADMIN-003 | **TEST_OUTDATED** | Toast text matched twice (strict mode). The ownership restriction itself works: the toast says why, and the row stays. | Scoped to the toast list. |

## 6. Access control (ACCESS-004)

Coach → `/admin` is restricted in two places:

- **Client:** the page checks `user.isAdmin` from `/api/auth/me` and shows "Admin Access Required".
- **Server:** every `/api/admin/*` route goes through `requireAdmin` (403 for a signed-in non-admin); `adminDiscovery` applies it at router level.

ACCESS-004 was excluded from this run, so its earlier failure isn't in the report.

The test now also asserts the API refuses the coach: `GET /api/admin/users` → 403. ACCESS-003 (player) gets the same check. **Re-run needed.**

## 7. Slow hero images and pages on desktop (not a test failure, investigated on request)

- **Late discovery.** The hero photo of Players, Coaches and Articles was only requested after the main JS and the lazy route chunk had loaded. Only `/`, `/clubs`, `/travels` and `/play` preloaded theirs.
- **Oversized files.** Desktop always downloaded the 1774-1983px originals: 101-217 KB, about 800 KB for the six heroes.
- **No caching.** Hashed JS/CSS chunks were served with `max-age=0`, so every navigation revalidated each lazy chunk. SEARCH-060 shows a route chunk taking more than 5 s.

Fixes:

- `components/shared/hero-photo.tsx` + `lib/heroImages.ts`: every hero ships in 900/1280/1920px WebP (quality 72) with `srcset` + `sizes`, plus the cropped mobile photo where a page has one.
  - Desktop 1440px: Coaches 101→61 KB, Players 140→80, Articles 153→96, Clubs 217→138, Travels 143→123, Games 149→131.
  - Phones: 24-40 KB.
- `client/index.html` preloads the hero for all six pages with the same `imagesrcset`. Checked in Chromium at 1440/1280@2x/390@3x: exactly one hero request per page, and it is the image actually shown. `uiConsistency.test.ts` keeps the table and the files in sync.
- `server/static.ts` + `server/lib/staticCache.ts`:
  - hashed `/assets/*-<hash>.js|css|…` are `public, max-age=31536000, immutable`;
  - other public files are `max-age=86400, stale-while-revalidate=604800`;
  - HTML stays `no-cache`.
  - Unit test: `staticCache.test.ts`.

## Not done / needs approval

- **Staging test data:** inspecting and cleaning the previous run's data needs Staging access and a reviewed, run-scoped cleanup (`tests/global-teardown.ts` reports leftovers; `E2E_CLEANUP_ON_TEARDOWN=1` deletes them). Not run.
- **Validation:** `npm run check`, `npm run build`, the affected Playwright tests and the full Staging regression could not run here (no npm registry, no Staging access).
- **Re-run checks:**
  - SEARCH-017 needs a re-run with a trace;
  - ACCESS-004 needs a re-run;
  - MSG-111/112 need confirmation they fit in `test.slow()`.
