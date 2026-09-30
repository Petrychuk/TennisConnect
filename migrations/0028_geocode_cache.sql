CREATE TABLE IF NOT EXISTS "geocode_cache" (
  "location" varchar PRIMARY KEY,
  "latitude" real NOT NULL,
  "longitude" real NOT NULL,
  "source" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "latitude" real;
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "longitude" real;
--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN IF NOT EXISTS "latitude" real;
--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN IF NOT EXISTS "longitude" real;
