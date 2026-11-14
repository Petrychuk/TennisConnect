# Organiser dashboard: empty, loading and error states (5 Nov 2026)

Code: `client/src/lib/organiserDashboard.ts` (rules, unit-tested), `client/src/components/organiser/dashboard/dashboard-states.tsx` (skeleton, warning, unavailable card, welcome card), `organiser-dashboard.tsx` (wiring).

## Three different "no number" cases

| Case | Tiles | Cards |
|---|---|---|
| Loading | skeleton | skeleton per card |
| Nothing yet (a real zero) | `0` for Live Session, Upcoming Sessions, Active Players; `—` for Attendance when no percentage can be calculated | normal empty text; a new organiser gets the welcome card with **Create Session** |
| Request failed | `—` for the figures of that source only | "Unavailable right now." card + one compact inline warning with **Try again** |

The warning appears only for an actual failed request (`isError` with no data), never for loading or empty data, and it names only what failed ("We couldn't load your sessions and player statistics."). **Try again** re-fetches only the failed requests. A failed refetch keeps showing the data already on screen.

Each source is independent: sessions (Live, Upcoming), player stats (Active Players, Attendance) and activity. One failing never blanks figures from another.

## Attendance

`GET /api/organizer/dashboard/stats` now returns `attendancePercent: null` when no registrations exist for a session that has happened (and for an account with no organisation yet). It used to return `0`, which read as "nobody turned up". A real `0%` (people registered, none checked in) is still `0%`. Reports and session cards compute their own figures and are unchanged.

## New organiser

When the sessions request succeeds with an empty list, a welcome card replaces the Live and Upcoming cards (it carries the Create Session CTA, so the empty Upcoming card is not repeated) and the Statistics card is hidden. A failed request never shows this card, so an organiser with sessions who hits an outage is not told they have none.

## Why Live Session and Upcoming Sessions failed to load

Both tiles and cards read only `GET /api/organizer/sessions/mine`, so they fail together; Active Players and Attendance come from `/dashboard/stats`, which kept working. The old banner was a single generic message for any failure and the cards then showed "nothing live" / "Nothing on the calendar yet", hiding the outage.

Most likely server cause (from the code; **not confirmed on Staging, which this session cannot reach**): `/sessions/mine` runs `getSessionsByOrganization`, which does `db.select().from(tennisSessions)`, i.e. every column in `shared/schema.ts`. Migrations `0034_sessions_policies.sql` (rules/refund/late/cancellation policy) and `0035_sessions_internal_test.sql` (`is_internal_test`) add five columns. On a database where they are not applied, Postgres answers "column does not exist" and the route returns 500. `/dashboard/stats` names its columns, so it is unaffected. This matches the open item "apply 0034/0035 on Staging". To confirm: check the Staging server log for `column "is_internal_test" ... does not exist` on `GET /api/organizer/sessions/mine`, then apply the two migrations with the usual approval. No code change hides this: the dashboard now reports it honestly instead.

## Tests

- Unit: `client/src/lib/organiserDashboard.test.ts` (in `npm run test:ui`).
- Playwright: `tests/organiser/organiser-dashboard-states.spec.ts`, ORG-DASH-001..006 (phase `hub-msg-admin`): new organiser, sessions failing + retry, stats failing, skeleton while pending, both failing, six viewports (no horizontal overflow, Try again ≥ 44px). Failures are simulated with `page.route`; nothing extra is written. **Not yet run against Staging.**
