/*
  The rules a player's Join has to pass, in one place for the API (and its
  tests). The page hides buttons that don't apply; this is what makes the
  rule real for any client. Timing and status come from the one session
  lifecycle (./sessionLifecycle.ts).
*/
import { hasAnyPolicy, readSessionPolicies, type SessionPolicyColumns } from "./sessionPolicies";
import { registrationBlockReason, type LifecycleSession } from "./sessionLifecycle";

export type JoinRuleSession = SessionPolicyColumns & LifecycleSession;

/** Why this join can't go ahead, or null when it can. */
export function joinBlockedReason(session: JoinRuleSession, acceptedPolicies: boolean, now = new Date()): string | null {
  const blocked = registrationBlockReason(session, "join", now);
  if (blocked) return blocked;
  // A session with rules or policies needs the player's "I agree" with them.
  if (sessionHasPolicies(session) && !acceptedPolicies) return "Please accept the session rules and policies to join.";
  return null;
}

export function sessionHasPolicies(session: SessionPolicyColumns): boolean {
  return hasAnyPolicy(readSessionPolicies(session).policies);
}
