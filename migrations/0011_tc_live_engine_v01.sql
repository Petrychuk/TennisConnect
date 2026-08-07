CREATE TABLE "session_rounds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"round_number" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"resting_player_ids" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "session_rounds_session_id_round_number_unique" UNIQUE("session_id","round_number")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"round_id" varchar NOT NULL,
	"court_label" text NOT NULL,
	"team_a_ids" json NOT NULL,
	"team_b_ids" json NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"team_a_games" integer,
	"team_b_games" integer,
	"reported_by" varchar,
	"confirmed_by" varchar,
	"started_at" timestamp,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "scoring_format" text DEFAULT 'games' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "match_mode" text DEFAULT 'doubles' NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "live_status" text;--> statement-breakpoint
ALTER TABLE "session_rounds" ADD CONSTRAINT "session_rounds_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_session_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."session_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
