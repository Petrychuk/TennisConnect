ALTER TABLE "coach_profiles" ADD COLUMN "is_draft" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "is_draft" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_completed" boolean DEFAULT false NOT NULL;