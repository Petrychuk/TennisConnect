-- Adds sessions.time_zone (IANA zone the venue is in, e.g.
-- "Australia/Sydney"), defaulting existing rows to "Australia/Sydney"
-- since that's the platform's only real market so far - see
-- shared/schema.ts tennisSessions.timeZone and
-- client/src/lib/timezone.ts for what this powers (the wall-clock <->
-- UTC conversion chain: Date picker "10:00" -> venue timeZone -> UTC ->
-- API -> timestamptz, and back: timestamptz -> venue timeZone ->
-- "10:00" for display).

ALTER TABLE "sessions"
  ADD COLUMN "time_zone" text NOT NULL DEFAULT 'Australia/Sydney';
