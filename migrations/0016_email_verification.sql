-- Email verification (see server/routes.ts /api/auth/register,
-- /api/auth/verify-email, /api/auth/resend-verification).
--
-- email_verified defaults to true so every existing account is treated
-- as already verified the moment this migration runs - no separate
-- backfill UPDATE needed, and no existing user gets locked out.
-- /api/auth/register is the only code path that explicitly overrides
-- this to false for a brand new signup.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;

-- token_hash stores a sha256 hex digest of the token, never the raw
-- token - mirrors why passwords are hashed, not stored plain. Unlike
-- password_reset_tokens (0000_dusty_mantis.sql-era, unchanged here),
-- this is a new table so there's no existing plaintext-token behaviour
-- to preserve.
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "token_hash" varchar(255) NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_idx"
  ON "email_verification_tokens" ("user_id");
