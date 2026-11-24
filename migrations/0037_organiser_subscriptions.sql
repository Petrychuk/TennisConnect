-- Organiser Hub paid subscription (A$40/month, 7-day trial) behind
-- ORGANISER_SUBSCRIPTION_ENABLED (default off). One row per user.
-- Additive (a new table): safe to apply before deploying the code that uses it.
CREATE TABLE IF NOT EXISTS "organiser_subscriptions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id"),
  "stripe_customer_id" text,
  "stripe_subscription_id" text UNIQUE,
  "status" text DEFAULT 'none' NOT NULL, -- none|incomplete|trialing|active|past_due|unpaid|canceled|grandfathered
  "trial_end" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "organiser_subscriptions_customer_idx" ON "organiser_subscriptions" ("stripe_customer_id");

-- Grandfather every existing organiser (free). Idempotent: re-run it right
-- before switching ORGANISER_SUBSCRIPTION_ENABLED on, so organisers approved
-- while the flag was still off are covered too. Never touches paying rows.
INSERT INTO "organiser_subscriptions" ("user_id", "status")
SELECT "id", 'grandfathered' FROM "users" WHERE "is_organizer" = true
ON CONFLICT ("user_id") DO NOTHING;
