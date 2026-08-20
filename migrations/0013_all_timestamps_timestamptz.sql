-- Converts every remaining plain `timestamp` (no timezone) column to
-- `timestamptz`, closing out the rest of the class of bug fixed for
-- sessions.start_at etc in 0012_session_dates_timestamptz.sql - see
-- that migration's header comment for the full mechanism (node-postgres
-- formats/parses these using whichever process's local TZ is doing the
-- writing/reading, so a value can silently shift once client and server
-- aren't in the same timezone).
--
-- NOT touched, on purpose: "user_sessions".expire - that table is
-- connect-pg-simple's own session store, created and read by that
-- library directly (not through our own read/write code), and
-- shared/schema.ts explicitly documents it must keep matching exactly
-- what connect-pg-simple expects. Changing its column type here without
-- also confirming connect-pg-simple tolerates timestamptz isn't worth
-- the risk for a column this migration's actual bug doesn't touch
-- (login-session expiry, not anything organizer/player-facing).
--
-- USING ... AT TIME ZONE 'UTC' - same caveat as 0012: this assumes
-- existing rows were written by a UTC-TZ process, which is the deployed
-- default (Railway) and therefore the common case, but any row written
-- by a differently-timezoned process (e.g. local dev) may shift by that
-- process's offset when this runs. Re-verify against your actual data
-- first if any of these tables hold real user data you care about
-- preserving exactly (this project is still pre-launch, so most of this
-- is test data).

ALTER TABLE "users"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "articles"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "travel_packages"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "recreation_services"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "tournaments"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "player_profiles"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "coach_profiles"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "tournament_history"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "marketplace_items"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "clubs"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "organizer_requests"
  ALTER COLUMN "reviewed_at" TYPE timestamptz USING "reviewed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "organizations"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "organization_members"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "sessions"
  ALTER COLUMN "reviewed_at" TYPE timestamptz USING "reviewed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "registrations"
  ALTER COLUMN "checked_in_at" TYPE timestamptz USING "checked_in_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "session_rounds"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "completed_at" TYPE timestamptz USING "completed_at" AT TIME ZONE 'UTC';

ALTER TABLE "matches"
  ALTER COLUMN "started_at" TYPE timestamptz USING "started_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "confirmed_at" TYPE timestamptz USING "confirmed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "club_follows"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "club_favorites"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "messages"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "community_memberships"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "support_requests"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "newsletter_subscribers"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "unsubscribed_at" TYPE timestamptz USING "unsubscribed_at" AT TIME ZONE 'UTC';

ALTER TABLE "password_reset_tokens"
  ALTER COLUMN "expires_at" TYPE timestamptz USING "expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
