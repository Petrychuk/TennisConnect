-- Display value for an external activity's price: keeps member / non-member pricing
-- ("Free for SSC tennis members · $20 per week for non-members"). Nullable, additive.
-- Apply BEFORE deploying code that reads it: a select on external_activities fails
-- with "column does not exist" if the column is missing.
ALTER TABLE "external_activities" ADD COLUMN IF NOT EXISTS "price_label" text;
