# TC Live v1: scope

## In scope

Social Play sessions (`social`, `americano`, `mexicano`, `round-robin`, `king-of-the-court`; also `custom`) played as **singles or doubles**:

1. Session with a match format (`matchMode`) and a court count. Created in the wizard; changed in Edit.
2. Registration (Play) and **check-in** of registered players (Live screen or Workspace Players tab).
3. **Go live**: published session, courts set, a full court of available players (2 singles / 4 doubles).
4. **Rounds**: available players are shuffled onto courts. Repeat partners and opponents are avoided; when there are more players than places, rests rotate evenly. One round at a time.
5. **Scores**: the organiser enters games per side (0–99, not 0–0; draws allowed) and can correct a score while the session is live. A round closes when every match has a score.
6. **During play**: late arrivals (check in), sit out / withdraw / back in, from the next round.
7. **Leaderboard**: wins, draws, games difference, games won.
8. **Finish**: confirmation; unscored matches only with "End anyway" (marked not played).
9. **History**: every round, the final leaderboard, results and CSV export, readable after the session and with Live switched off.
10. Phone, tablet and desktop; a second device and reconnects show the same session.

Competition formats (`tournament`, `league`, `club-championship`, `junior-event`) and `custom` use the same engine: rounds are shuffled the same way. Coaching & Fitness has no Live.

## Out of scope (not offered, not claimed)

Knockout draws, seeding, tournament brackets, qualifying; leagues with fixtures and team (home/away) scoring; mixed singles + doubles in one round; results-based pairing (true Mexicano) and court promotion (true King of the Court); player self-scoring and score confirmation; payments; QR or self check-in; a public spectator board; writing results to tournament history.

## Environments

| | Staging | Production |
|---|---|---|
| `TC_LIVE_ENABLED` | `true` | `false` until approved; `internal` for internal validation; `true` only with separate approval for real organisers |
| Test data | Run-owned fixtures (seed hooks), cleaned up per run | Internal test accounts and sessions only (`TC_INTERNAL_TEST_EMAILS`), invisible to the public, never deleted automatically |
