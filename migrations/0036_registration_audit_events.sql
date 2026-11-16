-- TC-213 (Organiser Hub audit, Batch 3): audit trail for organiser actions on
-- registrations - a player added after the registration cutoff, and a player
-- added ahead of the waiting list (which requires a reason). Append-only.
-- Rows go with their session (organisation cascade, server/lib/organizationCascade.ts);
-- actor_id / player_id are set to NULL when that account is deleted
-- (server/lib/userCascade.ts), so the record itself survives.
-- Additive (a new table): safe to apply before deploying the code that writes it.
CREATE TABLE IF NOT EXISTS "registration_audit_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" varchar NOT NULL REFERENCES "sessions"("id"),
  "player_id" varchar REFERENCES "users"("id"),
  "actor_id" varchar REFERENCES "users"("id"),
  "action" text NOT NULL,
  "reason" text,
  "details" json,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "registration_audit_events_session_id_idx" ON "registration_audit_events" ("session_id");
