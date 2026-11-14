# TC Live v1 (TC-189): reconciliation and plan

10 Nov 2026, branch `feature/organiser-hub-v2`. Builds on the 30 Oct audit (`LIVE_FUNCTIONAL_AUDIT.md`): the engine, Live routes, flag, ownership checks and the Live screen already exist and are reused. No parallel system, no new database statuses.

## One lifecycle (`shared/sessionLifecycle.ts`)

Stored status changes only by people: draft → published (publish) → live (organiser starts TC Live) → completed (organiser finishes) → archived (organiser archives, never while live); cancelled only before it runs (draft, pending review, published). **The clock never changes it.**

| Question | Rule | Used by |
|---|---|---|
| Publicly listed? (`isPubliclyActive`) | published, start time not reached, registration not closed | Play list, organisation page, this week, recommendations (SQL: `publiclyActiveConditions` in `server/storage.ts`) |
| Can a player join / cancel? (`registrationBlockReason`) | no once registration closed, the start time came, live, finished or cancelled | `POST/DELETE /sessions/:id/join`, public page, Quick View |
| Organiser's "Ready to Start" (`isReadyToStart`) | published, from 2 h before the start and any time after (late start) | Sessions list, grid, Workspace header, Home upcoming; primary action becomes **Start Live** |
| What players see (`computePublicStatus`) | open / almost full / upcoming → listed; full, waitlist, registration window over → "Registration Closed" (only the waiting list stays, when on); start time reached, live, completed, archived → "Archived", read-only | Play cards, `/play/:id` |

Removed: the time-based archiving (on opening the organiser's list, and the 10-minute job). It ended Live sessions that ran late and hid completed results. Completed and archived sessions can't be edited (409); duplicate to run again.

## Phases

1. Reconciliation and status model - this document.
2. Status and navigation - the lifecycle above, Ready to Start / Start Live everywhere the organiser sees the session. **Done.**
3. TC Live screen redesign - one mobile-first screen: status, round, courts as large cards, score entry, leaderboard, one primary action per state. **Done:** sticky header (name, high-contrast LIVE / CHECK-IN / COMPLETED, mode · round · checked in · courts, End Session once), one section switcher `organiser-live-tab-*` for all screen sizes (the desktop rail `organiser-live-nav-*`, the Settings section and the five stat tiles are gone), round card with scores-in progress and resting players, court cards with large score fields, leaderboard beside the courts on wide screens (`organiser-session-live-leaderboard-mini`, no row ids). Test ids used by the specs are unchanged; LIVE-007 / LIVE-011 now use `organiser-live-tab-*`.
4. Round generation and score management - reuse `liveEngine.ts`; gaps from the audit (withdrawals, late arrivals) re-checked on the new screen. **Done:**
   - Re-check found two dead ends. A player leaving mid-match left the round open until someone typed a made-up score; a late arrival after the draw had to wait a whole round even if nobody had started.
   - **Not played** (`POST /sessions/:id/matches/:matchId/not-played`, `storage.markMatchNotPlayed`): pending / playing → `abandoned`, never counts, closes the round if it was the last open court (same round lock as score entry). Repeat = no-op; a scored match → 409 (correct the score instead). A score can still be entered for it while live.
   - **Redo round** (`POST /sessions/:id/rounds/current/redo`, `generateNextRound(id, { redo: true })`): only while every match in the current round is pending (`redoRoundProblem`, else 409 `ROUND_STARTED`); the round and its matches are deleted and drawn again with the same number in one transaction - a refusal (e.g. too few players now) keeps the old round.
   - Live screen: players marked Sit out / Withdrawn are flagged on the court they're still on; "Joins next round" lists late arrivals and players back in, with **Redo round with them** while nothing has started.
   - Sit out / Withdraw only for registered players (400 for waitlisted, invited, cancelled). Score entry outside Live answers 409 instead of a generic 400.
   - Rules in `shared/liveRules.ts` (`matchClosed`, `notPlayedProblem`, `redoRoundProblem`), used by the server and the screen. Tests: `shared/liveRules.test.ts`, `server/routes/organizerLive.test.ts`, LIVE-018, LIVE-019.
5. Leaderboard and completion - results view in the Workspace, read-only after Finish. **Done:**
   - Gaps found: Archive worked on a live session (status jumped to archived with the round still open and matches pending); Cancel worked on live and completed sessions and told every player "cancelled"; check-in, remove and move to the waiting list still worked after Finish and changed who was on the final leaderboard; archiving a completed session hid its results.
   - Rules in `shared/sessionActions.ts`: `resultsAreFinal` (completed, archived), `canChangeRoster`, `canCancelSession` (draft, pending review, published), `canArchiveSession` (not live). The server enforces them (409, `requireRosterOpen` on check-in / remove / waitlist; cancel; archive), the Hub hides the controls.
   - Results tab: Final badge and note, summary (players, rounds, matches scored, not played), podium, table (played, W, D, L, games, +/−), Send and Export; also for archived sessions. Players tab after Finish: read-only note, no Check In / Check-in All / Remove / Move to Waiting.
   - Live screen after End Session: "Session complete" with **Open Results** (Workspace `?tab=results`).
   - Tests: `shared/sessionActions.test.ts`, `server/routes/organizerLive.test.ts`, LIVE-020.
6. Tests and documentation. **Done:**
   - `server/routes/liveRouteGuards.test.ts` (new, no express or database needed): the guard chain of every Live control route (flag first, owner, Live for this session, match / registration in session), history and Finish outside the flag, `requireRosterOpen` on check-in / remove / waitlist, cancel / archive / results through the shared rules, no WebSockets or Realtime. Checked that removing a guard fails it.
   - `client/src/lib/organiserHub.test.ts`: one section switcher (no `organiser-live-nav-*`), End Session in one place, Not played and Redo round reachable, Open Results after Finish, polling only (no WebSocket / EventSource / Supabase channel), Results / Players / Workspace use the shared rules.
   - Docs brought up to date: `LIVE_V1_SCOPE.md`, `LIVE_FUNCTIONAL_AUDIT.md` (TC-189 re-check), `LIVE_RUNBOOK.md` (recovery), `LIVE_RELEASE_CHECKLIST.md`, `LIVE_TEST_COVERAGE.md`, `E2E_COVERAGE_MATRIX.md`.

## Status model in one place

| Concept | Where it lives | Changes by |
|---|---|---|
| Stored status (draft / pending_review / published / live / completed / archived / cancelled) | `sessions.status` | People only: publish, Start Live, End Session, Archive, Cancel |
| Public availability (listed, joinable) | `shared/sessionLifecycle.ts` `isPubliclyActive`, `registrationBlockReason` | Derived: status + registration window + start time |
| What players see (Open … Registration Closed, Archived) | `server/storage.ts` `computePublicStatus`, `client/src/lib/play-status.ts` | Derived |
| Organiser's Ready to Start / Start Live | `isReadyToStart` | Derived: published, 2 h before the start or later |
| Live state (rounds, matches, player live status) | `session_rounds`, `matches`, `registrations.live_status` | Organiser on the Live screen, only while live |
| Final results | `resultsAreFinal` (completed, archived); leaderboard computed from confirmed matches | Read-only after End Session |

## Verification

Run locally (this checkout had no `express` or React types, so the route tests, `tsc` and the build were not run here):

```powershell
npx tsc --noEmit
npm run build
npx tsx --test shared/sessionLifecycle.test.ts shared/sessionJoinRules.test.ts shared/liveRules.test.ts shared/sessionActions.test.ts
npx tsx --test server/services/liveEngine.test.ts server/routes/liveRouteGuards.test.ts server/routes/organizerLive.test.ts server/routes/organizerOwnership.test.ts
npx tsx --test client/src/lib/organiserHub.test.ts client/src/lib/uiConsistency.test.ts
```

Then on Staging (`TC_LIVE_ENABLED=true`, see `LIVE_RUNBOOK.md`): LIVE-001…020 (LIVE-015 locally with Live off), PLAY-001…013, ORG-ACT-*, ORG-PERM-*, ORG-WS-*. No migrations are needed for TC-189.

## Remaining risks

- Nothing in TC-189 has run against a server yet: Playwright (LIVE-017…020, PLAY-012/013), the route tests and the type check / build are written but unexecuted here.
- Row locking for Not played and Redo round (same pattern as score entry) is reviewed, not executed against Postgres; LIVE-014 covers the older concurrency paths only.
- Redo round deletes the drawn round and its matches (only while all are pending - no score is ever lost). The log line `[TC LIVE] … round N redone` is the record.
- Polling every 10 s while live: two devices can show different states for up to 10 s; every write is checked by the server, so the worst case is a refused action with its reason.
- Known v1 limits are unchanged (`LIVE_FUNCTIONAL_AUDIT.md`): organiser-only scoring, one mode per session, no spectator board.
