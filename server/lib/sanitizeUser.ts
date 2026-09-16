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
//                   by" card). Strips password AND every internal-only
//                   field a stranger has no business seeing - login
//                   email, moderation/admin flags, account status.

export function omitPassword<T extends { password?: unknown }>(
  user: T
): Omit<T, "password"> {
  const { password, ...safeUser } = user;
  return safeUser;
}

export function toPublicUser<
  T extends {
    password?: unknown;
    email?: unknown;
    isAdmin?: unknown;
    isApproved?: unknown;
    isTestUser?: unknown;
    isHidden?: unknown;
    status?: unknown;
    emailVerified?: unknown;
    emailVerifiedAt?: unknown;
  }
>(
  user: T
): Omit<
  T,
  "password" | "email" | "isAdmin" | "isApproved" | "isTestUser" | "isHidden" | "status" | "emailVerified" | "emailVerifiedAt"
> {
  const {
    password,
    email,
    isAdmin,
    isApproved,
    isTestUser,
    isHidden,
    status,
    emailVerified,
    emailVerifiedAt,
    ...safeUser
  } = user;
  return safeUser;
}
