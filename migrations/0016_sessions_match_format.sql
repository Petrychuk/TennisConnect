-- Adds the wizard Step 3 match-format fields as real, queryable
-- columns instead of only being folded into the free-text description
-- summary. matchMode already existed but the wizard never actually set
-- it (silently defaulting to 'doubles' for every session regardless of
-- what the organizer picked) - this migration only adds the new
-- columns; matchMode's own type is unchanged.
--
-- See shared/schema.ts tennisSessions (category/gamesTo/noAd/tiebreak/
-- plannedRoundsCount) and session-details-card.tsx, which previously
-- had nothing real to read for Format/Game Format/Rounds.

ALTER TABLE "sessions"
  ADD COLUMN "category" text,
  ADD COLUMN "games_to" integer,
  ADD COLUMN "no_ad" boolean,
  ADD COLUMN "tiebreak" boolean,
  ADD COLUMN "planned_rounds_count" integer;
