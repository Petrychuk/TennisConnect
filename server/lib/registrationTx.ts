/*
  Registrations, capacity and the waiting list - atomically (TC-213,
  Organiser Hub audit OH-AUDIT-003 / 007 / 008).

  Every change to who holds a place in ONE session runs in a transaction that
  first locks that session's row (SELECT ... FOR UPDATE): joining, a player
  cancelling, the organiser removing someone or moving them to the waiting
  list, accepting an invitation, and changing the session's capacity. They
  queue on that lock, so the capacity check and the write that depends on it
  can't interleave:
    - two players asking for the last place: one gets it, the other is
      waitlisted (or told it's full);
    - the same player joining twice: one row, the second call is a no-op;
    - a place freed twice at once: each freed place goes to exactly one
      waitlisted player, oldest first;
    - capacity cut while someone joins: never more registered players than
      the capacity.
  Lock order is the session row first, then registrations - the same order as
  TC Live's generateNextRound / finishSession, so they can't deadlock.

  The unique (session_id, user_id) constraint stays the final backstop for
  duplicates. No database import here: callers pass their executor (the shared
  db, or a transaction), like organizationCascade.ts - so the real-Postgres
  test (registrationTx.pg.test.ts) runs exactly this code.

  Freed places go to the waiting list only while registration could still
  change (shared/sessionLifecycle.ts waitlistPromotionOpen). Inside a
  transaction only `tx` is used, never the shared pool.
*/

import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { registrationAuditEvents, registrations, tennisSessions, type Registration, type TennisSession } from "@shared/schema";
import { registrationBlockReason, waitlistPromotionOpen } from "@shared/sessionLifecycle";
import { LiveRuleError } from "./liveErrors";

type Db = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** The shared db, or a transaction (nested calls become savepoints). */
export type Executor = Db | Tx;

/** Hard cap on how many waitlisted players one change can promote. */
const MAX_PROMOTIONS = 500;

/** Locks the session row until the transaction ends; every registration change of this session waits here. */
export async function lockSession(tx: Tx, sessionId: string): Promise<TennisSession | undefined> {
  const [row] = await tx.select().from(tennisSessions).where(eq(tennisSessions.id, sessionId)).for("update");
  return row;
}

async function registeredCount(tx: Tx, sessionId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(registrations)
    .where(and(eq(registrations.sessionId, sessionId), eq(registrations.status, "registered")));
  return Number(row?.n ?? 0);
}

async function findRegistration(tx: Tx, sessionId: string, userId: string): Promise<Registration | undefined> {
  const [row] = await tx
    .select()
    .from(registrations)
    .where(and(eq(registrations.sessionId, sessionId), eq(registrations.userId, userId)));
  return row;
}

/**
 * Fills every free place from the waiting list, oldest first. Call with the
 * session row locked. Free places are counted under the lock, so however many
 * changes free places at once, each place is filled exactly once and capacity
 * is never exceeded. Returns the promoted registration ids.
 */
export async function promoteFromWaitlist(tx: Tx, session: TennisSession, now = new Date()): Promise<string[]> {
  if (!waitlistPromotionOpen(session, now)) return [];
  const free =
    session.maxParticipants == null ? MAX_PROMOTIONS : session.maxParticipants - (await registeredCount(tx, session.id));
  if (free <= 0) return [];
  const next = await tx
    .select({ id: registrations.id })
    .from(registrations)
    .where(and(eq(registrations.sessionId, session.id), eq(registrations.status, "waitlisted")))
    .orderBy(asc(registrations.createdAt), asc(registrations.id))
    .limit(Math.min(free, MAX_PROMOTIONS));
  if (next.length === 0) return [];
  const promoted = await tx
    .update(registrations)
    .set({ status: "registered" })
    .where(and(inArray(registrations.id, next.map((r) => r.id)), eq(registrations.status, "waitlisted")))
    .returning({ id: registrations.id });
  return promoted.map((r) => r.id);
}

// ---------- Player joins ----------

export interface JoinResult {
  registration: Registration;
  waitlisted: boolean;
  /** false: the player already had a place or was already waitlisted - nothing changed, nobody is notified again. */
  changed: boolean;
}

export async function registerPlayer(db: Executor, sessionId: string, userId: string): Promise<JoinResult> {
  return db.transaction(async (tx) => {
    const session = await lockSession(tx, sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "published") throw new Error("Session is not open for registration");

    const existing = await findRegistration(tx, sessionId, userId);
    // An invited player who joins from the session page takes a place like
    // anyone else; a cancelled one can join again.
    if (existing && existing.status !== "cancelled" && existing.status !== "invited") {
      return { registration: existing, waitlisted: existing.status === "waitlisted", changed: false };
    }

    const taken = await registeredCount(tx, sessionId);
    const isFull = session.maxParticipants != null && taken >= session.maxParticipants;
    const status = isFull ? (session.waitingListEnabled ? "waitlisted" : null) : "registered";
    if (!status) throw new Error("Session is full");

    if (existing) {
      // Joining again (after cancelling, or accepting an invitation by joining)
      // is a new join: it queues behind everyone already waiting.
      const [updated] = await tx
        .update(registrations)
        .set({ status, checkedInAt: null, liveStatus: null, createdAt: new Date() })
        .where(eq(registrations.id, existing.id))
        .returning();
      return { registration: updated, waitlisted: status === "waitlisted", changed: true };
    }

    const [created] = await tx.insert(registrations).values({ sessionId, userId, status }).returning();
    return { registration: created, waitlisted: status === "waitlisted", changed: true };
  });
}

// ---------- Leaving a session ----------

export interface CancelResult {
  registration: Registration;
  /** false: it was already cancelled - nothing changed, nobody is notified again. */
  changed: boolean;
  /** Waitlisted registrations that took the freed place. */
  promotedIds: string[];
}

async function cancelLocked(tx: Tx, session: TennisSession | undefined, existing: Registration, now: Date): Promise<CancelResult> {
  if (existing.status === "cancelled") return { registration: existing, changed: false, promotedIds: [] };
  const [cancelled] = await tx
    .update(registrations)
    .set({ status: "cancelled" })
    .where(eq(registrations.id, existing.id))
    .returning();
  // Only a held place frees one (a waitlisted or invited row never held one).
  const promotedIds = existing.status === "registered" && session ? await promoteFromWaitlist(tx, session, now) : [];
  return { registration: cancelled, changed: true, promotedIds };
}

/** A player cancels their own place (Play, or declining an invitation). */
export async function cancelPlayerRegistration(db: Executor, sessionId: string, userId: string, now = new Date()): Promise<CancelResult> {
  return db.transaction(async (tx) => {
    const session = await lockSession(tx, sessionId);
    const existing = await findRegistration(tx, sessionId, userId);
    if (!existing) throw new Error("Registration not found");
    return cancelLocked(tx, session, existing, now);
  });
}

/** The organiser removes one registration (Players tab "Remove"). Same effect as the player cancelling. */
export async function removeRegistrationById(db: Executor, registrationId: string, now = new Date()): Promise<CancelResult> {
  return db.transaction(async (tx) => {
    const [found] = await tx.select({ sessionId: registrations.sessionId }).from(registrations).where(eq(registrations.id, registrationId));
    if (!found) throw new Error("Registration not found");
    const session = await lockSession(tx, found.sessionId);
    const [existing] = await tx.select().from(registrations).where(eq(registrations.id, registrationId));
    if (!existing) throw new Error("Registration not found");
    return cancelLocked(tx, session, existing, now);
  });
}

/**
 * The organiser moves a registered player to the waiting list (an override).
 * Only from "registered"; already waitlisted is a no-op. Their check-in and
 * live status go (a waitlisted player is never on court). They keep their
 * original join time, so they come back first; the freed place is not filled
 * from the waiting list - the organiser is making room on purpose.
 */
export async function moveRegistrationToWaitlist(db: Executor, registrationId: string): Promise<Registration> {
  return db.transaction(async (tx) => {
    const [found] = await tx.select({ sessionId: registrations.sessionId }).from(registrations).where(eq(registrations.id, registrationId));
    if (!found) throw new Error("Registration not found");
    await lockSession(tx, found.sessionId);
    const [existing] = await tx.select().from(registrations).where(eq(registrations.id, registrationId));
    if (!existing) throw new Error("Registration not found");
    if (existing.status === "waitlisted") return existing;
    if (existing.status !== "registered") {
      throw new LiveRuleError(`Only registered players can be moved to the waiting list (this one is ${existing.status})`, 409, "invalid_waitlist_move");
    }
    const [moved] = await tx
      .update(registrations)
      .set({ status: "waitlisted", checkedInAt: null, liveStatus: null })
      .where(eq(registrations.id, existing.id))
      .returning();
    return moved;
  });
}

// ---------- Invitations ----------

/**
 * The invited player accepts (Messages). Takes a place like Join: the
 * registration cutoff applies (TC-189 rule 1 - every registration change is
 * checked server-side), and a full session waitlists them or says it's full.
 * The invitation itself let them in before registration opened, so "not open
 * yet" doesn't apply.
 */
export async function acceptInvitation(db: Executor, sessionId: string, userId: string, now = new Date()): Promise<Registration> {
  return db.transaction(async (tx) => {
    const session = await lockSession(tx, sessionId);
    const existing = await findRegistration(tx, sessionId, userId);
    if (!existing) throw new Error("Invitation not found");
    if (existing.status !== "invited") return existing;
    if (!session) throw new Error("Session not found");
    const blocked = registrationBlockReason(session, "leave", now);
    if (blocked) throw new LiveRuleError(blocked, 409, "registration_closed");

    let status: "registered" | "waitlisted" = "registered";
    if (session.maxParticipants != null && (await registeredCount(tx, sessionId)) >= session.maxParticipants) {
      if (!session.waitingListEnabled) throw new Error("This session is full.");
      status = "waitlisted";
    }
    const [updated] = await tx
      .update(registrations)
      .set({ status, checkedInAt: null, createdAt: now })
      .where(eq(registrations.id, existing.id))
      .returning();
    return updated;
  });
}

// ---------- Capacity ----------

export function capacityBelowRegisteredError(registered: number): LiveRuleError {
  return new LiveRuleError(
    `${registered} player${registered === 1 ? " is" : "s are"} already registered - set the capacity to ${registered} or more, or remove players first.`,
    409,
    "capacity_below_registered",
    { registered },
  );
}

/**
 * A session update that changes maxParticipants: checked against the players
 * holding a place under the session lock (a join can't slip in between), then
 * written; a higher (or removed) limit fills the new places from the waiting
 * list. `where` adds the caller's own conditions (edit guard, stale-write
 * guard) - no row matched = undefined, nothing changed.
 */
export async function updateSessionCapacity(
  db: Executor,
  sessionId: string,
  set: Record<string, unknown>,
  where?: SQL,
  now = new Date(),
): Promise<{ session: TennisSession | undefined; promotedIds: string[] }> {
  return db.transaction(async (tx) => {
    const before = await lockSession(tx, sessionId);
    if (!before) return { session: undefined, promotedIds: [] };
    const max = set.maxParticipants;
    if (typeof max === "number") {
      const registered = await registeredCount(tx, sessionId);
      if (max < registered) throw capacityBelowRegisteredError(registered);
    }
    const [session] = await tx
      .update(tennisSessions)
      .set(set as Partial<typeof tennisSessions.$inferInsert>)
      .where(and(eq(tennisSessions.id, sessionId), where))
      .returning();
    if (!session) return { session: undefined, promotedIds: [] };
    const grew = session.maxParticipants == null || (before.maxParticipants != null && session.maxParticipants > before.maxParticipants);
    const promotedIds = grew ? await promoteFromWaitlist(tx, session, now) : [];
    return { session, promotedIds };
  });
}

// ---------- Late organiser registration (after the cutoff) ----------

export const LATE_ADD_REASON_MAX = 500;

export interface LateAddInput {
  sessionId: string;
  userId: string;
  /** The organiser doing it - recorded in the audit event. */
  actorId: string;
  /** Explicit confirmation to add this player ahead of people on the waiting list. */
  overrideWaitlist?: boolean;
  /** Required with an override; recorded in the audit event. */
  reason?: string | null;
}

export interface LateAddResult {
  registration: Registration;
  previousStatus: string | null;
  overrodeWaitlist: boolean;
  /** Waitlisted registrations that were ahead of this player and stay waiting. */
  bypassedRegistrationIds: string[];
}

/**
 * The organiser adds a player after the registration cutoff (approved TC-213
 * rule: automatic promotion stops at the cutoff; after it, places are the
 * organiser's call). Under the session lock:
 *   - only a published or live session (never draft / review / cancelled /
 *     finished) and only once the cutoff has passed - before it, players join
 *     or are invited and the waiting list fills places automatically;
 *   - never a second registration for the same player, never over capacity;
 *   - the waiting list is never skipped silently: adding anyone but the first
 *     player in line needs overrideWaitlist + a reason, and is audited;
 *   - nothing else changes: no Live round is touched, the player isn't checked in.
 * Every late addition writes one audit event (actor, player, time, reason,
 * previous status, who was skipped) in the same transaction.
 */
export async function lateRegisterPlayer(db: Executor, input: LateAddInput, now = new Date()): Promise<LateAddResult> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length > LATE_ADD_REASON_MAX) {
    throw new LiveRuleError(`Keep the reason under ${LATE_ADD_REASON_MAX} characters`, 400, "reason_too_long");
  }
  return db.transaction(async (tx) => {
    const session = await lockSession(tx, input.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "published" && session.status !== "live") {
      throw new LiveRuleError(`Players can't be added to a ${session.status} session`, 409, "session_not_open");
    }
    if (waitlistPromotionOpen(session, now)) {
      throw new LiveRuleError(
        "Registration is still open - invite the player, or they can join themselves. The waiting list fills free places automatically until the cutoff.",
        409,
        "registration_open",
      );
    }

    const existing = await findRegistration(tx, input.sessionId, input.userId);
    if (existing?.status === "registered") {
      throw new LiveRuleError("This player already has a place in the session", 409, "already_registered");
    }

    if (session.maxParticipants != null && (await registeredCount(tx, input.sessionId)) >= session.maxParticipants) {
      throw new LiveRuleError(
        `The session is full (${session.maxParticipants} places) - raise the capacity or remove a player first.`,
        409,
        "capacity_full",
        { maxParticipants: session.maxParticipants },
      );
    }

    const waiting = await tx
      .select({ id: registrations.id, userId: registrations.userId })
      .from(registrations)
      .where(and(eq(registrations.sessionId, input.sessionId), eq(registrations.status, "waitlisted")))
      .orderBy(asc(registrations.createdAt), asc(registrations.id));
    const position = waiting.findIndex((w) => w.userId === input.userId);
    const ahead = position === -1 ? waiting : waiting.slice(0, position);
    const overriding = ahead.length > 0;
    if (overriding && input.overrideWaitlist !== true) {
      throw new LiveRuleError(
        `${ahead.length} player${ahead.length === 1 ? " is" : "s are"} waiting ahead of this player. Confirm that you're skipping the waiting list, and why.`,
        409,
        "waitlist_override_required",
        { waiting: waiting.length, ahead: ahead.length, nextRegistrationId: waiting[0].id, nextUserId: waiting[0].userId },
      );
    }
    if (overriding && !reason) {
      throw new LiveRuleError("Give a reason for skipping the waiting list", 400, "override_reason_required");
    }

    let registration: Registration;
    if (existing) {
      // A waitlisted player keeps the time they joined; anyone else joins now.
      [registration] = await tx
        .update(registrations)
        .set({
          status: "registered",
          checkedInAt: null,
          liveStatus: null,
          ...(existing.status === "waitlisted" ? {} : { createdAt: now }),
        })
        .where(eq(registrations.id, existing.id))
        .returning();
    } else {
      [registration] = await tx
        .insert(registrations)
        .values({ sessionId: input.sessionId, userId: input.userId, status: "registered", createdAt: now })
        .returning();
    }

    await tx.insert(registrationAuditEvents).values({
      sessionId: input.sessionId,
      playerId: input.userId,
      actorId: input.actorId,
      action: overriding ? "late_add_waitlist_override" : "late_add",
      reason: reason || null,
      details: {
        previousStatus: existing?.status ?? null,
        waitlisted: waiting.length,
        bypassedRegistrationIds: ahead.map((w) => w.id),
        sessionStatus: session.status,
      },
      createdAt: now,
    });

    return {
      registration,
      previousStatus: existing?.status ?? null,
      overrodeWaitlist: overriding,
      bypassedRegistrationIds: ahead.map((w) => w.id),
    };
  });
}
