/*
  The rules a player's Join has to pass, in one place for the API (and its
  tests). The page hides buttons that don't apply; this is what makes the
  rule real for any client.
*/
import { hasAnyPolicy, readSessionPolicies, type SessionPolicyColumns } from "./sessionPolicies";

export type JoinRuleSession = SessionPolicyColumns & {
  registrationOpensAt: Date | string | null;
  registrationClosesAt: Date | string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  status?: string;
};

/**
 * The rule for "it's over": a session whose end (or, with no end, its start)
 * has passed - or that is already completed/archived - is finished. It is
 * archived everywhere (Play hides it, its page says "Archived") and nobody
 * can join it or cancel a place in it any more.
 */
export function sessionHasFinished(session: { startAt: Date | string; endAt: Date | string | null; status?: string }, now = new Date()): boolean {
  if (session.status === "completed" || session.status === "archived") return true;
  if (session.status === "live") return false; // still being played, even if it runs late
  return new Date(session.endAt ?? session.startAt).getTime() < now.getTime();
}

const at = (v: Date | string | null) => (v == null ? null : new Date(v).getTime());

/** Why this join can't go ahead, or null when it can. */
export function joinBlockedReason(session: JoinRuleSession, acceptedPolicies: boolean, now = new Date()): string | null {
  if (sessionHasFinished(session, now)) return "This session has finished.";
  const opens = at(session.registrationOpensAt);
  const closes = at(session.registrationClosesAt);
  if (opens != null && opens > now.getTime()) return "Registration hasn't opened yet.";
  if (closes != null && closes < now.getTime()) return "Registration is closed.";
  // A session with rules or policies needs the player's "I agree" with them.
  if (sessionHasPolicies(session) && !acceptedPolicies) return "Please accept the session rules and policies to join.";
  return null;
}

export function sessionHasPolicies(session: SessionPolicyColumns): boolean {
  return hasAnyPolicy(readSessionPolicies(session).policies);
}
