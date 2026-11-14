/*
  One session lifecycle for the server, Play, the public session page and
  the Organiser Hub (TC Live v1, TC-189). Pure - unit-tested in
  ./sessionLifecycle.test.ts.

  Stored status (tennis_sessions.status) is changed only by people:
    draft / pending_review -> published (publish), published -> live
    (organiser starts TC Live), live -> completed (organiser finishes),
    completed -> archived (organiser archives), any -> cancelled.
  The clock never changes it: a session doesn't become live because its
  start time came, and stays live past its scheduled end until finished.

  Four separate questions, answered from status + times:
    - public availability:  isPubliclyActive   (listed on Play, the
      organiser's page, this week, recommendations)
    - registration:          registrationBlockReason (join / waitlist /
      cancel a place)
    - Live readiness:        isReadyToStart     (organiser's "Ready to Start")
    - finished:              status completed / archived
*/

export interface LifecycleSession {
  status: string;
  startAt: Date | string;
  registrationOpensAt?: Date | string | null;
  registrationClosesAt?: Date | string | null;
}

/** "Ready to Start" from this long before the scheduled start (and any time after it). */
export const READY_TO_START_LEAD_MS = 2 * 60 * 60 * 1000;

const ms = (v: Date | string | null | undefined) => (v == null ? null : new Date(v).getTime());

export function hasStartTimePassed(s: LifecycleSession, now = new Date()): boolean {
  return (ms(s.startAt) ?? Infinity) <= now.getTime();
}

export function isFinished(s: Pick<LifecycleSession, "status">): boolean {
  return s.status === "completed" || s.status === "archived";
}

/**
 * Listed publicly (Play, organisation page, this week, recommendations):
 * published, not started yet, and registration not closed. A session whose
 * registration closed early, or whose start time has come, keeps its direct
 * link (read-only) but drops out of every listing.
 */
export function isPubliclyActive(s: LifecycleSession, now = new Date()): boolean {
  if (s.status !== "published") return false;
  if (hasStartTimePassed(s, now)) return false;
  const closes = ms(s.registrationClosesAt);
  return closes == null || closes > now.getTime();
}

/**
 * Why a player can't join, join the waiting list or cancel their place now -
 * or null when they can. ("Not open yet" applies to joining only.)
 */
export function registrationBlockReason(s: LifecycleSession, action: "join" | "leave", now = new Date()): string | null {
  if (isFinished(s)) return "This session has finished.";
  if (s.status === "cancelled") return "This session was cancelled.";
  if (s.status === "live" || hasStartTimePassed(s, now)) return "This session has already started.";
  if (s.status !== "published") return "This session isn't open for registration.";
  const closes = ms(s.registrationClosesAt);
  if (closes != null && closes <= now.getTime()) return "Registration is closed.";
  const opens = ms(s.registrationOpensAt);
  if (action === "join" && opens != null && opens > now.getTime()) return "Registration hasn't opened yet.";
  return null;
}

/**
 * The organiser's "Ready to Start": a published session from 2 hours before
 * its start - and still after the start time passes (they may start late).
 * Nothing changes in the database; Start Live is the organiser's action.
 */
export function isReadyToStart(s: LifecycleSession, now = new Date()): boolean {
  if (s.status !== "published") return false;
  const start = ms(s.startAt);
  return start != null && start - READY_TO_START_LEAD_MS <= now.getTime();
}
