-- The event's own picture for an external activity: the LINK to the source page's
-- share image (og:image). Never a copy of the file. Nullable, additive.
-- Apply BEFORE deploying code that reads it: a select on external_activities fails
-- with "column does not exist" if the column is missing.
ALTER TABLE "external_activities" ADD COLUMN IF NOT EXISTS "image_url" text;
