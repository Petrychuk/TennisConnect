ALTER TABLE "users" ADD COLUMN "is_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_test_user" boolean DEFAULT false NOT NULL;