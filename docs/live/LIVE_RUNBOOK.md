# TC Live v1: runbook

Commands are for PowerShell on the operator's machine. Values for secrets are never written here.

## Variables (server)

| Variable | Values | Where |
|---|---|---|
| `TC_LIVE_ENABLED` | `false` (default) / `internal` / `true` | Each Railway service separately |
| `TC_INTERNAL_TEST_EMAILS` | comma-separated internal account emails | Production: its own internal accounts. Staging: optional |

## Enable on Staging

1. Apply `migrations/0034_sessions_policies.sql` and `0035_sessions_internal_test.sql` to the **Staging** database.
2. Deploy the branch to Staging.
3. Set `TC_LIVE_ENABLED=true` on the Staging service. Railway redeploys.
4. Check: signed in as an organiser, `GET /api/organizer/features` → `{"live":"on"}`.
5. Run the E2E phase that includes `tests/live/live-engine.spec.ts` (see `docs/testing/TEST_ENVIRONMENTS.md`), then cleanup (dry run, then `--apply`).

LIVE-015 needs Live off: run it against a local server started with `TC_LIVE_ENABLED=false`.

## Internal validation on Production (only after Staging sign-off and approval)

1. Back up the Production database. Apply 0034 and 0035.
2. Deploy with `TC_LIVE_ENABLED=false`. Check that nothing changed for users.
3. Create Production-only internal accounts: one organiser and 4–8 players, with emails on a domain you control. These must never be Staging accounts.
   - Grant organiser access to the organiser.
   - An admin hides all of them from directories (Admin → Users → Hide).
4. Set `TC_INTERNAL_TEST_EMAILS=<those emails>` and `TC_LIVE_ENABLED=internal`.
5. As the internal organiser, create a session:
   - Social Play, singles or doubles, with courts set;
   - it is marked internal automatically, and publishing skips review.

   Each internal player registers for it (by its link). Note the session id and the players' profile slugs.
6. Check invisibility by hand: signed out, the session is not on Play or the organisation page, and `/play/<id>` is "not found".
7. Run the suite:
   ```powershell
   $env:TEST_ENV="production"; $env:BASE_URL="https://www.tennisconnect.com.au"
   $env:E2E_PROD_SUITE="prod-live-internal"
   $env:E2E_PROD_LIVE_SESSION_ID="<session id>"; $env:E2E_CONFIRM_PROD_LIVE_INTERNAL="<session id>"
   $env:E2E_PROD_LIVE_ORGANISER_EMAIL="<email>"; $env:E2E_PROD_LIVE_ORGANISER_PASSWORD="<password>"
   $env:E2E_PROD_LIVE_PLAYER_SLUGS="<slug1>,<slug2>,..."
   npx playwright test
   ```
   Keep the audit file `test-results/prod-live-internal-audit.jsonl` and the HTML report.
8. Review the `[TC LIVE]` log lines and Play once more. The completed session stays as invisible history. A new run needs a new session.
9. Remove the variables from the shell: `Remove-Item Env:E2E_PROD_*`.

## Enable for real organisers (separate approval)

Set `TC_LIVE_ENABLED=true`. Internal accounts and sessions stay isolated.

## Kill switch

Set `TC_LIVE_ENABLED=false` (Railway redeploys).
- Live controls 404 and the Live screen says it's switched off.
- Sessions already live can still be ended.
- Rounds, scores and results stay readable, and nothing is deleted.

Turn it back on with the previous value.

## Recovery

| Situation | Action |
|---|---|
| Round won't advance | Every court needs a score or **Not played**. Scores can be corrected. With the row lock, a concurrent save can no longer leave a fully scored round open |
| A player left mid-session | Players → Withdraw (applies from the next round). Their current court is flagged: enter the score so far, or mark it **Not played** |
| Someone arrived just after the draw | Courts → "Joins next round" → **Redo round with them** (only before any match starts); otherwise they play from the next round |
| Session stuck "live" (organiser gone) | The organiser (or someone signed in as the owner) uses End Session → End anyway. Unscored matches become "not played". Admins can't end other organisers' sessions (owner-only writes) |
| Wrong score after finishing | Not editable after Completed (by design). Correct it before ending |
| Organiser wants to cancel or archive a live session | Refused (409). End Session first; a finished session can be archived (results kept), never cancelled |
| Player list needs changing after the session | Refused after End Session (the results depend on it). Duplicate the session to run it again |
| Live misbehaving | Kill switch; report with the `[TC LIVE]` lines for that session id |
