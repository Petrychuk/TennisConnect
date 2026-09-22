-- A reusable, saved session setup (format/settings only - never a
-- specific date, registrations, check-ins, scores, or results). See
-- shared/schema.ts's own comment on sessionTemplates for the full
-- reasoning on what is and isn't captured here.
CREATE TABLE IF NOT EXISTS "session_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'social' NOT NULL,
	"description" text,
	"location" text,
	"time_zone" text DEFAULT 'Australia/Sydney' NOT NULL,
	"duration_minutes" integer,
	"price" numeric(10, 2),
	"currency" varchar(8) DEFAULT 'AUD' NOT NULL,
	"max_participants" integer,
	"skill_level" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"courts_count" integer,
	"scoring_format" text DEFAULT 'games' NOT NULL,
	"match_mode" text DEFAULT 'doubles' NOT NULL,
	"category" text,
	"games_to" integer,
	"no_ad" boolean,
	"tiebreak" boolean,
	"planned_rounds_count" integer,
	"waiting_list_enabled" boolean DEFAULT true NOT NULL,
	"waiting_list_capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_templates" ADD CONSTRAINT "session_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_templates" ADD CONSTRAINT "session_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_templates_organization_id_idx" ON "session_templates" ("organization_id");
