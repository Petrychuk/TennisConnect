ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "playing_hand" text;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "availability_status" text;
