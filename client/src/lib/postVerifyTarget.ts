// Where a person lands after email verification or sign-in.
//
// verify-email.tsx and auth.tsx (the "check your email" poll and the login
// form) each used to build this target inline: a stashed returnTo (from
// registering to join a session, say), else /complete-profile for an unfinished
// profile, else the person's own profile. One function now, so the three
// places can't drift, and a returnTo is checked before it is followed.
//
// Nothing here sends anyone to /organiser by default. A person only reaches
// the Organiser Hub by asking for it (or by a returnTo that names it, e.g. a
// guest who opened /organiser, was sent to sign in, and came back); the Hub's
// own access gate then decides what they see.

export interface ProfileOwner {
  // The account type can be missing on a half-created account (role: null);
  // profilePathFor then has no route to build and falls back to "/".
  role?: string | null;
  slug?: string | null;
}

export interface PostAuthUser extends ProfileOwner {
  profileCompleted?: boolean | null;
}

export interface ReturnRequest {
  returnTo?: string | null;
  joinSession?: string | null;
}

/** The signed-in person's own public profile route, or "/" if it can't be built. */
export function profilePathFor(user: ProfileOwner | null | undefined): string {
  if (!user || !user.role || !user.slug) return "/";
  return `/${user.role}/${user.slug}`;
}

// A throwaway origin: only used to tell a same-site path from anything else.
const PROBE_ORIGIN = "https://return-path.invalid";

/**
 * A return path that stays on this site, as `pathname + search`, or null.
 * Accepts only a single-slash path ("/organiser/sessions?x=1"). Absolute URLs,
 * protocol-relative ("//host"), backslash tricks and control characters are
 * all refused rather than "repaired".
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

/** A safe returnTo, plus the joinSession it travels with. null when there is nothing safe to follow. */
export function resolveReturnTarget(request: ReturnRequest | null | undefined): string | null {
  const path = safeReturnPath(request?.returnTo);
  if (!path) return null;
  const joinSession = request?.joinSession;
  if (!joinSession) return path;
  const url = new URL(path, PROBE_ORIGIN);
  url.searchParams.set("joinSession", joinSession);
  return url.pathname + url.search;
}

/** Target after a confirmed email address. */
export function postVerifyTarget(user: PostAuthUser, stashed: ReturnRequest | null | undefined): string {
  return resolveReturnTarget(stashed) ?? (user.profileCompleted ? profilePathFor(user) : "/complete-profile");
}
