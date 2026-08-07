// ORGANIZER REQUESTS
export const ORGANIZER_REQUEST_STATUS = [
    "pending",
    "approved",
    "rejected",
    // Set when an admin pulls organizer access back via the Users tab.
    // Distinct from "rejected" (never approved) — this person WAS an
    // organizer and no longer is.
    "revoked",
  ] as const;
  
  export type OrganizerRequestStatus =
    (typeof ORGANIZER_REQUEST_STATUS)[number];
  
  // ORGANIZATIONS
  
  export const ORGANIZATION_STATUS = [
    "active",
    "inactive",
  ] as const;
  
  export type OrganizationStatus =
    (typeof ORGANIZATION_STATUS)[number];
  
  export const ORGANIZATION_MEMBER_ROLES = [
    "owner",
    "admin",
    "member",
  ] as const;
  
  export type OrganizationMemberRole =
    (typeof ORGANIZATION_MEMBER_ROLES)[number];
  
// Session lifecycle:
//   draft -> pending_review -> published -> cancelled
//                           \-> rejected -> (organizer edits) -> pending_review
// `live` / `completed` are reserved for TC Live Engine (check-in, rounds,
// scoring) and are not produced by any UI yet — this is purely so the
// column doesn't need to change shape later.
//
// Admins publish directly (draft -> published) since they don't need to
// review their own sessions. Organizers must submit for review; an admin
// then approves (-> published) or rejects (-> rejected) every event, so
// nothing goes live on the site without admin sign-off.
  
  export const SESSION_TYPES = [
    { value: "social", label: "Social Hit" },
    { value: "round-robin", label: "Round Robin" },
    { value: "clinic", label: "Clinic" },
    { value: "tournament", label: "Tournament" },
  ] as const;
  
  export type SessionType = (typeof SESSION_TYPES)[number]["value"];
  
  // Session lifecycle. `live` / `completed` are reserved for TC Live Engine
  // (check-in, rounds, scoring) and are not produced by any UI yet — this
  // is purely so the column doesn't need to change shape later.
  export const SESSION_STATUS = [
    "draft",
    "pending_review",
    "published",
    "cancelled",
    "rejected",
    "live",
    "completed",
  ] as const;
  
  export type SessionStatus = (typeof SESSION_STATUS)[number];
  
  // REGISTRATIONS
  
  export const REGISTRATION_STATUS = [
    "registered",
    "waitlisted",
    "cancelled",
  ] as const;
  
  export type RegistrationStatus =
    (typeof REGISTRATION_STATUS)[number];

  // Organizer-set override during a live session, separate from
  // `registrations.status` (which is about the sign-up itself, not
  // whether the player is actually around to play right now).
  // Null (the default) means "present as normal" - checked-in players
  // only move into one of these two when the organizer explicitly
  // marks them so (e.g. left early, no-show after check-in). Round
  // generation excludes anyone with a non-null liveStatus.
  export const REGISTRATION_LIVE_STATUS = [
    "unavailable", // temporarily out (e.g. injury, break) - can come back
    "withdrawn",   // done for the session, won't be paired again
  ] as const;

  export type RegistrationLiveStatus =
    (typeof REGISTRATION_LIVE_STATUS)[number];

  // TC LIVE ENGINE (v0.1 — see memory docs for the full spec)

  export const MATCH_MODE = [
    "singles",
    "doubles",
  ] as const;

  export type MatchMode = (typeof MATCH_MODE)[number];

  // Only "games" is implemented in v0.1 (e.g. "4-2"). "sets" is reserved
  // for real Tournament-type sessions later - kept as a session-level
  // setting now so that migration doesn't need a schema change, same
  // reasoning as SESSION_STATUS's live/completed above.
  export const SCORING_FORMAT = [
    "games",
    "sets",
  ] as const;

  export type ScoringFormat = (typeof SCORING_FORMAT)[number];

  // Round lifecycle: active while any match isn't confirmed yet,
  // completed once every match in it is - that's what unlocks
  // "Generate Next Round" on the organizer's live screen.
  export const SESSION_ROUND_STATUS = [
    "active",
    "completed",
  ] as const;

  export type SessionRoundStatus = (typeof SESSION_ROUND_STATUS)[number];

  // Match lifecycle, deliberately small for v0.1's organizer-only score
  // entry (no self-report / confirm / dispute yet - see AI_CONTEXT /
  // TC Live spec for why "awaiting_confirmation" isn't here yet).
  // "confirmed" is set the instant the organizer saves a score, since
  // there's no second party to wait on in this version.
  export const MATCH_STATUS = [
    "pending",   // assigned to a court, not started
    "playing",   // organizer marked it started (see matches.startedAt)
    "confirmed", // score entered and saved
  ] as const;

  export type MatchStatus = (typeof MATCH_STATUS)[number];
  