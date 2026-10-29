/*
  What a public coach profile response may contain, and who may see a
  coach's private contact details.

  GET /api/coaches/:slug used to return the whole coach_profiles row, so
  the coach's `phone` and `email` reached every guest; the page only hid
  them behind "Sign in". It now returns ALLOWLISTED fields only:

  - `user`    -> toPublicUser() (server/lib/sanitizeUser.ts, also an allowlist)
  - `profile` -> toPublicCoachProfile(): the fields the profile page renders.
                 Never phone, email, isDraft or coordinates.
  - `contact` -> { phone, email } only when canViewCoachContact() allows it,
                 otherwise null. `contactAccess` says why, for the page.

  New columns are private until someone adds them here on purpose.

  Contact policy (decided 29 Oct 2026):
  - the coach themselves and admins: always;
  - any other signed-in account: only when it is approved by an admin,
    not hidden and active (a new account is unapproved until reviewed),
    and only for a coach profile that is publicly visible;
  - guests: never.
  Messaging the coach is unchanged (POST /api/messages has its own rules).

  Profile visibility (isCoachPubliclyVisible) is the SAME rule as the
  directory query (storage.getAllCoachesWithProfiles): role coach,
  completed, profile not a draft, approved, not hidden, account active.
  A coach that is not visible is a 404 for everyone except the coach and
  admins - a direct link is no way around it.

  Future Coach Hub setting "Contact visibility: Approved members / Only me"
  (docs/qa/2026-10-29-coach-contact-security.md): coachContactAccess()
  already takes the coach's preference. There is no column for it yet, so
  every caller passes DEFAULT_COACH_CONTACT_VISIBILITY.

  Pure - unit-tested in ./publicProfiles.test.ts.
*/

export const PUBLIC_COACH_PROFILE_FIELDS = [
  "id",
  "userId",
  "title",
  "country",
  "isCertified",
  "certificationDetails",
  "location",
  "locations",
  "bio",
  "rating",
  "reviews",
  "rate",
  "experience",
  "tags",
  "photos",
  "schedule",
  "createdAt",
] as const;

export type PublicCoachProfileField = (typeof PUBLIC_COACH_PROFILE_FIELDS)[number];

/** Copies only the allowlisted keys that exist on `source`. */
export function pickFields<T extends object, K extends string>(
  source: T,
  fields: readonly K[],
): Pick<T, Extract<keyof T, K>> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) out[field] = (source as Record<string, unknown>)[field];
  }
  return out as Pick<T, Extract<keyof T, K>>;
}

export function toPublicCoachProfile<T extends object>(profile: T): Pick<T, Extract<keyof T, PublicCoachProfileField>> {
  return pickFields(profile, PUBLIC_COACH_PROFILE_FIELDS);
}

export interface VisibilityUser {
  id: string;
  role?: string | null;
  profileCompleted?: boolean | null;
  isApproved?: boolean | null;
  isHidden?: boolean | null;
  status?: string | null;
}

export interface VisibilityProfile {
  isDraft?: boolean | null;
}

const isActiveAccount = (status: string | null | undefined) => !status || status === "active";

/** Listed in the directory and reachable by anyone (mirrors getAllCoachesWithProfiles). */
export function isCoachPubliclyVisible(user: VisibilityUser, profile: VisibilityProfile | null | undefined): boolean {
  return (
    user.role === "coach" &&
    user.profileCompleted === true &&
    !!profile &&
    profile.isDraft !== true &&
    user.isApproved === true &&
    user.isHidden !== true &&
    isActiveAccount(user.status)
  );
}

export type CoachProfileAccess = "public" | "owner" | "admin" | "not-found";

/**
 * Who may open GET /api/coaches/:slug for this coach. A coach who has not
 * finished onboarding (no completed profile) is not-found even for admins -
 * there is nothing to show yet; the coach is sent to /complete-profile.
 */
export function coachProfileAccess(
  coach: VisibilityUser,
  profile: VisibilityProfile | null | undefined,
  viewer: ContactViewer | null | undefined,
): CoachProfileAccess {
  if (coach.role !== "coach" || coach.profileCompleted !== true || !profile) return "not-found";
  if (isCoachPubliclyVisible(coach, profile)) return "public";
  if (viewer?.id === coach.id) return "owner";
  if (viewer?.isAdmin === true) return "admin";
  return "not-found";
}

/** The coach's own choice (future Coach Hub setting; no column yet). */
export type CoachContactVisibility = "approved-members" | "only-me";
export const DEFAULT_COACH_CONTACT_VISIBILITY: CoachContactVisibility = "approved-members";

export interface ContactViewer {
  id: string;
  isAdmin?: boolean | null;
  isApproved?: boolean | null;
  isHidden?: boolean | null;
  status?: string | null;
}

export type ContactAccess = "granted" | "sign-in" | "pending-approval" | "private";

export function coachContactAccess(
  viewer: ContactViewer | null | undefined,
  coachUserId: string,
  visibility: CoachContactVisibility = DEFAULT_COACH_CONTACT_VISIBILITY,
): ContactAccess {
  if (viewer && (viewer.id === coachUserId || viewer.isAdmin === true)) return "granted";
  if (visibility === "only-me") return "private";
  if (!viewer) return "sign-in";
  return viewer.isApproved === true && viewer.isHidden !== true && isActiveAccount(viewer.status)
    ? "granted"
    : "pending-approval";
}

export function canViewCoachContact(
  viewer: ContactViewer | null | undefined,
  coachUserId: string,
  visibility: CoachContactVisibility = DEFAULT_COACH_CONTACT_VISIBILITY,
): boolean {
  return coachContactAccess(viewer, coachUserId, visibility) === "granted";
}

/** The body of GET /api/coaches/:slug for this viewer. */
export function publicCoachResponse<U extends object, P extends { phone?: string | null; email?: string | null }>(args: {
  user: U & { id: string };
  publicUser: object;
  profile: P | null | undefined;
  viewer: ContactViewer | null | undefined;
  visibility?: CoachContactVisibility;
}) {
  const access = coachContactAccess(args.viewer, args.user.id, args.visibility);
  return {
    user: args.publicUser,
    profile: args.profile ? toPublicCoachProfile(args.profile) : null,
    contact:
      access === "granted" && args.profile
        ? { phone: args.profile.phone ?? null, email: args.profile.email ?? null }
        : null,
    contactAccess: access,
  };
}

/** Public marketplace listing: never the seller's login email (sellerEmail). */
export const PUBLIC_MARKETPLACE_ITEM_FIELDS = [
  "id",
  "userId",
  "title",
  "price",
  "condition",
  "photos",
  "location",
  "description",
  "type",
  "sellerName",
  "createdAt",
  "isActive",
] as const;

export function toPublicMarketplaceItem<T extends object>(item: T) {
  return pickFields(item, PUBLIC_MARKETPLACE_ITEM_FIELDS);
}
