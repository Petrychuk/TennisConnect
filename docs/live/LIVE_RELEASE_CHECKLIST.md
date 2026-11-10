# TC Live v1: release checklist

Tick only what was actually done. Each stage needs the previous one.

## 1. Code (branch `feature/organiser-hub-v2`)

- [x] Audit and P0/P1 fixes (`LIVE_FUNCTIONAL_AUDIT.md`)
- [x] `TC_LIVE_ENABLED` flag and kill switch; `requireStagingEnv` removed
- [x] Internal test sessions (`is_internal_test`, migration 0035) and public exclusion
- [x] Unit, route and guard tests passing locally (`LIVE_TEST_COVERAGE.md`)
- [ ] Code review and approval to commit / merge

## 2. Staging

- [ ] Migrations 0034 and 0035 applied to Staging
- [ ] Deployed; `TC_LIVE_ENABLED=true` on Staging
- [ ] `npm run e2e:staging:check` green
- [ ] Full Staging regression, including LIVE-001…016 (LIVE-015 locally with Live off), ORG-*, PLAY-*
- [ ] Run cleanup verified (dry run, apply, verify)
- [ ] Manual QA: desktop Chrome, tablet (iPad), Android Chrome, iOS Safari. Check-in, go live, scores, correction, withdraw, reload mid-round, two devices, end with unscored
- [ ] Concurrency and recovery (LIVE-012, LIVE-014) green; kill switch tried on Staging (off → history readable, live session can be ended → back on)
- [ ] Results recorded in `docs/testing/REGRESSION_RESULTS.md`

## 3. Production preparation (approval required)

- [ ] Backup taken and restore path confirmed
- [ ] Migrations 0034 and 0035 applied **before** the deploy
- [ ] Deployed with `TC_LIVE_ENABLED=false`; smoke `@prod-safe` (33) green
- [ ] Internal Production accounts created, hidden from directories; `TC_INTERNAL_TEST_EMAILS` set
- [ ] Rollback plan reviewed (`LIVE_PRODUCTION_READINESS.md`)

## 4. Internal Production validation (approval required)

- [ ] `TC_LIVE_ENABLED=internal`
- [ ] Internal session prepared; invisibility checked by hand
- [ ] `@prod-live-internal` LIVE-PROD-001/002 green; audit file kept
- [ ] Logs reviewed; no real user affected (registrations, messages, listings)

## 5. Real organisers (separate explicit approval)

- [ ] `TC_LIVE_ENABLED=true`
- [ ] Watch logs for the first sessions; kill switch owner named
