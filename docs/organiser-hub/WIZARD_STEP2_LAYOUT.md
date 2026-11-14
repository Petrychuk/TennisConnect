# Create Session wizard, step 2: layout and the "Couldn't save draft" 500 (5 Nov 2026)

## The 500 on Save as Draft

`insert into "sessions" (... "rules_text", "refund_policy", "late_policy", "cancellation_policy", "is_internal_test" ...)` fails with Postgres `42703` (column does not exist) when the database has not had `migrations/0034_sessions_policies.sql` and `migrations/0035_sessions_internal_test.sql` applied. The code is ahead of that database; the same cause makes the dashboard's Live and Upcoming figures fail (`docs/organiser-hub/DASHBOARD_STATES.md`).

Fix on the database, not the code: apply both files to the database the server is using (they are additive and idempotent: `ADD COLUMN IF NOT EXISTS`), then restart is not needed. For example, from the repo root, with the same `DATABASE_URL` the server uses:

    psql "$DATABASE_URL" -f migrations/0034_sessions_policies.sql -f migrations/0035_sessions_internal_test.sql

(PowerShell: `psql $env:DATABASE_URL -f migrations/0034_sessions_policies.sql -f migrations/0035_sessions_internal_test.sql`.) Check first which database `.env.dev` points to: Staging and Production need their own approval (`docs/live/LIVE_RUNBOOK.md`).

What changed in code so it is no longer a wall of SQL:
- `server/lib/schemaDrift.ts` + the error handler in `server/index.ts`: a missing column/table (`42703`, `42P01`, also on a Drizzle error's `cause`) answers 500 with "The database is missing a recent migration…" in every environment. The SQL statement, with its parameters, no longer reaches the browser. The full error is still logged on the server.
- `client/src/lib/apiError.ts` (`friendlyApiError`): the wizard's "Couldn't save draft / publish" toasts show only the human message, never `500: {...}` and never a SQL-looking string.

## Step 2 layout

`client/src/components/organiser/sessions/wizard/step2-date-registration.tsx`

- Compact: cover photo is a one-row strip; Session fields are two per row (six-column grid when the card is wide); Date, Start and End share a row; Registration sits beside Pricing + Visibility from `lg`.
- Responsive by card width, not only screen width: section cards are CSS containers (`@container`), so the same card is one column in a half-width slot and two columns when full width.
- Control height: 44 px for touch (phones and iPads), 36 px only for a mouse at `md` and up (`pointer-fine`).
- Icons: each section has an icon tile in its header; text inputs and selects have a leading icon centred on the control (`WithIcon`, `pointer-events-none`). Date and time inputs keep the browser's own picker icon, so they never show two.
- Date + time pairs are a fixed two-track grid (`minmax(0,1fr) / 8.5rem`), so the picker icon is never clipped.
- Pricing and Visibility options are tappable cards (the whole label is the target). Waiting List is a labelled row with the same height as Max Players.
- All test ids and labels are unchanged.

## Tests

- Unit: `client/src/lib/apiError.test.ts`, `server/lib/schemaDrift.test.ts`.
- Playwright: ORG-WIZ-005 (`tests/organiser/organiser-wizard.spec.ts`, phase `hub-msg-admin`): step 2 at six viewports, no horizontal overflow, no control outside its card, icons centred, 44 px on touch. **Not yet run against Staging or locally** (needs the app).
- Layout was also checked with a static replica that renders the real component markup with Tailwind and Chromium at the six viewports (no overflow, no spill, icons centred, 36/44 px heights). Radix and lucide are stubbed there, so it is evidence for layout only.
