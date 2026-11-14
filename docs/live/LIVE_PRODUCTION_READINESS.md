# TC Live v1: production readiness review

## Feature flag and kill switch

- `TC_LIVE_ENABLED` (`server/lib/liveFeature.ts`), read on every request:
  - unset or `false`: off, the default;
  - `internal`: internal test sessions only;
  - `true` / `1` / `on`: every session.

  Any other value counts as off.
- Server-enforced on every Live control route:
  - `requireLiveEnabled` runs before auth: a 404 that reveals nothing;
  - `requireLiveForSession` runs after ownership: internal mode lets only internal sessions through.
- The client only hides entry points (`GET /api/organizer/features`), so the API never depends on the UI.
- **Kill switch:** set `TC_LIVE_ENABLED=false` and redeploy/restart (Railway applies variable changes with a redeploy). Effect:
  - no go-live, rounds, scores or player-status changes;
  - stored rounds, scores, leaderboards and results stay readable;
  - a session that was live can still be ended (`/finish` is deliberately not flag-gated);
  - no data is deleted.

## Database

| Migration | Change | Risk | Order |
|---|---|---|---|
| `0034_sessions_policies.sql` (Organiser Hub Batch 2) | 4 nullable text columns | None (additive) | Before Batch 2 code |
| `0035_sessions_internal_test.sql` | `sessions.is_internal_test boolean NOT NULL DEFAULT false` | Postgres 11+ adds a column with a constant default without a table rewrite; every existing session = not internal | **Before** this code: every `sessions` select lists it |

Both use `IF NOT EXISTS`. No backfill, no data change. `matches.status` gains the value `abandoned` (free text, no migration).

**Rollback:** redeploy the previous build. The new columns are ignored by old code, and dropping them isn't needed. If a rollback must also remove them: `ALTER TABLE sessions DROP COLUMN is_internal_test` — only after the old code is running. Abandoned matches stay abandoned; old code shows them as not started, and they're never counted.

## Transactions, idempotency, concurrency

| Operation | Guarantee |
|---|---|
| Check in | Registered only; a second check-in keeps the first time (conditional update `checked_in_at IS NULL`) |
| Go live | Conditional `status = 'published'`; already live returns 200 unchanged |
| Generate round | Transaction; re-checks the active round inside; unique `(session_id, round_number)` backstop → 409 `ROUND_IN_PROGRESS` |
| Start match | Conditional `status = 'pending'`; already playing returns it; confirmed / abandoned → 409 |
| Score | Transaction; **round row locked `FOR UPDATE`** before the round-close check (no lost round close); re-submitting the same or a corrected score is the same final state |
| Finish | Transaction; session row locked; live only; unscored → 409 `UNSCORED_MATCHES` unless `force`; already completed returns 200 unchanged |

**Not executed here:** the row-lock and conditional-update behaviour needs Postgres. LIVE-014 exercises it on Staging. A pg integration test needs `server/db.ts` to accept a test connection (follow-up).

## Authorisation (every mutation)

`requireAuth` → `requireOrganizer` → `requireOwnSession` (owner only; admins are not exempt for writes) → per-object `requireRegistrationInSession` / `requireMatchInSession` (IDOR, 404) → flag. Covered by `server/routes/organizerLive.test.ts` and `organizerOwnership.test.ts`, and by LIVE-013 on Staging.

## Internal test isolation (Production)

- `TC_INTERNAL_TEST_EMAILS` (per environment) lists the internal accounts. A session created by one is `is_internal_test` (server-set; the request body can't set it).
- Internal sessions are excluded from:
  - `getPublicSessions`, used by Play, recommendations and smart search;
  - `getPublicSessionById`;
  - the discovery duplicate check;
  - organisation pages and the profile Organising tab;
  - "this week";
  - `GET /api/stats` counts.

  The sitemap has no sessions. Rankings are per organiser (only the internal organiser's own).
- Join and invite are allowed for internal accounts only. Publishing skips review, so no admin is messaged.
- **Still visible:** the internal accounts' own profiles, in the player directory, until an admin hides them (runbook step).

## Logs

`[TC LIVE]` lines:
- session created as internal;
- went live (available count, courts);
- round generated (matches, resting);
- match confirmed / corrected;
- finished (abandoned count);
- blocked request (method, path, mode).

No personal data beyond ids.

## Open before Production enablement

1. Full Staging regression with `TC_LIVE_ENABLED=true`, including LIVE-001…016 and manual QA on desktop, tablet, Android Chrome and iOS Safari.
2. Production backup confirmed; migrations 0034 and 0035 applied.
3. Internal accounts created on Production (not Staging copies) and hidden from directories; `TC_INTERNAL_TEST_EMAILS` set; `TC_LIVE_ENABLED=internal`.
4. `@prod-live-internal` run after approval; logs reviewed.
5. Separate approval for `TC_LIVE_ENABLED=true`.
