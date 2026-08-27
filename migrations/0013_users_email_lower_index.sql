-- storage.getUserByEmail now compares lower(email) = lower($1) (case-
-- insensitive email lookups, see the earlier "Valeria Lebedeva
-- duplicate account" fix) - but the existing UNIQUE index on users.email
-- only covers the RAW column. Postgres can't use that index for a
-- function-wrapped comparison, so every register/login/forgot-password
-- call was doing a full sequential scan of the users table instead of
-- an index lookup - the likely cause of registration suddenly feeling
-- slow (every accumulated test-run user adds to that scan).
--
-- Deliberately NOT a UNIQUE index here (only a plain one) - a unique
-- functional index would fail to create outright while the existing
-- case-differing duplicate account (the "Valeria Lebedeva" pair) is
-- still in the table. Once that's resolved by hand, this can be
-- upgraded to UNIQUE for a real DB-level guarantee against future
-- case-variant duplicates too, not just a speed fix.

CREATE INDEX IF NOT EXISTS "users_email_lower_idx" ON "users" (lower("email"));
