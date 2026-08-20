-- Converts tennis_sessions' date columns from `timestamp` (no timezone)
-- to `timestamptz`, fixing a class of bug where a session's displayed
-- start time could silently differ from what the organizer actually
-- picked, depending on the timezone the writing/reading server process
-- happened to be running in (see the comment on shared/schema.ts
-- tennisSessions.startAt for the full mechanism).
--
-- USING ... AT TIME ZONE 'UTC' tells Postgres "treat the existing naive
-- value as if it were UTC" - the safest assumption for any row written by
-- a server process running in UTC (the common case for a deployed
-- container), though any row that happened to be written by a
-- non-UTC-TZ process (e.g. a local dev box) may shift by that process's
-- offset when this runs. Given this table is still pre-launch test data
-- only (TC Live / the wizard that writes it are staging-gated - see
-- server/routes/organizer.ts requireStagingEnv), that one-time shift for
-- existing rows is an acceptable, known tradeoff - re-verify against your
-- actual data before running this against anything with real bookings.

ALTER TABLE "sessions"
  ALTER COLUMN "start_at" TYPE timestamptz USING "start_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "end_at" TYPE timestamptz USING "end_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "registration_opens_at" TYPE timestamptz USING "registration_opens_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "registration_closes_at" TYPE timestamptz USING "registration_closes_at" AT TIME ZONE 'UTC';
