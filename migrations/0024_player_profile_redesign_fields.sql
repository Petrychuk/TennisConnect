ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "sex" text;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "looking_for" json DEFAULT '[]'::json;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "game_format" text;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "play_style" text;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "availability" json DEFAULT '[]'::json;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "play_radius_km" integer;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "court_surface_preference" text;
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "photos" json DEFAULT '[]'::json;
