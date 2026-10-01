-- [PLAY][AI] Partner Events. Two existing tables, no new one:
--   tennisSessions    - a registered partner using TC's own registration
--                        flow is just a normal session with a flag.
--   external_activities - a partner with external (or no TC) registration,
--                        or not yet registered in TC at all.
-- Apply this BEFORE deploying code that reads these columns.

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "is_partner_event" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- sourceId becomes optional: an admin-entered Partner Event has no
-- Discovery Source behind it. Every existing row already has one, so
-- this is a pure relaxation - nothing currently NOT NULL fails.
ALTER TABLE "external_activities" ALTER COLUMN "source_id" DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE "external_activities" ADD COLUMN IF NOT EXISTS "source_type" text NOT NULL DEFAULT 'EXTERNAL';
--> statement-breakpoint
ALTER TABLE "external_activities" ADD COLUMN IF NOT EXISTS "partner_id" varchar REFERENCES "organizations"("id");
--> statement-breakpoint
ALTER TABLE "external_activities" ADD COLUMN IF NOT EXISTS "partner_name" text;
--> statement-breakpoint
ALTER TABLE "external_activities" ADD COLUMN IF NOT EXISTS "registration_type" text;
