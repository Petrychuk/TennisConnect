-- Foundation table for every kind of payment that moves through
-- TennisConnect - not just "Back the Rally" support. payment_type is
-- the discriminator: 'support' is the only one anything actually
-- writes today (see server/routes/support.ts); 'subscription' and
-- 'premium_page' are reserved column values for later features, not
-- implemented by anything yet. Building this now, once, instead of a
-- support_payments-only table that would need reworking the moment
-- subscriptions or premium pages happen.
--
-- Australian-context notes (not legal/tax advice - this only makes
-- the schema ABLE to record a GST breakdown once there's an actual
-- accountant-confirmed treatment, it doesn't assume one):
-- - gst_amount_cents / is_gst_inclusive: both nullable, both unset by
--   any code path right now. TennisConnect isn't determining here
--   whether GST applies to a "support" payment - that's a decision
--   for whoever handles the books, once made concrete these columns
--   are already there to record it per-payment.
-- - No delete path exists anywhere for this table, and none should be
--   added - the ATO expects business transaction records kept for at
--   least 5 years.
-- - receipt_url stores Stripe's own hosted receipt link (Stripe
--   already emails one automatically on a successful Checkout) rather
--   than TennisConnect generating and storing its own copy.
-- - No raw card data of any kind is ever stored here or anywhere else
--   in TennisConnect - Stripe Checkout owns the entire card-entry
--   surface; this table only ever records Stripe's own session/
--   payment-intent IDs and the amount/status Stripe's webhook
--   confirmed.
--
-- status only ever moves to 'paid' from the webhook handler
-- (checkout.session.completed, signature-verified) - never from the
-- client-facing success-page redirect, which is not trusted to
-- confirm payment on its own.

CREATE TABLE IF NOT EXISTS "payments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),

  "user_id" varchar REFERENCES "users"("id"),
  "guest_email" text,

  "payment_type" text NOT NULL,
  "support_tier" text,
  "related_entity_id" varchar,

  "amount_cents" integer NOT NULL,
  "currency" varchar(8) NOT NULL DEFAULT 'AUD',

  "gst_amount_cents" integer,
  "is_gst_inclusive" boolean,

  "stripe_checkout_session_id" varchar NOT NULL,
  "stripe_payment_intent_id" varchar,
  "receipt_url" text,

  "status" text NOT NULL DEFAULT 'pending',

  "created_at" timestamp NOT NULL DEFAULT now(),
  "paid_at" timestamp
);

CREATE INDEX IF NOT EXISTS "payments_user_id_idx" ON "payments" ("user_id");
CREATE INDEX IF NOT EXISTS "payments_stripe_session_id_idx" ON "payments" ("stripe_checkout_session_id");
