ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "latitude" real;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "longitude" real;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "latitude" real;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "longitude" real;
