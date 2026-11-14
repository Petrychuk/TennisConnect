/*
  Which session statuses an action makes sense for (Organiser Hub,
  Phase 2 Batch 2 - Session Workspace action review).

  Invites: an invited player gets a message with a link to the session's
  public page, which exists only while it's published or live
  (GET /api/play/sessions/:id). Inviting to a draft, a session waiting
  for review, a cancelled, finished or archived one sent a message about a
  session the player couldn't open - so the server refuses it and the
  Hub doesn't offer it.

  Announcements go to registered players, and a draft has none.
*/
export const INVITABLE_SESSION_STATUSES = ["published", "live"] as const;

/** endAt: a "published" session whose end has passed is finished - no more invites. */
export function canInviteToSession(
  status: string | null | undefined,
  endAt?: Date | string | null,
  now: Date = new Date(),
): boolean {
  if (!(INVITABLE_SESSION_STATUSES as readonly string[]).includes(status ?? "")) return false;
  if (endAt && new Date(endAt).getTime() < now.getTime()) return false;
  return true;
}

export function canAnnounceToSession(status: string | null | undefined): boolean {
  return !!status && status !== "draft";
}

/**
 * The session's public page (/play/:id) exists while it's published or live
 * and public - the same rule as GET /api/play/sessions/:id. Null otherwise,
 * so nobody is handed a link that 404s.
 */
export function publicSessionPath(session: { id: string; status?: string | null; visibility?: string | null }): string | null {
  if (!["published", "live"].includes(session.status ?? "")) return null;
  if (session.visibility && session.visibility !== "public") return null;
  return `/play/${session.id}`;
}

/*
  After Finish (TC-189 phase 5): a completed or archived session is a
  record. Its results are final, so the roster they were computed from is
  frozen too - no check-in, remove or move to the waiting list (each
  changes who appears on the leaderboard).
*/
const FINISHED_STATUSES = ["completed", "archived"];

/** Results (final standings, rounds) exist and are read-only. */
export function resultsAreFinal(status: string | null | undefined): boolean {
  return FINISHED_STATUSES.includes(status ?? "");
}

/** Check in, remove, move to the waiting list. */
export function canChangeRoster(status: string | null | undefined): boolean {
  return !!status && !FINISHED_STATUSES.includes(status) && status !== "cancelled";
}

/** Cancel tells every player the session is off - only before it ran. */
export function canCancelSession(status: string | null | undefined): boolean {
  return ["draft", "pending_review", "published"].includes(status ?? "");
}

/** A live session is ended with End Session (scores closed, results final), never archived mid-play. */
export function canArchiveSession(status: string | null | undefined): boolean {
  return !!status && status !== "live" && status !== "archived";
}
