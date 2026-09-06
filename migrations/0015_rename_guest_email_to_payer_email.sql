-- guest_email is being renamed to payer_email and, going forward,
-- always populated (previously only set for guests - null whenever
-- there was a user_id, relying on a join through users to see a
-- logged-in payer's email). ALTER ... RENAME preserves existing data,
-- so nothing already in the table is lost - any row that already had
-- a guest email keeps it under the new column name.

ALTER TABLE "payments" RENAME COLUMN "guest_email" TO "payer_email";
