# TC Live v1: functional audit

30 Oct 2026, branch `feature/organiser-hub-v2`. Code review of the engine (`server/services/liveEngine.ts`), storage (`server/storage.ts` Live methods), routes (`server/routes/organizer.ts`), the Live screen (`client/src/pages/organiser/session-live.tsx`) and tests, followed by fixes. **Nothing here was executed against Staging or Production.**

Classes: **WORKING**, **PARTIAL**, **BROKEN**, **MISSING**, **MISLEADING** (a control that suggests something that doesn't happen). Priority: P0 data loss, wrong results or security; P1 a flow that can't be completed or gives wrong state; P2 quality.

## Flow

| Step | Before | Now |
|---|---|---|
| Create session (format, courts) | WORKING (wizard) | Unchanged; LIVE-001 |
| Registration | WORKING | Unchanged (PLAY tests) |
| Check-in | **BROKEN (P1):** waitlisted, invited and cancelled registrations could be checked in, and then got paired. A double tap overwrote the check-in time | Registered players only (400 otherwise); idempotent (first time kept) |
| Go live | **PARTIAL (P1):** a fixed minimum of 2 players, so doubles could go live with 2–3 players. A repeated click gave an error. The status update was unconditional | The minimum follows the mode (2 singles, 4 doubles) and counts only available players. Idempotent. Conditional `published → live` |
| Pairing: singles / doubles, courts, rests | WORKING with gaps | See next row |
| Partner rotation | **PARTIAL (P1):** one greedy pass repeated partners while fresh ones existed (8 players, round 3) | Best of 60 shuffled greedy passes, partner repeats weighted ×100. 1,500 random sessions: no repeats, rest spread ≤ 1 |
| Too few players for doubles | **BROKEN (P1):** 2–3 available players produced an empty, already-completed round and a rest for everyone, on every click | Refused with the reason (`roundProblem`) |
| Round generation, concurrency | WORKING: transaction + unique `(session, round)` backstop | Errors are typed (409 `ROUND_IN_PROGRESS`) |
| Start match | **BROKEN (P1):** set **any** match to "playing", a confirmed one too, which reopened a closed round. Allowed outside Live | `pending → playing` only, while live; repeat = no-op |
| Score entry | **PARTIAL (P1):** any non-negative integer (including 0–0 and 1,000). The **round-close race:** two last scores saved together each saw the other unconfirmed (READ COMMITTED), so the round stayed active and "Generate Next Round" stayed locked | 0–99 whole games, not 0–0 (server and screen). The round row is locked (`SELECT … FOR UPDATE`) before the round-close check |
| Score correction | Server allowed it; **MISSING in UI** | "Correct score" on a confirmed match while live |
| Withdrawal / sitting out / back in | **MISSING (P1) in UI:** the endpoint existed, nothing called it | Players section: Sit out, Withdraw, Back in |
| Late arrival | PARTIAL: Players tab check-in during Live | Same, with state shown per player |
| Leaderboard | **PARTIAL (P2):** equal players in database row order (can swap between loads); draws ignored in ordering; waitlisted / never-arrived registrants listed as 0–0 | Wins, draws, games difference, games won, then id. Only checked-in players and players with matches |
| Finish | **BROKEN (P0):** `finishSession` had no status check, so it completed drafts, cancelled sessions, anything. It left the open round "active" and its unscored matches pending | Live only (409 otherwise); idempotent. Unscored matches need `force`: they're marked `abandoned` (never counted) and the round is closed, in one transaction |
| History | PARTIAL: Live showed only the current round | All rounds on the Live screen and in the Workspace (Batch 2 endpoint); results and export after finish |
| Reconnect / second device | **MISSING (P1):** no refetching; another device stayed stale until reloaded | Refetch every 10 s while live, on focus and on reconnect; offline banner |
| Phone / tablet | **BROKEN (P1):** the section rail was desktop-only, so Players, Leaderboard, Messages and Settings were unreachable below 1024 px. Score inputs were 32 px | One section switcher for every size (TC-189 phase 3); 44 px controls; 48 px score fields; numeric keypad |
| "Share Live Board" | **MISLEADING:** copied the organiser's own URL as a "live board" | Removed (no public board exists) |
| End Session | PARTIAL: no confirmation | Confirmation; explicit "End anyway" for unscored matches |
| Error messages | PARTIAL: raw `409: {"message":…}` in toasts | The server's message |

## Access and environment

| Item | Before | Now |
|---|---|---|
| Enablement | `requireStagingEnv`: DB_ENV === "staging", no way to enable it elsewhere | `TC_LIVE_ENABLED` = off (default) / internal / on, per environment; client reads `GET /api/organizer/features` |
| Disabled behaviour | 404 before auth | Same for every control route. History reads (`/rounds`, `/leaderboard`, results) stay; `/finish` stays so the kill switch can't strand a live session |
| Ownership / IDOR | WORKING (Batch 1: `requireOwnSession` + `requireRegistrationInSession` / `requireMatchInSession`) | Unchanged; route tests extended |
| Production test data | **MISSING** | `sessions.is_internal_test` (server-set from `TC_INTERNAL_TEST_EMAILS`), excluded from every public listing; join and invite restricted; published without review or admin messages |

## TC-189 re-check (14 Nov 2026)

| Item | Before | Now |
|---|---|---|
| Status by the clock | **BROKEN (P1):** a time-based job archived sessions after their end time - including Live sessions running late, which lost their open round | Removed. Status changes only by people; public availability is derived (`shared/sessionLifecycle.ts`) |
| Late start | PARTIAL: nothing told the organiser a session was due | Ready to Start from 2 h before; Start Live any time after |
| Player leaves mid-match | **MISSING (P1):** the round stayed open until a made-up score was entered | Not played (never counts, closes the round); the player is flagged on the court |
| Late arrival after the draw | PARTIAL: waited a whole round | Redo round while no match has started (409 `ROUND_STARTED` after) |
| Archive a live session | **BROKEN (P1):** status jumped to archived with the round open and matches pending | 409; End Session first |
| Cancel a live or completed session | **BROKEN (P1):** every player was told it was cancelled | 409; cancel only before it runs |
| Roster after Finish | **BROKEN (P1):** check-in / remove / waitlist changed who was on the final leaderboard | 409 (`requireRosterOpen`); controls hidden |
| Results after archiving | **BROKEN (P2):** hidden | Shown, read-only |
| Live screen | PARTIAL: two navigations, five stat tiles, End Session twice | One sticky header and switcher, round card with the one next action, court cards (phase 3) |

## Known limitations (v1)

- Organiser-only scoring, with no player self-report or confirmation step. `reportedBy` / `confirmedBy` are kept for later.
- Redo round replaces the drawn round (deleted with its matches) - allowed only while every match is pending, so no score is ever lost.
- One match per court, with every court the same mode. Doubles with 6 players on 2 courts gives one match and 2 resting (no mixed singles + doubles).
- `plannedRoundsCount` is informational; rounds continue until the organiser ends the session.
- No public spectator board.
- The leaderboard is computed on demand from confirmed matches; nothing is written to tournament history.
- Kill switch: changing `TC_LIVE_ENABLED` needs a restart/redeploy (minutes, not instant).
- Concurrency fixes (row lock, conditional updates) are reviewed but **not executed** here: no Postgres driver locally, and `server/db.ts` (global pool, SSL forced) can't be pointed at CI's throwaway Postgres without refactoring. LIVE-014 checks them on Staging.
