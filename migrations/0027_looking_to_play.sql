ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "looking_to_play_enabled" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "looking_to_play_when" text;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "looking_to_play_format" text;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "looking_to_play_expires_at" timestamp with time zone;
