-- One row per broadcast posted from a session's Messages tab, separate
-- from the messages table (which stores one row PER RECIPIENT for an
-- actual broadcast, by design - awkward to read back as "history of
-- updates posted to this session" without deduplicating). Lets that
-- tab show real history that survives a page refresh instead of
-- resetting to empty.
CREATE TABLE IF NOT EXISTS "session_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"organizer_id" varchar NOT NULL,
	"message" text NOT NULL,
	"sent_to" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_updates" ADD CONSTRAINT "session_updates_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_updates" ADD CONSTRAINT "session_updates_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_updates_session_id_idx" ON "session_updates" ("session_id");
