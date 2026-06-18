ALTER TABLE "travel_packages" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "travel_packages" ADD COLUMN "provider_name" text;--> statement-breakpoint
ALTER TABLE "travel_packages" ADD COLUMN "provider_website" text;--> statement-breakpoint
ALTER TABLE "travel_packages" ADD COLUMN "provider_logo" text;--> statement-breakpoint
ALTER TABLE "travel_packages" ADD COLUMN "tags" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "travel_packages" ADD COLUMN "cta_text" text;--> statement-breakpoint
ALTER TABLE "travel_packages" ADD COLUMN "cta_url" text;--> statement-breakpoint
ALTER TABLE "travel_packages" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "travel_packages" ADD COLUMN "meta_description" text;