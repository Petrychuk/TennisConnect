import {
  COURT_SURFACES,
  CLUB_SERVICES,
  AUSTRALIAN_STATES,
  HOSTED_COMPETITION_TYPES,
} from "@shared/constants/clubs";

/**
 * A premium club/company/community listing renders one of three page
 * templates depending on how the listing is set up. Detection is based on
 * fields that are actually editable in the admin form today:
 *  - "company"   → the listing has multiple locations
 *  - "community" → category is a community / social-group listing
 *  - "courts"    → everything else (default: single-site club or courts)
 */
export type ClubVariant = "courts" | "company" | "community";

export function getClubVariant(club: any): ClubVariant {
  if (!club) return "courts";
  if (club.hasMultipleLocations) return "company";
  if (club.category === "community" || club.category === "social-group") {
    return "community";
  }
  return "courts";
}

export const CLUB_VARIANT_LABELS: Record<ClubVariant, string> = {
  courts: "Premium Club",
  company: "Premium Partner",
  community: "Premium Community",
};

export function getSurfaceLabel(value: string): string {
  return COURT_SURFACES.find((s) => s.value === value)?.label ?? value;
}

export function getServiceLabel(value: string): string {
  return CLUB_SERVICES.find((s) => s.value === value)?.label ?? value;
}

export function getServiceGroup(value: string): string | undefined {
  return CLUB_SERVICES.find((s) => s.value === value)?.group;
}

export function getStateLabel(value?: string | null): string {
  if (!value) return "";
  return AUSTRALIAN_STATES.find((s) => s.value === value)?.label ?? value;
}

export function getCompetitionLabel(value: string): string {
  return (
    HOSTED_COMPETITION_TYPES.find((c) => c.value === value)?.label ?? value
  );
}

export function formatLocation(club: any): string {
  return [club?.suburb, club?.state].filter(Boolean).join(", ");
}

export function formatHourlyPrice(club: any): string | null {
  if (club?.hourlyPrice === null || club?.hourlyPrice === undefined || club?.hourlyPrice === "") {
    return null;
  }
  const num = Number(club.hourlyPrice);
  if (Number.isNaN(num)) return null;
  return `$${num % 1 === 0 ? num : num.toFixed(2)}`;
}
