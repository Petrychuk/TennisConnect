# TC Live v1: test coverage

Status on 30 Oct 2026: **Passed** = executed here; **Not run** = written, needs Staging or Production. ORG-FLOW-001/003 and ORG-RANK (results → rankings, reports) are not duplicated.

## Unit

| File | Covers | Status |
|---|---|---|
| `server/services/liveEngine.test.ts` (`npm run test:live-engine`) | singles / doubles pairing; court cap; rests (fewest-rested rest first, rotation, odd counts); partner rotation over rounds; no double booking; too few players → no match; leaderboard: confirmed only, draws, tie-break order, abandoned / unscored ignored | **Passed** 14/14 |
| `shared/liveRules.test.ts` | score validation (0–99, whole, not 0–0, draws); go-live readiness per mode; round minimum per mode | **Passed** 3/3 |
| `server/lib/liveFeature.test.ts` | flag parsing (off by default, internal, on), DB_ENV no longer decides, internal accounts list | **Passed** 3/3 |
| `client/src/lib/organiserHub.test.ts` | Live screen guards: no fake share, phone tabs, shared rules, unscored handling, refetch, withdraw reachable, no DB_ENV | **Passed** (in 77/77) |
| `tests/safety/environment-guard.unit.ts` | `@prod-live-internal` selection, confirmation, refusal off Production, no suite mixing, per-test allowlist, write allowlist | **Passed** (in 171/171) |

Randomised check (not committed, run here): 1,500 simulated doubles sessions (8–16 players, 3–7 rounds), 0 partner repeats, rest spread ≤ 1.

## API / integration (real router, fake storage)

| File | Covers | Status |
|---|---|---|
| `server/routes/organizerLive.test.ts` | flag off / garbage → 404 for owner and guest, nothing reaches storage; kill switch keeps history and finish; internal mode; owner / other organiser / player / guest; cross-session match and registration (IDOR); go-live readiness (withdrawn / waitlisted don't count), idempotent go-live; score validation; 409 + codes; finish with unscored; internal sessions: create marker, join, invite, publish without review | **Passed** 8/8 |
| `server/routes/organizerOwnership.test.ts` | Batch 1/2 ownership, incl. a Live match route | **Passed** 8/8 |
| Database integration (row lock, conditional updates) | — | **Not written**: `server/db.ts` can't target a test database (follow-up). Covered by LIVE-014 |

## Playwright, Staging (`tests/live/live-engine.spec.ts`, phase hub-msg-admin, needs `TC_LIVE_ENABLED=true`)

| ID | Scenario | Status |
|---|---|---|
| LIVE-001 | Create singles in the wizard: format and courts saved; a draft can't go live | Not run |
| LIVE-002 | Check-in through Live; waitlisted refused; Go Live blocker text; idempotent check-in | Not run |
| LIVE-003 | Go Live; repeated go-live harmless | Not run |
| LIVE-004 | Round 1: courts, one match per court, resting count | Not run |
| LIVE-005 | 0–0 refused (screen + API); score saved; correction | Not run |
| LIVE-006 | Next round blocked until all scored (409); rester plays round 2 | Not run |
| LIVE-007 | Leaderboard order and positions | Not run |
| LIVE-008 | End with an unscored match → "End anyway"; abandoned; history; results; no scores after finish | Not run |
| LIVE-009 | Doubles 8 players / 2 courts → 2v2, leaderboard | Not run |
| LIVE-010 | Doubles 5 players: a different rester each round; 3 available → refused, no empty round | Not run |
| LIVE-011 | Late arrival joins; withdrawn leaves; back in | Not run |
| LIVE-012 | Reload and a second device (tablet) see the same state without reload | Not run |
| LIVE-013 | Other organiser 403 on generate / score / finish / current; Live page not found; guest 401; nothing changed | Not run |
| LIVE-014 | Concurrent go-live, generate ×3 (one round), simultaneous last scores close the round, duplicate score, concurrent finish | Not run |
| LIVE-015 | Live off: unavailable screen, 404s, history readable. **Skips on Staging** (Live on); run against a local server with `TC_LIVE_ENABLED=false` | Not run |
| LIVE-016 | Phone 390 and tablet 768: 44 px controls, check-in, go live, score, section tabs, no overflow (2 tests) | Not run |

Also updated: ORG-WS-002 / ORG-WS-004 read the flag instead of `dbEnv`.

## Playwright, Production internal (`tests/prod-live-internal/`, `@prod-live-internal`)

| ID | Scenario | Status |
|---|---|---|
| LIVE-PROD-001 | Session is `isInternalTest`, only allowlisted players; invisible: Play list, public details (404), this-week, organisation page | Not run (needs approval) |
| LIVE-PROD-002 | Check in, go live, round, scores, leaderboard, finish; history readable; still invisible | Not run (needs approval) |

Selected only with `TEST_ENV=production E2E_PROD_SUITE=prod-live-internal E2E_CONFIRM_PROD_LIVE_INTERNAL=<session id>` and the `E2E_PROD_LIVE_*` variables. Writes are limited to that session's Live routes, every write is written to an audit file, and nothing is deleted. Listing verified here: default Production = 33 prod-safe tests; opt-in = these 2 only; missing variables or a non-Production target are refused.
