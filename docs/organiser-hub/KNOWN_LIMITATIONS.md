# Organiser Hub: known limitations

Living list. Updated with Phase 2, Batch 2 (30 Oct 2026). For each item: what the organiser sees, why, and what would change it.

## Hidden on purpose (no working implementation behind them)

| Was | Where | Why hidden | What it needs |
|---|---|---|---|
| Pairing toggles: Random partners, Avoid repeat partners, Balance waiting list, Use player rating, Allow guests | Create Session → Format & rules | Never saved; the Live engine has fixed rules (shuffle, avoid repeats, even rests) and no rating system exists | Settings stored on the session and read by `liveEngine.planRound`; a rating model |
| Live settings: QR check-in, Live scores, Auto next round, Publish results | Create Session → Format & rules | Never saved; none of these exist | QR check-in flow, player-facing live scores, auto-advance, results publishing rules |
| Allow late registration | Create Session → Date & registration | Never sent; registration simply closes at the set time | A rule in the join endpoint |
| Check-in Open, Notify Players of Changes | Session → Settings | Only said "not saved yet"; there's no player self check-in and no change-notification setting | Player self check-in; a notification preference |
| Photos tab | Session Workspace | Its only control was a disabled upload button | Session photo storage and upload |
| Player selection checkboxes | Session → Players | No bulk action used the selection | Bulk check-in / message / move |
| Live entry points where Live is off | Session cards, Workspace, Overview, Dashboard, Rounds tab | TC Live runs only where `TC_LIVE_ENABLED` allows it for the session (TC Live v1, `docs/live/`) | Setting the flag (separately approved per environment) |
| Match format, Rounds / Results tabs, Live | Coaching & Fitness sessions | Coach-led: no matches or scores | — (by design) |
| Invite Players | Drafts, sessions in review, cancelled, finished, archived | The invite links to a public page that doesn't exist for them | — (by design) |
| Send Announcement | Drafts | Nobody can be registered yet | — (by design) |

Existing data is untouched: the old draft fields stay in the wizard's types, existing descriptions keep their text, and existing session type keys are unchanged.

## Limitations of supported features

- **TC Live is behind `TC_LIVE_ENABLED`** (off by default, set per environment; see `docs/live/`). Where it's off, organisers run a session from the Players tab: check-in, waiting list, remove, message. The Rounds tab and results work everywhere but only have data where Live has run.
- **Live engine.** Singles or doubles, games-count scoring, organiser enters scores. Every format (Americano, Mexicano, King of the Court, Round Robin, Tournament, League, Club Championship) is played the same way: rounds are shuffled, avoiding repeat partners and opponents. There are no draws, seeding, knockout brackets, qualifying, results-based pairing, court promotion or team (home/away) scoring. The wizard says so where it matters.
- **Paid sessions.** Price is shown only; TennisConnect doesn't take payment.
- **Rules and policies on older sessions.** Sessions saved before migration `0034` keep the policies inside their description. They're displayed as separate policies, and moved into their own fields the next time the organiser saves the session.
- **Organisation logo and cover.** Not editable: there's no organisation image upload, and neither image is shown anywhere. Stored values are left as they are. Slug, status, verification and listing type are set by the server or admins.
- **Organisation contacts are public.** Website, email and phone are shown to everyone on the organisation's public page; the form says so.
- **Notification bell.** Unread messages only; no session events.

## Deploy order

`migrations/0034_sessions_policies.sql` (four nullable `text` columns on `sessions`) must be applied **before** the Batch 2 code is deployed: every query on `sessions` selects all mapped columns. It's additive (`ADD COLUMN IF NOT EXISTS`), takes no data and can be applied while the current code is running.

## Not verified yet

Batches 1 and 2 are checked by code-level tests: unit, route and source guards. The Playwright specs for them have been written and classified but **not run against Staging**:
- `organiser-hub-responsive` (ORG-RESP, six viewports);
- `organiser-permissions`, `organiser-wizard`, `organiser-workspace`, `organiser-session-actions`;
- `play-session-details`;
- the updated ORG-AUTH tests.

Layout on phone and tablet, and every page with real data, are therefore unverified until that run. See `docs/testing/REGRESSION_RESULTS.md` for the run order and `docs/testing/E2E_COVERAGE_MATRIX.md` for what each test covers.

## Drafts
See `docs/organiser-hub/DRAFTS.md`: unselected type saves as `social`; null player/court counts resume as 0; no server-side idempotency key; `updateSessionIfUnchanged` is covered by route tests with a fake store, not against Postgres; ORG-DRAFT specs have not been run (no app/Staging available in this environment).
