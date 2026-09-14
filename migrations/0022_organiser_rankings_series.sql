CREATE TABLE IF NOT EXISTS "series" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"season_id" varchar NOT NULL,
	"name" text NOT NULL,
	"format" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "series_id" varchar;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "series" ADD CONSTRAINT "series_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "series" ADD CONSTRAINT "series_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "series" ADD CONSTRAINT "series_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "series_season_id_idx" ON "series" ("season_id");
