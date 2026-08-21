-- Adds sessions.waiting_list_capacity (null = unlimited) - previously
-- there was nowhere real to store this, so the UI always showed a
-- hardcoded "(10 spots)" regardless of what was actually configured
-- (there was no configuration at all). See shared/schema.ts
-- tennisSessions.waitingListCapacity and session-details-card.tsx.

ALTER TABLE "sessions"
  ADD COLUMN "waiting_list_capacity" integer;
