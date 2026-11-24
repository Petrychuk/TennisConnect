/*
  One session lifecycle for the server, Play, the public session page and
  the Organiser Hub (TC Live v1, TC-189). Pure - unit-tested in
  ./sessionLifecycle.test.ts.

  Stored status (tennis_sessions.status):
    draft / pending_review -> published (publish), published -> live
    (AUTOMATICALLY at the scheduled start - PO decision 10 Nov 2026, see
    isDueToGoLive; the server makes the change once, conditionally),
    live -> completed (organiser finishes, never the clock),
    completed -> archived (organiser archives), cancelled before it runs.
  The start time is the only moment the clock acts, and only for sessions
  that run in TC Live where Live is enabled. A session stays live past its
  scheduled end until the organiser finishes it. An earlier registration
  deadline closes registration but never starts Live.

  Four separate questions, answered from status + times:
    - public availability:  isPubliclyActive   (listed on Play, the
      organiser's page, this week, recommendations)
    - registration:          registrationBlockReason (join / waitlist /
      cancel a place)
    - Live readiness:        isReadyToStart     (organiser's "Ready to Start")
    - finished:              status completed / archived
*/

import { sessionCategoryOf } from "./sessionCategories";

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
 * Whether a freed place goes to the next player on the waiting list (TC-213).
 * Only while registration could still change - the same cutoff as a player's
 * own cancel: published, not started, not live, registration not closed. After
 * the cutoff the roster is the organiser's to manage (check-in, TC Live); a
 * waitlisted player is never moved in behind their back once play is near.
 */
export function waitlistPromotionOpen(s: LifecycleSession, now = new Date()): boolean {
  return registrationBlockReason(s, "leave", now) === null;
}

/**
 * The organiser's "Ready to Start" (derived, never stored): a published
 * session from 2 hours before its start. It turns live by itself at the
 * start time (isDueToGoLive); if Live is switched off in this environment it
 * stays published and keeps showing Ready to Start after the start time.
 */
export function isReadyToStart(s: LifecycleSession, now = new Date()): boolean {
  if (s.status !== "published") return false;
  const start = ms(s.startAt);
  return start != null && start - READY_TO_START_LEAD_MS <= now.getTime();
}

/**
 * Due to turn live by itself (PO decision 10 Nov 2026): published, its start
 * time has come, and its format runs in TC Live (not Coaching & Fitness).
 * Readiness of players is not required - Live may start with nobody checked
 * in yet and no round; the organiser checks people in and draws rounds.
 * Whether Live is enabled for the session (TC_LIVE_ENABLED) is the server's
 * part (server/lib/liveAutoStart.ts), as is "only once": the stored change
 * is conditional on the status still being published.
 */
export function isDueToGoLive(s: LifecycleSession & { type?: string | null }, now = new Date()): boolean {
  if (s.status !== "published") return false;
  if (!sessionCategoryOf(s.type).usesLiveRounds) return false;
  return hasStartTimePassed(s, now);
}
