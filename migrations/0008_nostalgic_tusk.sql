ALTER TABLE "clubs" ALTER COLUMN "location" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ALTER COLUMN "rating" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "coach_profiles" ALTER COLUMN "rating" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "category" text NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "cover" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "gallery" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "suburb" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "google_maps_url" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "has_multiple_locations" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "number_of_locations" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "facebook" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "contact_person_name" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "contact_person_role" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "contact_person_email" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "contact_person_phone" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "contact_person_notes" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "display_contact_person" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "has_courts" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "has_community" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "has_coaching" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "hosts_competitions" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "court_surfaces" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "indoor_courts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "outdoor_courts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "has_lighting" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "court_booking_available" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "membership_required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "public_access" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "social_tennis_days" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "hourly_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "pricing_notes" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "hosted_competitions" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "listing_type" text DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "status" text DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "display_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "official_partner" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "claimed_listing" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "meta_description" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "meta_keywords" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "cta_text" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "cta_url" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_slug_unique" UNIQUE("slug");