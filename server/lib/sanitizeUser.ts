// Storage reads pull every column (including the password hash and
// internal moderation flags) since most internal callers need the
// full row. Anything that gets sent back to a client goes through one
// of these first, chosen by WHO the response is for:
//
//   omitPassword  - the account owner themselves (login/register/
//                    verify-email/session responses). They're allowed
//                    to see their own email, isAdmin, isApproved, etc
//                    - only the password hash itself is never sent.
//
//   toPublicUser  - anyone ELSE looking at this user (a public player/
//                   coach profile, a directory listing, an "organised
//                   by" card). Keeps only PUBLIC_USER_FIELDS - never the
//                   password, login email, moderation/admin flags,
//                   account status or login-lockout counters.

export function omitPassword<T extends { password?: unknown }>(
  user: T
): Omit<T, "password"> {
  const { password, ...safeUser } = user;
  return safeUser;
}

// An ALLOWLIST (29 Oct 2026): it used to remove a fixed list of fields,
// so anything else on the row - failedLoginAttempts, lockedUntil, and any
// column added later - reached the public. Now only these leave.
export const PUBLIC_USER_FIELDS = [
  "id",
  "name",
  "role",
  "slug",
  "avatar",
  "cover",
  "profileCompleted",
  "isOrganizer",
  "createdAt",
] as const;

export type PublicUserField = (typeof PUBLIC_USER_FIELDS)[number];

export function toPublicUser<T extends object>(user: T): Pick<T, Extract<keyof T, PublicUserField>> {
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_USER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(user, field)) out[field] = (user as Record<string, unknown>)[field];
  }
  return out as Pick<T, Extract<keyof T, PublicUserField>>;
}
