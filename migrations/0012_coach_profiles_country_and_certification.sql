-- Adds coach_profiles.country - coaches previously had no country field
-- at all, only players did. Nullable since existing coach profiles
-- genuinely don't have a value; the onboarding form now collects it
-- for new/re-completing coaches. See shared/schema.ts coachProfiles
-- and client/src/pages/complete-profile.tsx.
--
-- Also adds is_certified/certification_details - a self-declared
-- "Certified / Accredited Coach" toggle (e.g. Tennis Australia
-- accreditation), NOT verified against any accrediting body. Default
-- false for existing coach profiles.

ALTER TABLE "coach_profiles"
  ADD COLUMN "country" text,
  ADD COLUMN "is_certified" boolean NOT NULL DEFAULT false,
  ADD COLUMN "certification_details" text;
