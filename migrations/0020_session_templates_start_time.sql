-- A recurring session usually has a consistent start time-of-day even
-- though a template has no date of its own - lets Use Template
-- pre-fill "6:30 PM" the same way it pre-fills courts/capacity/rounds,
-- rather than leaving time entirely blank every time.
ALTER TABLE "session_templates" ADD COLUMN IF NOT EXISTS "preferred_start_time" text;
