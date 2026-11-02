# Organiser Hub: functional audit (Phase 1)

Date: 30 Oct 2026. Branch: `feature/organiser-hub-v2` at `b86dd8d` (same as `main`).
Method: code review of every Organiser Hub route, component, API endpoint and test. **Nothing here was executed against a running app or Staging.** The local environment has no npm registry, database or Staging access.

## Phase 2 progress

**Batch 1 (UX foundation and critical fixes): done in code, not yet run on Staging.**

| Audit item | Now |
|---|---|
| 5.11 Guard repeated on every page, redirects during render | **Fixed.** `components/organiser/ui/organiser-layout.tsx`: `OrganiserLayout` + `OrganiserAccessGate` on all 17 pages and the admin pages' Hub chrome. Guests are redirected from an effect to `/auth?returnTo=…`. Admins get in, same rule as the API (`isOrganizer \|\| isAdmin`). |
| 5.6 Mock role / organiser | **Fixed.** `useOrganiserIdentity()` gives the real name, avatar and role ("Organiser", "Admin", "Organiser · Admin"). `mockOrganiser` and `mockStatStrip` are deleted. |
| 5.4 Dashboard mock numbers, 5.13 400 ms delay | **Fixed.** Tiles show a skeleton while loading, "—" on error, a visible error notice, and real values only. The delay is removed. |
| 5.10 Upcoming empty without organisation | **Fixed.** Built from `/sessions/mine`. |
| 5.5 "View Public Page" → mock organisation | **Fixed.** Disabled, with the reason, until the organisation exists. The "Your organisation" page is Batch 2. |
| 5.1 Wizard toggles that do nothing | **Fixed.** The 9 toggles are gone: Pairing ×5, Live settings ×4, and Allow Late Registration. Pairing is now described as the engine really does it. The review step shows Price instead of "QR check-in". The hidden toggles no longer write "Random Partners…" into new sessions' descriptions. Existing descriptions are untouched. The draft fields stay, for templates and older drafts. |
| Paid sessions | **Done.** Wizard note: "TennisConnect shows the price … doesn't collect payment". Review: "$X · paid to you directly". |
| 5.2 Settings "Check-in Open", "Notify Players" | **Removed.** Only the saved settings remain: Registration open, Waiting list. |
| 5.7 Player "Message" (coming soon), selection checkboxes | **Fixed.** "Message" opens the site's `QuickMessageModal`. The checkboxes are removed. "Remove" now asks for confirmation. |
| 5.8 Photos tab | **Hidden.** |
| 5.9 Live entry points on Production | **Hidden** where Live is off. `useLiveAvailable()` reads `/api/health` `dbEnv`. Session cards, the Workspace primary action, the Overview tab and the dashboard show Live only on Staging; elsewhere the session is run from the Players tab. |
| **New: IDOR in registration and match routes** | **Fixed.** Check-in, remove, waitlist, live-status, match start and match score accepted a registration or match from **another organiser's session** under the caller's own session id. `requireRegistrationInSession` / `requireMatchInSession` → 404, nothing changed. |
| **New: CSV injection in the player export** | **Fixed.** `lib/organiser-export.ts` quotes every cell and defuses a leading `= + - @`. |
| Share link | Copied only while the session has a public page (published or live); otherwise the organiser is told why. |

**Batch 2 (wizard, workspace, organisation): done in code, not yet run on Staging.**

| Audit item | Now |
|---|---|
| §4 Session types | **Done.** Four categories in `shared/sessionCategories.ts`: **Social Play** (social, americano, mexicano, round-robin, king-of-the-court), **Competition** (tournament, league, club-championship, junior-event), **Coaching & Fitness** (coaching-clinic, cardio-tennis, new `junior-development`), **Other** (custom). The stored `sessions.type` keys, URLs and Play filters are unchanged; a category is derived from the key, and unknown keys fall back to Other. Play, the event modal, recommendations and smart search use `isCompetitionType` / `ALL_SESSION_FORMATS` instead of their own copies of the list (same four competition keys as before). |
| 5.1 Wizard by category | **Done.** Step 1: pick a category, then a format when there's more than one. Step 3 shows match format (singles/doubles, games, rounds, No-Ad, tiebreak) and the pairing note only where they apply; Coaching & Fitness saves no match-format fields. Format descriptions no longer promise draws, brackets, qualifying, results-based pairing, court promotion or team scoring, none of which the Live engine does. Competition shows that note explicitly. |
| 5.3 Rounds tab | **Fixed.** New `GET /api/organizer/sessions/:id/rounds` (session owner or admin, like the other session reads; not Staging-gated because it only reads) returns every stored round with its matches and players. The tab shows them with Final / Playing / Not started and confirmed scores, plus loading, error-with-retry and empty states (empty links to Live where Live exists). The `plannedRoundsCount ?? 5` placeholder rounds are gone. Coaching & Fitness sessions have no Rounds / Results tabs and no Live. |
| Policies | **Fixed.** Rules, refund, late-arrival and cancellation policies have their own columns (migration `0034_sessions_policies.sql`, additive). The wizard and Edit Session save them; Edit, Duplicate and the Workspace read them back. Older sessions that carry them as "Rules: …" paragraphs in the description are read through `readSessionPolicies` (columns first, then the legacy paragraphs), so nothing is rewritten on read. Players see them on the session page and in the event modal. |
| 5.5 "Your organisation" | **Done.** `/organiser/organisation` (sidebar and the phone "More" menu): name, description, website, contact email and phone, through the existing `GET /organizations/me` and `PUT /organizations/:id` (or `POST` when there's none yet). Contacts appear on the public `/organisations/:slug` page. |
| **New: organisation privilege escalation** | **Fixed.** `POST` and `PUT /organizations` validated with `insertOrganizationSchema`, which still contains `verified` and `listingType`, so an organiser could mark their own organisation verified or premium. Both now use `shared/organizationProfile.ts`: profile fields only, unknown keys dropped, and a website must be http(s) because it's rendered as a link. |
| Workspace actions | **Verified and fixed.** Publish, Edit, Cancel (confirmation, notifies players), Archive (confirmation), Duplicate (opens the pre-filled wizard), Share, Export, Announcement and Invite each call a real endpoint and report success or failure. Fixed: **Invite** was offered, and accepted by the server, for drafts, cancelled, finished and archived sessions; it's now only for published or live sessions that haven't ended (`shared/sessionActions.ts`, server 400 otherwise). **Announcement** is hidden for drafts (nobody is registered). The session card's **Duplicate** showed "copied as a new draft" while it only opened the wizard; the toast is removed. A finished coaching session's card said "View Results" and opened a tab it doesn't have; it now says "View Players". Check In and the row menu on the phone/tablet player list are 44 px. |
| 5.12 Dead code | **Removed** (nothing imported them): `workspace/registration-tab.tsx` and `workspace/registration/*` (6 files), `session-actions-card.tsx`, `session-activity-card.tsx`, `photos-tab.tsx`, `players/group-overview-card.tsx`, `organiser/players/recent-new-players-card.tsx`, `top-players-card.tsx`, `dashboard/season-progress-card.tsx`, and 12 unused mock arrays in `lib/organiser-*-mock-data.ts`. Types the real code uses stay. |

Batch 3 covers the Assistant (Guided v1) and the full documentation set; Batch 4 is regression and demo validation.



| Status | Meaning in this report |
|---|---|
| **WORKING (tested)** | Implemented, and an existing automated test exercises it end to end |
| **WORKING (code)** | Implemented end to end in the code (UI → API → DB), but no automated test covers it |
| **PARTIALLY WORKING** | Implemented, with a confirmed gap or incorrect behaviour |
| **BROKEN** | Fails for real users |
| **NOT IMPLEMENTED** | Visible in the UI, does nothing or only says "coming soon" |
| **UNUSED / DUPLICATE** | Code that no page renders, or mock data still wired in |
| **NEEDS DECISION** | Correct behaviour needs a product decision |

**Recommended actions** are proposals, to be approved before Phase 2: Keep / Fix / Simplify / Hide / Remove.

## 1. Summary

- **Size.** The Hub has 17 pages under `/organiser`, 71 API endpoints in `server/routes/organizer.ts`, and admin review endpoints. Data lives in the `sessions`, `registrations`, `session_rounds`, `matches`, `seasons`, `series`, `session_templates`, `organizations`, `organization_members`, `session_updates` and `messages` tables.
- **The core lifecycle is real.** Create, then submit for review, then admin approves (published), then players register. After that the organiser can check players in, cancel, archive or delete. Seasons, series, rankings and reports work too. Seasons, series, rankings and reports have E2E tests; session creation and check-in do not.
- **The live part is Staging-only** (`requireStagingEnv`): go live, generate rounds, score, finish. On Production every "Enter Live" button opens "Live sessions are coming soon". **The demo must run on Staging.**
- **Controls that do nothing.** The biggest usability problem is controls that look real but change nothing:
  - **9 toggles in the Create Session wizard** are never saved and affect nothing: four Live Settings, four Pairing toggles, Allow Late Registration;
  - **2 toggles in Session → Settings** ("Check-in Open", "Notify Players of Changes") only show "not saved yet";
  - **"Message"** in the player row menu shows "coming soon";
  - the **player selection checkboxes** have no bulk action;
  - **Photos** is a disabled button.
- **Mock data in the UI** (§5.6):
  - the dashboard falls back to invented figures ("1 live", "3 upcoming", "87 players", "91%") while data loads or if it fails;
  - "View Public Page" points to a mock organisation (`/organisations/lyne-park-tennis`) for an organiser without an organisation;
  - the sidebar shows the mock role "Organiser" for everyone.
- **Session types.** The 12 types change almost nothing in the flow. The wizard steps, the Session Workspace and the live engine behave the same for all of them. Proposal: four categories, with the existing keys kept as formats (§4).
- **Structure.** Every page repeats ~60 lines of layout and access checks, calling `setLocation` during render. A shared Hub layout would remove this (Phase 2).
- **AI.** The server already uses Anthropic (`ANTHROPIC_API_KEY`, Play smart search, with a non-AI fallback). The Assistant can reuse it (§6).

## 2. Navigation map (as built)

| Sidebar item | Route | Page | Who |
|---|---|---|---|
| Home | `/organiser` | `pages/organiser/organiser-dashboard.tsx` → `components/organiser/dashboard/organiser-dashboard.tsx` | organiser, admin |
| Sessions | `/organiser/sessions` | `sessions.tsx` | organiser |
| (from Sessions) New | `/organiser/sessions/new` | `session-new.tsx` (4-step wizard) | organiser |
| (from Sessions) Templates | `/organiser/sessions/templates`, `/…/templates/:id/edit` | `session-templates.tsx`, `session-template-edit.tsx` | organiser |
| (session card) Workspace | `/organiser/sessions/:id` | `session-workspace.tsx` (8 tabs) | owner |
| (Workspace) Edit | `/organiser/sessions/:id/edit` | `session-edit.tsx` | owner |
| (Workspace / card) Live | `/organiser/sessions/:id/live` | `session-live.tsx` | owner, **Staging only** |
| Seasons & Series | `/organiser/seasons`, `/new`, `/:id`, `/:id/edit` | `seasons.tsx`, `season-new.tsx`, `season-details.tsx`, `season-edit.tsx` | organiser |
| Players | `/organiser/players`, `/organiser/players/:slug` | `players.tsx`, `player-details.tsx` | organiser |
| Rankings | `/organiser/rankings` | `rankings.tsx` | organiser |
| Reports | `/organiser/reports` | `reports.tsx` | organiser |
| Messages | `/organiser/messages` | `messages.tsx` (embeds the site inbox) | organiser |
| Admin section (admins only) | `/admin?tab=…`, `/admin/discovery` | `pages/admin.tsx` | admin |
| Public | `/organisations/:slug` | `organisation-detail.tsx` | everyone |

Mobile: `OrganiserMobileNav` (bottom bar) plus a sheet with the sidebar. Breadcrumbs: `OrganiserBreadcrumb`.

## 3. Feature inventory

Legend: **C** = main components, **API** = endpoints (prefix `/api/organizer`), **DB** = tables.

### 3.1 Access and organiser onboarding

| Feature | Purpose | Implementation | Status | Issues | Action | Tests |
|---|---|---|---|---|---|---|
| Request organiser access | A player or coach asks to organise | Profile → request. API `POST /requests`, `GET /requests/me`. DB `organizer_requests` | WORKING (tested, route test) | — | Keep | `server/routes/organizerRequests.test.ts` |
| Admin approve / reject request | Grants `isOrganizer` | Admin → Organiser & Sessions. API `POST /requests/:id/approve|reject` | WORKING (tested, route test) | — | Keep | same; `organizerGrantDirect.test.ts` |
| Hub access guard | Only organisers and admins enter | Every page: `!isAuthenticated → /auth`, `!isOrganizer → "Organiser access required"`. Backend `requireAuth`, `requireOrganizer`, `requireOwn*` | WORKING (tested) | Each page repeats the guard and calls `setLocation()` during render (React warning; a flash of empty page) | **Simplify**: one `OrganiserLayout` with the guard | ORG-AUTH-001/002/003 |
| Create / edit organisation | Business profile shown on public pages | Created automatically with a default name the first time the organiser saves a session (`ensureMyOrganization`, `POST /organizations`). `PUT /organizations/:id` exists, but **no UI edits it** (name, logo, contacts, website). DB `organizations` | PARTIALLY WORKING | Before the first session there is no organisation, and the dashboard falls back to a **mock slug** for "View Public Page". The default name can't be changed in the Hub. | **Fix**: "Your organisation" settings page + NEEDS DECISION | — |

### 3.2 Dashboard (`/organiser`)

| Feature | Implementation | Status | Issues | Action | Tests |
|---|---|---|---|---|---|
| Stat strip (Live, Upcoming 7 days, Active players, Attendance) | `DashboardHero`; API `/sessions/mine`, `/dashboard/stats` | PARTIALLY WORKING | Starts from `mockStatStrip`: shows invented "1 / 3 / 87 / 91%" while loading **or if a request fails** | **Fix**: skeleton or "—" until data arrives | — |
| Live today | `LiveTodayCard` (real sessions + `/sessions/:id/registrations`) | WORKING (code) | Buttons go to the Live page → "coming soon" on Production | Keep; hide Live buttons where Live is off | — |
| Upcoming sessions | `UpcomingSessionsCard`; `/organizations/by-user/:slug` | WORKING (code) | Empty when the organiser has no organisation, even though they have sessions | Fix (use `/sessions/mine`) | — |
| Recent activity | `RecentActivityCard`; `/dashboard/activity` | WORKING (code) | — | Keep | — |
| Quick actions | `QuickActionsCard` | PARTIALLY WORKING | "Invite Players" disabled with no explanation when there is no upcoming session; "View Public Page" goes to the **mock** `/organisations/lyne-park-tennis` without an organisation | Fix | — |
| Statistics (quick analytics) | `StatisticsCard` from real counts | WORKING (code) | — | Keep | — |
| Season progress card | `season-progress-card.tsx` ("Coming soon" button) | UNUSED | Not rendered anywhere | Remove (dead code) | — |
| Artificial 400 ms loading | `setTimeout(() => setLoading(false), 400)` | UNUSED / DUPLICATE | Mock-phase leftover; delays every visit | Remove | — |

### 3.3 Sessions list (`/organiser/sessions`)

| Feature | Implementation | Status | Issues | Action | Tests |
|---|---|---|---|---|---|
| List of my sessions with status tabs (buckets) | `SessionStatusTabs`, `SessionCardGrid`, `session-adapter.ts`; `GET /sessions/mine` | WORKING (code) | — | Keep | indirect (ORG flows seed via API) |
| Filters bar (search, venue, type, date) | `SessionFiltersBar` | WORKING (code) | Venue options built from real sessions | Keep | — |
| Calendar view | `SessionsCalendarView` | WORKING (code) | — | Keep; check mobile | — |
| Card actions (open, edit, live, duplicate, cancel…) | `SessionCard` menus | WORKING (code) | "Live" leads to "coming soon" on Production | Hide Live where off | — |
| Empty state | `SessionsEmptyState` | WORKING (code) | — | Keep | — |
| New session menu (blank / from template) | `wizard/new-session-menu.tsx` | WORKING (code) | — | Keep | — |

### 3.4 Create Session wizard (`/organiser/sessions/new`)

Four steps: 1 Type → 2 Date & registration → 3 Format & rules → 4 Review & publish (`wizard/*`, `organiser-session-wizard-types.ts`). Submit: `POST /sessions`, then `POST /sessions/:id/publish`. An organiser's session goes to `pending_review`; an admin's is published directly. Admin `POST /admin/sessions/:id/approve|reject`.

| Item | Status | Issues | Action |
|---|---|---|---|
| Step 1: 12 session types | NEEDS DECISION | Types mix formats and purposes; none of them changes the later steps (§4) | **Simplify** to 4 categories (§4) |
| Step 2: name, season, venue, courts, time zone, dates, registration window, max players, waiting list (+ capacity), price, visibility, cover image | WORKING (code) | Season list filtered to the same type: confusing once types are categories | Keep; season filter by category |
| Step 2: **Allow late registration** | **NOT IMPLEMENTED** | Never sent; no backend rule | Hide (or implement) |
| Step 2: Pricing "Paid" | NEEDS DECISION | Saves a price for display only; no payment at registration | Keep as "price shown to players" + clear label |
| Step 3: match type (singles / doubles / mixed), category, games to, rounds, No-Ad, tiebreak | WORKING (code) | Saved (`matchMode`, `gamesTo`, …); `matchMode` drives the live engine | Keep |
| Step 3: Pairing toggles (Random partners, Avoid repeat partners, Balance waiting list, Use player rating, Allow guests) | **NOT IMPLEMENTED** | Only written into the description text; the engine always avoids repeats and rotates rests; no rating system exists | **Hide**, except "Avoid repeat partners" shown as a fixed fact of the engine |
| Step 3: Live Settings toggles (QR check-in, Live scores, Auto next round, Publish results) | **NOT IMPLEMENTED** | Not saved anywhere; Step 4 shows "QR check-in: Enabled" anyway | **Hide** |
| Step 3: rules, refund, late arrival and cancellation text | WORKING (code) | Folded into the description, so Edit cannot restore them as separate fields | Keep; NEEDS DECISION on dedicated columns |
| Step 4: review and publish / save draft | WORKING (code) | — | Keep |
| Weather preview | `session-weather-preview.tsx` → `/api/weather` | WORKING (code) | Keep |
| Pending-approval dialog | `pending-approval-dialog.tsx` | WORKING (code) | Keep |
| Save as template | `save-as-template-dialog.tsx` → `POST /session-templates` | WORKING (code) | Template omits pairing / policy (documented) | Keep |

**Tests:** none for the wizard UI. E2E tests create sessions through test hooks only.

### 3.5 Session Workspace (`/organiser/sessions/:id`)

Tabs: Overview · Players · Format · Rounds · Messages · Photos · Results · Settings. Header actions: Publish / Submit for review, Edit, Duplicate, Archive, Cancel, Delete, Invite players, Announce, Export CSV (`session-workspace.tsx`, `session-actions-sheet.tsx`).

| Feature | API | Status | Issues | Action |
|---|---|---|---|---|
| Overview (status, details, readiness, quick stats, summary, notes) | `GET /sessions/:id`, `PUT /sessions/:id` (notes) | WORKING (code) | Notes are now persisted | Keep |
| Divisions (sub-events of a parent event) | `GET`/`POST /sessions/:id/divisions` | WORKING (code) | Concept unexplained in the UI | Keep + explain (Assistant) |
| Players: list, search, check in, check in all | `GET /sessions/:id/registrations`, `POST /sessions/:id/checkin/:regId` | WORKING (code) | Check-in is not Staging-only (good) | Keep; **add E2E** |
| Players: remove, move to waiting list, view profile | `DELETE …/registrations/:regId`, `POST …/waitlist` | WORKING (code) | — | Keep; add E2E |
| Players: **Message** (row menu) | — | **NOT IMPLEMENTED** | Shows "Message — coming soon" | **Fix** (open the existing message composer) or Hide |
| Players: select checkboxes | — | **NOT IMPLEMENTED** | Selection has no bulk action | **Hide** |
| Players: "Real" badge / demo levels | `players-table.tsx` | UNUSED / DUPLICATE | Left from the mock "crowd" | Remove |
| Invite players | `POST /sessions/:id/invite`, `GET /players/search`, `POST /players/invite` | WORKING (code) | — | Keep |
| Waiting list card | registrations (`waitlisted`) | WORKING (code) | Auto-promotion happens server-side on cancel | Keep |
| Format tab | read-only summary | WORKING (code) | Shows format from description text | Keep |
| **Rounds tab** | — | PARTIALLY WORKING | Draws round cards from `plannedRoundsCount ?? 5`; the "5" is **invented**; doesn't read real rounds (`/rounds/current`) | **Fix** (real rounds) or show "see Live" |
| Messages tab (session updates / broadcast) | `GET /sessions/:id/updates`, `POST /sessions/:id/broadcast` | WORKING (code) | — | Keep |
| **Photos tab** | — | **NOT IMPLEMENTED** | Disabled "Upload Photos" | **Hide** tab |
| Results tab (leaderboard, send results) | `GET /sessions/:id/leaderboard`, `POST /sessions/:id/send-results` | WORKING (tested via ORG-RANK / ORG-FLOW) | — | Keep |
| Settings: Registration open | `PUT /sessions/:id` | WORKING (code) | — | Keep |
| Settings: Waiting list enabled | `PUT /sessions/:id` | WORKING (code) | — | Keep |
| Settings: **Check-in open**, **Notify players of changes** | — | **NOT IMPLEMENTED** | Toasts "not saved yet" | **Hide** (no player self check-in exists) |
| Publish / submit / cancel / archive / delete / duplicate | `POST /sessions/:id/publish|cancel|archive`, `DELETE /sessions/:id` | WORKING (code) | Confirmation dialogs to be checked for each destructive action | Keep; add E2E |
| Export players CSV | client-side from registrations | WORKING (code) | — | Keep |
| Edit session (`/edit`) | `PUT /sessions/:id` | PARTIALLY WORKING | Pairing / live toggles and the policy texts come back as defaults (never saved) | Fixed by hiding those toggles |

**Dead code (UNUSED):** `workspace/registration-tab.tsx` and the whole `workspace/registration/*` folder (8 files, incl. "coming soon" bulk actions), `session-actions-card.tsx`, `session-activity-card.tsx`, `players/group-overview-card.tsx`, `organiser/players/recent-new-players-card.tsx`, `organiser/players/top-players-card.tsx`, `dashboard/season-progress-card.tsx`. **Action:** Remove (after approval).

### 3.6 Live session (`/organiser/sessions/:id/live`): TC Live v0.1

| Feature | API | Status | Issues | Action | Tests |
|---|---|---|---|---|---|
| Go live | `POST /sessions/:id/go-live` | WORKING (tested on Staging) / **off on Production** | `requireStagingEnv` → 404 on Production; UI shows "coming soon" | NEEDS DECISION: enable for Production | ORG-FLOW-001/003 |
| Live status per player (present / resting / left) | `POST …/registrations/:regId/live-status` | WORKING (tested) | Staging only | same | ORG flows |
| Generate round (courts + pairings, history-aware, rests) | `POST /sessions/:id/rounds/generate`, `GET /rounds/current` | WORKING (tested) | Staging only; singles / doubles only | same | `liveEngine.test.ts` + ORG flows |
| Enter / confirm scores (games-count) | `POST …` score routes | WORKING (tested) | Organiser-only score entry | same | ORG-RANK-* |
| Finish session → completed | `POST /sessions/:id/finish` | WORKING (tested) | — | same | ORG flows |
| Leaderboard | `GET /sessions/:id/leaderboard` | WORKING (tested) | — | Keep | ORG-RANK-006/007/008 |

### 3.7 Templates, seasons, series, rankings, reports

| Feature | API | Status | Issues | Action | Tests |
|---|---|---|---|---|---|
| Templates list / edit / duplicate / delete / use | `/session-templates*` | WORKING (code) | — | Keep; add E2E | — |
| Seasons: create / edit / archive / delete / add & remove sessions | `/seasons*` | WORKING (tested) | Seasons are bound to one session type | Keep; bind to category (§4) | ORG-FLOW-001 |
| Series: create / edit / delete / sessions / standings / form | `/series*` | WORKING (tested) | — | Keep | ORG-RANK-002…008 |
| Rankings page | `/series/:id/standings`, results, form | WORKING (tested) | — | Keep | ORG-RANK-* |
| Reports (KPIs, series and session performance) | `GET /reports` | WORKING (tested) | — | Keep | ORG-REPORT-003…012 |

### 3.8 Players, messages, notifications

| Feature | API | Status | Issues | Action | Tests |
|---|---|---|---|---|---|
| Organisation players list (search, filters, table / list) | `GET /players/mine` | WORKING (code) | Level, sessions played, last played only (fake metrics removed) | Keep | — |
| Player details (`/organiser/players/:slug`) | list + find | WORKING (code) | No by-slug endpoint | Keep | — |
| Hub Messages | site inbox (`/api/messages*`) inside the Hub layout | WORKING (tested via MSG-*) | Same inbox as the site | Keep | MSG-* |
| Notification bell | `NotificationBell`: links to Hub Messages, real unread count | WORKING (code) | Only messages; no session events (new registration, etc.) | Keep; NEEDS DECISION on session notifications | — |
| Session updates / results messages to players | broadcast, send-results | WORKING (tested) | — | Keep | ORG-FLOW |

### 3.9 Integration with Play and player-facing flows

| Feature | Status | Notes |
|---|---|---|
| Published sessions appear on `/play` (search, filters, Quick View) | WORKING (tested) | PLAY-001…006, PROD-SAFE-014…017 |
| Player joins / leaves / waiting list (`POST`/`DELETE /sessions/:id/join`) | WORKING (tested) | PLAY-005, PLAY-006 |
| "Join Competition" wording and Competitions filter | WORKING (code) | Hard-coded sets of four types in three places (`play.tsx`, `EventQuickViewModal.tsx`, `recommendationEngine.ts`), plus "tournament" types on profiles in two places, duplicated: fold into §4 |
| Organisation public page | WORKING (code) | Depends on the organiser having an organisation |

## 4. Session types: proposal (your question)

**What the code does today.** Step 1 offers 12 types: Social, Americano, Round Robin, Mexicano, King of the Court, Tournament, League, Club Championship, Junior Event, Cardio Tennis, Coaching Clinic, Custom.

The type changes only:
- the label;
- which seasons are offered;
- the "Join Competition" wording, the Competitions filter on `/play` and the recommendation weighting (tournament, league, club-championship, junior-event);
- the Tournaments tab on profiles (tournament, club-championship).

**Steps 2-4, the Workspace and the live engine are identical for all 12.** The engine only knows singles or doubles. So a coaching clinic is asked for "rounds", "games to" and "pairing", and a tournament gets no draw.

**Proposal.** Split by what the organiser actually fills in. Keep the existing keys as a "format" inside a category, so there is no migration and all existing sessions and filters keep working.

| Category (Step 1) | What's different in the event | Formats (existing keys) | Steps 3 / Workspace |
|---|---|---|---|
| **Social play** | Rotating rounds on courts, live scoring, leaderboard | social, americano, mexicano, round-robin, king-of-the-court | Match type, games to, rounds, scoring; Live; Results |
| **Competition** | Draw or standings, a champion, results matter | tournament, league, club-championship, junior-event (competitive) | Match type, scoring, stages; results; "Join Competition"; Tournaments tab |
| **Coaching & fitness** | Coach-led, no scores or rounds | coaching-clinic, cardio-tennis, junior-event (development) | Coach, level / age group, capacity, what to bring; **no** rounds / scoring / leaderboard |
| **Other** | Free-form | custom | Everything optional |

**Effect.**
- Step 1 shows 4 big choices instead of 12; the format is a small select in the same step.
- Step 3 and the Workspace tabs show only what applies:
  - "Coaching & fitness" hides Rounds and Results;
  - only "Social play" and "Competition" offer Live.
- One shared `SESSION_CATEGORIES` map replaces the five hard-coded type lists.

**Open question: Junior Event.** It's in both Competition and Coaching. Either keep it under Competition, with "Coaching & fitness → age group" covering development sessions, or split it into two formats.

## 5. Confirmed defects and issues (by priority)

| # | Issue | Where | Severity | Proposed fix |
|---|---|---|---|---|
| 5.1 | 9 wizard toggles do nothing (Live settings ×4, Pairing ×4 + Guests, Late registration). Step 4 even reports them. | `step2`/`step3`/`step4`, `organiser-session-wizard-types.ts` | High (misleading) | Hide; keep "Avoid repeat partners" as a fixed note |
| 5.2 | Settings tab: "Check-in Open", "Notify Players of Changes" not saved | `settings-tab.tsx` | High | Hide |
| 5.3 | Rounds tab invents 5 rounds when none are planned and doesn't show real rounds | `rounds-tab.tsx`, `session-adapter.ts` | High | Read `/rounds/current` or show a link to Live |
| 5.4 | Dashboard shows mock numbers while loading or on error | `organiser-dashboard.tsx` (`mockStatStrip`) | High (wrong data) | Skeleton / "—" |
| 5.5 | "View Public Page" → mock `/organisations/lyne-park-tennis` before the first session; the auto-created organisation's name, logo and contacts can't be edited in the Hub | `quick-actions-card.tsx`, dashboard | High | Hide link until it exists; "Your organisation" settings page |
| 5.6 | Mock `role: "Organiser"` and `mockOrganiser` fallbacks on 11 pages | all pages | Medium | Real role (Organiser / Admin) from the user |
| 5.7 | Player row "Message" = "coming soon"; selection checkboxes without actions | `players-table.tsx`, `players-list.tsx` | Medium | Wire to the composer; hide checkboxes |
| 5.8 | Photos tab: disabled button | `photos-tab.tsx` | Low | Hide tab |
| 5.9 | Live pages and buttons on Production lead to "coming soon" | Live entry points | Medium (Prod only) | Hide entry points when Live is off, or enable (decision) |
| 5.10 | Upcoming sessions empty without an organisation | dashboard | Medium | Use `/sessions/mine` |
| 5.11 | Guard and redirect in render on every page (`setLocation` in render) | all pages | Low (UX flash, React warning) | `OrganiserLayout` |
| 5.12 | ~15 unused components and mock-data modules still imported for types | §3.5 list, `lib/organiser-*-mock-data.ts` | Low (maintenance) | Remove; move types to `lib/organiser-types.ts` |
| 5.13 | 400 ms artificial dashboard delay | dashboard | Low | Remove |

Not verified, but needs a check in Phase 3 with a running app: confirmation dialogs for cancel, archive and delete; mobile layout of the Workspace tabs; keyboard access in the wizard steps.

## 6. Assistant: starting point

- **No help or onboarding system exists** in the Hub.
- **A server-side AI integration exists:** `server/services/smartSearchEngine.ts` uses `ANTHROPIC_API_KEY` from the server environment, never the browser, and falls back to deterministic search without it.
- **Proposal for v1:**
  - **Guided contextual help**, a side panel keyed by route and tab, with content generated from one file of verified feature definitions (`client/src/lib/organiser-help.ts`). The same text goes into `FEATURE_CATALOG.md` and `USER_GUIDE.md`.
  - **ON/OFF toggle**, saved per user in `localStorage`. It could later be a user setting.
  - **First-visit steps** for Dashboard, Create Session, Workspace and Live.
- **Optional v1.1:** "Ask a question" through a server endpoint that answers **only from that help file**, with no actions and a fallback to the static help.

## 7. Test coverage today

| Area | Unit / route | E2E (Staging) |
|---|---|---|
| Organiser access (request, approve, guard) | `organizerRequests.test.ts`, `organizerGrantDirect.test.ts` | ORG-AUTH-001/002/003 |
| Live engine (pairing, leaderboard) | `liveEngine.test.ts` | ORG-FLOW-001/003, ORG-RANK-* |
| Seasons, series, rankings, reports | — | ORG-FLOW, ORG-RANK, ORG-REPORT (12 tests) |
| Organisation delete cascade | `organizationCascade*.test.ts` | ADMIN-003/007/008 |
| Play integration | — | PLAY-001…006 |
| **Not covered** | Wizard, Workspace tabs, check-in, invite, templates, players page, dashboard, mobile layouts, Assistant | — |

## 8. Decisions needed before Phase 2

1. **Session types:** approve the 4 categories in §4, and decide where Junior Event goes.
2. **Not-implemented controls (5.1, 5.2, 5.7, 5.8):** hide now, or implement any of them for the demo? For example QR check-in, Photos, Message player.
3. **Live on Production:** keep Staging-only for now (hide Live entry points on Production), or plan enabling it.
4. **Organisation:** add a "Your organisation" page (name, logo, contacts, website)? Today it is created automatically with a default name, and nothing in the Hub edits it.
5. **Paid sessions:** show the price only (current), or is payment at registration planned?
6. **Policy texts:** keep them inside the description, or add proper fields so Edit can restore them?
7. **Assistant:** guided help v1 first (recommended), then optional AI Q&A from the same help file?
