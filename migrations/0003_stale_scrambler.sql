CREATE TABLE "articles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"seo_title" text,
	"meta_description" text,
	"tags" text,
	"legal_type" text,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	"cover_image" text NOT NULL,
	"category" text NOT NULL,
	"author" text NOT NULL,
	"read_time" integer DEFAULT 5 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "recreation_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"location" text NOT NULL,
	"duration" text NOT NULL,
	"price" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'AUD' NOT NULL,
	"description" text NOT NULL,
	"benefits" json DEFAULT '[]'::json,
	"cover_image" text NOT NULL,
	"rating" text,
	"phone" text,
	"email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recreation_services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tournament_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"date" text NOT NULL,
	"result" text,
	"award" text,
	"photos" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"destination" text NOT NULL,
	"duration" text NOT NULL,
	"price" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'AUD' NOT NULL,
	"description" text NOT NULL,
	"highlights" json DEFAULT '[]'::json,
	"includes" json DEFAULT '[]'::json,
	"cover_image" text NOT NULL,
	"gallery" json DEFAULT '[]'::json,
	"start_date" text,
	"spots_left" integer DEFAULT 10 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "travel_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "marketplace_items" RENAME COLUMN "image" TO "photos";--> statement-breakpoint
ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "marketplace_items" ADD COLUMN "type" text DEFAULT 'second-hand' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketplace_items" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "slug" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "start_date" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "end_date" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "level" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "price" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "prize_pool" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "max_participants" integer DEFAULT 64 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "current_participants" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "organizer" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "cover_image" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "status" text DEFAULT 'upcoming' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "categories" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "age_groups" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "winner" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "finalist" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_history" ADD CONSTRAINT "tournament_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "date";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "result";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "award";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "photos";--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_slug_unique" UNIQUE("slug");