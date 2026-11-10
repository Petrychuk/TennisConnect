-- Session rules and policies as their own columns (Organiser Hub Phase 2):
-- Rules, Refund Policy, Late Arrivals, Cancellations. They used to be folded
-- into sessions.description, so Edit couldn't restore them as fields. Older
-- sessions keep theirs inside the description - shared/sessionPolicies.ts
-- reads either, and the next save moves them into these columns.
-- Nullable, additive, no backfill.
-- Apply BEFORE deploying code that reads it: every select on sessions lists
-- all columns, so a missing column fails with "column does not exist".
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "rules_text" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "refund_policy" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "late_policy" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "cancellation_policy" text;
