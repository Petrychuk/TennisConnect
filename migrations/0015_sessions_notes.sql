-- Adds sessions.notes (organizer's own private reference note, shown
-- only to them on the Session Workspace overview) - see
-- shared/schema.ts tennisSessions.notes and
-- session-notes-card.tsx, which previously only kept this in local
-- component state (lost on reload) with no column to persist to.

ALTER TABLE "sessions"
  ADD COLUMN "notes" text;
