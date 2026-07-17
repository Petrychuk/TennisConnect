// ORGANIZER REQUESTS
export const ORGANIZER_REQUEST_STATUS = [
    "pending",
    "approved",
    "rejected",
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
  