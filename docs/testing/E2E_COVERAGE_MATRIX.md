# E2E coverage matrix

Updated 5 Nov 2026. Inventory from `npx playwright test --list`: **404 tests in 54 files**. Production selection: **33 tests in 1 file**. Phases are in `tests/safety/staging-phases.ts`. "Not run" means the test exists but its last Staging result is not known for this branch (`REGRESSION_RESULTS.md`).

## Platform

| Feature | Staging (phase) | Production | Gaps |
|---|---|---|---|
| Home and public navigation | HOME-001, PUBLIC-SMOKE-001/002 (read-only set) | PROD-SAFE-002, 006, 007 | — |
| Registration and email verification | REG-001…005, AUTH-011…013 (mutating-core) | Excluded | — |
| Login / logout | AUTH-003…005, AUTH-014, AUTH-SMOKE-001 | Sign-in page only (PROD-SAFE-008) | — |
| Forgot / reset password | AUTH-006…010; payload tests SEC-FORGOT (security-last) | Pages only, nothing sent (009, 010) | — |
| Player and coach profiles | PROFILE-003…013, PROFILE-RD-001…004, IMG-001/002; uploads skip on Staging until storage isolation is verified | Public view (022, 025) | `tests/profile/complete-profile.spec.ts` is empty |
| Directories, search, filters | PUBLIC-001…008, PUBLIC-COACH-001…005; SEARCH-001…094 (local only, not yet reviewed for Staging) | 003, 004, 018–026, 031 | SEARCH on Staging is a reviewed decision |
| Play discovery and registration | PLAY-001…006, **PLAY-007…009 (new)** (hub-msg-admin) | 014–017 | — |
| Organiser Hub | See below (hub-msg-admin) | Access gates only (012, 013) | — |
| Messaging | MSG-001…018, MSG-101…116, MSG-SMOKE-001…005 | Guest gate only (005) | — |
| Articles | — | 031, 032 | `tests/public/articles.spec.ts` and `tests/admin/articles/create-article.spec.ts` are empty: no Staging test |
| Travel & Retreats | — | 028–030 | `tests/public/travel.spec.ts` is empty |
| Clubs and organisations | Organisation page: ORG-RESP-003, PLAY-007 | 026, 027 | No Staging test for clubs |
| Admin | ADMIN-001…008, ACCESS-005/006; ADMIN-009 local only | Guest gate only (011) | — |
| Admin user deletion (4 Nov) | **ADMIN-DEL-001…012** (`tests/admin/users/admin-user-deletion.spec.ts`, hub-msg-admin): single (player, coach, protected, former organiser), bulk under Players / Coaches / Awaiting / Organisers Approved / Players + Pending, partial success 3/2 with summary, selection reset on filter change, double submit, all 36 filter combinations. Every delete request is guarded to run-owned ids; no collateral check after each delete. Unit: `shared/userDeletion.test.ts`, `client/src/lib/adminUserFilters.test.ts`, `server/routes/adminUsers.test.ts` | Excluded | — |
| Access control | ACCESS-001…004, SEC-001…012 | 011–013, 033 | — |
| Live rounds, check-in, scoring (TC Live) | **LIVE-001…016** (`tests/live/live-engine.spec.ts`, needs `TC_LIVE_ENABLED=true`); check-in also ORG-RESP-002; results via seeded matches ORG-FLOW-001/003, ORG-WS-001 | Internal only: LIVE-PROD-001/002 (`@prod-live-internal`, opt-in, approval) | See `docs/live/LIVE_TEST_COVERAGE.md` |
| Payments (Back the Rally) | SUPPORT-001…016; SUPPORT-007/008 create Stripe test sessions (stripe phase, opt-in) | Excluded | — |

## Organiser Hub (Phase 2)

| Ticket area | Scenario | Tests |
|---|---|---|
| **A. Auth and permissions** | Guest → sign in; player blocked in UI **and API** | ORG-AUTH-002, ORG-AUTH-003, PROD-SAFE-012/013 |
| | Organiser reaches the Hub, `isOrganizer` and organisation real on the server, all nav items | ORG-AUTH-001 |
| | Cannot read or change another organiser's organisation, sessions, players or rounds (API and UI); cross-session IDOR | ORG-PERM-001; route unit tests `server/routes/organizerOwnership.test.ts` |
| | Admin: Hub access and session reads (rounds included) for any session; writes stay owner-only | Unit tests only (`organizerOwnership.test.ts`). **Gap:** no E2E as e2e-admin on another organiser's session |
| **H. Onboarding** (2 Nov) | Verified email → own profile (never `/organiser` by default) | ORG-ONB-001 |
| | Player opens Hub → request modal; no Hub content behind it; Escape / X / Back return to the profile; focus stays in the dialog | ORG-ONB-002 |
| | Request uses the existing API; nothing is granted | ORG-ONB-003, ORG-ONB-010 |
| | Confirmation; pending is "under review" and can't be sent twice (UI and API) | ORG-ONB-004, ORG-ONB-005 |
| | Approved organiser and admin open the Hub with no modal | ORG-ONB-006, ORG-ONB-007 |
| | Guest → sign in with the Hub as return path | ORG-ONB-008 (auth-readonly), ORG-ONB-012a |
| | Rejected shows the existing status; a new request follows the server | ORG-ONB-011 |
| | Return path through registration and verification; permissions checked on arrival | ORG-ONB-012b; unit `client/src/lib/postVerifyTarget.test.ts` (unsafe return paths) |
| | Six viewports: fits, no overflow, 44 px targets, keyboard and touch, phone sheet without photo | ORG-ONB-009 |
| **B. Organisation** | View, edit, validate website, save, reload, public page | ORG-RESP-003 (phone), ORG-PERM-002 |
| | No verified / premium / slug / status changes by the organiser; server-side validation | ORG-PERM-002; unit `shared/organizationProfile.test.ts` |
| | Unauthorised edit | ORG-PERM-001 (404) |
| **C. Wizard** | Social Play, Competition, Coaching & Fitness, Other: category-specific fields, saved values via API | ORG-WIZ-001 |
| | Step 2 layout at six viewports: no overflow, field icons centred, 44 px controls on touch | ORG-WIZ-005 |
| | Save as Draft from every wizard step; first save = exactly one draft, later saves update it | ORG-DRAFT-001 |
| | Draft in My Sessions All + Drafts; refresh keeps incomplete fields | ORG-DRAFT-002 |
| | Reopen after logout/login, edit another step, save again, no duplicate or loss | ORG-DRAFT-003 |
| | Failed save: error, no success claim, nothing created; retry succeeds | ORG-DRAFT-004 |
| | Stale save refused with a conflict banner | ORG-DRAFT-005 |
| | Incomplete draft cannot be published, stays a draft | ORG-DRAFT-006 |
| | Publish saved draft = same session, leaves Drafts (opt-in, messages admins) | ORG-DRAFT-007 |
| | Edit Session: prefill, three compact sections, shared rows, readable width | ORG-EDIT-001 |
| | Edit saves and persists; Cancel saves nothing | ORG-EDIT-002 |
| | Price only for Paid; Free to Paid needs a price | ORG-EDIT-003 |
| | Waiting List toggle persists | ORG-EDIT-004 |
| | Rules & policies collapsed, values kept when collapsed, each policy saves | ORG-EDIT-005 |
| | Required fields block the save with inline errors | ORG-EDIT-006 |
| | Phone: no horizontal scroll, Start/End share a row | ORG-EDIT-007 |
| | Required fields | ORG-WIZ-002 |
| | Edit (policies persist after reload), Duplicate (pre-fill, nothing saved) | ORG-WIZ-003 |
| | Publish | ORG-WIZ-004, **opt-in** (see decision below) |
| **D. Workspace** | Real rounds and scores, results, results export | ORG-WS-001 |
| | Empty and error states | ORG-WS-002 |
| | Coaching navigation (no Rounds / Results / Live, deep link) | ORG-WS-003 |
| | Live visibility by environment | ORG-WS-002, ORG-WS-004 |
| | Policies | ORG-WS-005 |
| | Players and check-in | ORG-RESP-002; IDOR in ORG-PERM-001 |
| **E. Actions** | Cancel (confirmation, Keep), Archive | ORG-ACT-001, ORG-ACT-002 |
| | Invite: published OK; draft, cancelled, finished refused (UI and API) | ORG-ACT-003, ORG-ACT-001 |
| | Announcement (delivered count), not for drafts | ORG-ACT-004 |
| | Export players, Share (real public link, none for drafts) | ORG-ACT-005, ORG-ACT-006 |
| | Edit, Duplicate, Publish | ORG-WIZ-003, ORG-WIZ-004 |
| **F. Public** | Published in Play, drafts private | PLAY-001, PLAY-002, PLAY-009 |
| | Category, format, policies, organiser public page (and back to the session) | PLAY-007 |
| | Play card opens the session's own page, not Quick View (Quick View only for external events) | PLAY-008, PROD-SAFE-017 |
| | Registration and status | PLAY-003…006 |
| | "I agree to the rules & policies" before Join (page and API) | PLAY-010 |
| | Guest: Sign in / Create an account, no Join | PLAY-011, PROD-SAFE-017 |
| **G. Responsive** | 6 viewports: navigation, wizard, players, touch targets, check-in, organisation, overflow | ORG-RESP-001…003 |
| Rankings, reports, series | Existing | ORG-RANK-002/004/006, ORG-REPORT-003/004/010/012, ORG-FLOW-001/003 |
| **I. Dashboard states** (5 Nov) | New organiser: 0 / 0 / 0 / `—`, welcome card with Create Session | ORG-DASH-001 |
| | Sessions or stats request fails: compact warning + Try again, other figures kept, recovery | ORG-DASH-002, ORG-DASH-003, ORG-DASH-005 |
| | Skeletons while loading; six viewports without overflow | ORG-DASH-004, ORG-DASH-006 |

## Decision needed: ORG-WIZ-004 (Publish)

An organiser's Publish submits for review, and the server then messages **every admin** (`POST /sessions/:id/publish`). Run cleanup refuses a run with messages to anyone outside it (`server/services/e2eRunCleanup.ts`). So if Staging has any admin besides `e2e-admin`, a run that includes ORG-WIZ-004 leaves its data behind. The test therefore skips itself unless `E2E_ALLOW_PUBLISH_REVIEW=1`.

Options:
1. Confirm `e2e-admin` is the only Staging admin, then run it with the opt-in.
2. Allow cleanup to remove review notices sent to admins about run sessions (a cleanup rule change).
3. Leave it opt-in.

## Recommended follow-ups

- E2E as `e2e-admin` on another organiser's session: reads allowed, writes refused.
- Fill or delete the four empty spec files (articles, travel, create-article, complete-profile).
- A reviewed prod-safe addition for a session details page and an organisation page (`PRODUCTION_SMOKE_POLICY.md`).
- Create multi-account fixtures through the API instead of the UI (MSG-1xx, ORG-PERM-001 take 60–80 s).
