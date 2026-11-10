# Organiser Hub: technical reference

Covers Phase 2 Batches 1–2 (30 Oct 2026, branch `feature/organiser-hub-v2`). Functional status lives in `FUNCTIONAL_AUDIT.md`, gaps in `KNOWN_LIMITATIONS.md`.

## Shared modules (`shared/`, pure, unit-tested)

| Module | What it decides | Used by |
|---|---|---|
| `sessionCategories.ts` | The four categories and which stored `sessions.type` keys belong to each; `usesMatchFormat`, `usesLiveRounds`; `sessionCategoryOf(type)` (unknown → Other), `isCompetitionType`, `ALL_SESSION_FORMATS` | Wizard steps 1/3, wizard → insert mapping, Workspace tabs and primary action, session cards, Play, event modal, recommendation engine, smart search |
| `sessionPolicies.ts` | Rules / refund / late-arrival / cancellation: `readSessionPolicies(session)` (columns first, then legacy `"Rules: "` paragraphs in the description), `policyColumns()` for saving (trim, empty → `null`) | Wizard, Edit Session, Workspace Format tab, `storage.getPublicSessionById`, Play session page, event modal |
| `sessionActions.ts` | `canInviteToSession(status, endAt)` (published/live, not ended), `canAnnounceToSession(status)` (not draft) | Workspace menu, Players tab, `POST /sessions/:id/invite` |
| `organizationProfile.ts` | What an organiser may set on their organisation: name (2–120), description (≤2000), website (http/https only, `https://` added), email, phone. Empty → `null`, unknown keys dropped | `/organiser/organisation`, `POST /organizations`, `PUT /organizations/:id` |

## Client building blocks

- `components/organiser/ui/organiser-layout.tsx`: `OrganiserLayout` (gate, sidebar ≥1280 px, compact bar with menu button 768–1279 px, bottom bar <768 px), `OrganiserAccessGate` (guest → `/auth?returnTo=<path>` from an effect; access = `isOrganizer || isAdmin`), `useOrganiserIdentity()`.
- `lib/use-live-available.ts`: `useLiveAvailable()` = `/api/health` `dbEnv === "staging"`. Every Live entry point checks it **and** `usesLiveRounds`.
- `lib/organiser-export.ts`: player CSV, every cell quoted, leading `= + - @` defused.
- `pages/organiser/organisation.tsx`: "Your Organisation". Validates with `organizationProfileSchema` before sending, shows field errors, saves via `updateOrganization` / `createOrganizationWithProfile`, updates the `["/api/organizer/organizations/me"]` cache.
- `components/organiser/sessions/workspace/rounds-tab.tsx`: `useQuery(["/api/organizer/sessions", id, "rounds"])`.
- `lib/organiser-export.ts`: `playersCsv` and `resultsCsv` (Results → Export); `shared/sessionActions.ts` `publicSessionPath()` is the only source of a session's shareable link (`/play/:id`, published or live and public).

## API (all under `/api/organizer`)

| Route | Auth | Notes |
|---|---|---|
| `GET /sessions/:id/rounds` | session owner or admin: the same read rule as `GET /sessions/:id`, `/divisions` and `/registrations` (writes stay owner-only) | **New.** `[{ round, matches: MatchWithPlayers[] }]`, rounds ascending, matches by court number. Not Staging-gated (read only); `[]` when the session never ran in Live |
| `GET /organizations/me` | signed in | Unchanged |
| `POST /organizations` | organiser | Now validates with `organizationProfileSchema` (was `insertOrganizationSchema`, which allowed `verified` / `listingType`) |
| `PUT /organizations/:id` | organiser, owner | Same: `organizationProfileUpdateSchema`; another organiser's id → 404 |
| `POST /sessions/:id/invite` | organiser, owns session | Now 400 unless `canInviteToSession(status, endAt)` |
| Check-in / remove / waitlist / live-status / match start / match score | organiser, owns session | Batch 1: `requireRegistrationInSession` / `requireMatchInSession`; a registration or match from another session → 404 |

Storage additions: `getRegistrationById`, `getMatchById` (Batch 1), `getSessionRounds(sessionId)` (Batch 2). `getPublicSessionById` now returns `policies`.

## Database

`migrations/0034_sessions_policies.sql`: four nullable `text` columns on `sessions`: `rules_text`, `refund_policy`, `late_policy`, `cancellation_policy` (`shared/schema.ts`: `rulesText`, `refundPolicy`, `latePolicy`, `cancellationPolicy`). Additive and idempotent. **Apply before deploying the code**, because Drizzle selects every mapped column. No backfill: legacy policies are read from descriptions and moved on the organiser's next save.

No other schema change. Session type keys are unchanged; `junior-development` is a new key and needs no migration (`type` is free text).

## Tests

| Command | Files added or changed in Batches 1–2 |
|---|---|
| `npm run test:ui` | `client/src/lib/organiserHub.test.ts` (source guards: layout, no mock data, wizard by category, no unsupported format claims, rounds, policies, organisation page, session actions), `shared/sessionCategories.test.ts`, `shared/sessionPolicies.test.ts`, `shared/sessionActions.test.ts`, `shared/organizationProfile.test.ts` |
| `npm run test:server-unit` | `server/routes/organizerOwnership.test.ts`: cross-session IDOR, rounds endpoint, organisation PUT/POST fields and ownership, invite to a cancelled session |
| Playwright (Staging, phase `hub-msg-admin`) | `tests/organiser/organiser-hub-responsive.spec.ts`: ORG-RESP-001 (7 Hub views × 6 viewports: overflow, navigation, screenshots), ORG-RESP-002 (wizard category and check-in by touch at 360 px / 768 px, check-in confirmed by the API), ORG-RESP-003 (organisation edit at 390 px, persisted, contacts on the public page at 360 px). Run-owned data only; cleaned up by the run-scoped teardown. Also ORG-PERM, ORG-WIZ, ORG-WS, ORG-ACT and PLAY-007…009: see `docs/testing/E2E_COVERAGE_MATRIX.md` |

Viewports: 1440×900, 1280×800, 768×1024, 1024×768, 390×844, 360×800.
