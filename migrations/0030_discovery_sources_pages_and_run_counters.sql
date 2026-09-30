ALTER TABLE "discovery_sources" ADD COLUMN IF NOT EXISTS "extra_urls" json DEFAULT '[]'::json;
--> statement-breakpoint
ALTER TABLE "discovery_sources" ADD COLUMN IF NOT EXISTS "page_hashes" json DEFAULT '{}'::json;
--> statement-breakpoint
ALTER TABLE "discovery_runs" ADD COLUMN IF NOT EXISTS "events_valid" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "discovery_runs" ADD COLUMN IF NOT EXISTS "events_needing_review" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "discovery_sources" ADD COLUMN IF NOT EXISTS "city" text;
