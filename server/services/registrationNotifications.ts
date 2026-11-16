/*
  Notifications about registration changes (TC-213, approved rules):

  - Sent only AFTER the change committed: callers pass what the committed
    transaction returned (server/lib/registrationTx.ts), never something they
    expect to happen.
  - Best-effort: a failed message is logged and never undoes, or turns into an
    error for, a registration that already happened.
  - Deduplicated: one message per promoted registration per change - a
    promotion only ever happens once (it's a conditional status change under
    the session lock), and repeat requests that change nothing send nothing.

  Channel: in-app messages (the organiser's thread with the player, like
  "You're In!"). Email: not sent - TennisConnect has no notification-email
  preferences yet, so no email is "permitted by user preferences"; see
  docs/organiser-hub/REGISTRATION_AND_WAITLIST.md. There is no durable outbox:
  a crash between the commit and the send loses that message (documented
  there too).
*/

import { storage } from "../storage";
import { sendMessageBetween } from "./systemMessages";

/** Runs one notification step; logs and swallows its failure. true = it ran without throwing. */
export async function bestEffort(label: string, step: () => Promise<unknown>): Promise<boolean> {
  try {
    await step();
    return true;
  } catch (error) {
    console.error(`[registration-notify] ${label} failed:`, error);
    return false;
  }
}

export const PROMOTED_SUBJECT = "You're off the waiting list";
export const LATE_ADDED_SUBJECT = "You've been added";

/**
 * Tells each player moved up from the waiting list that they now have a
 * place. `registrationIds` = promotedIds from the committed change. A
 * registration that is no longer "registered" by now (cancelled again in the
 * meantime) gets nothing. Returns how many messages were sent.
 */
export async function notifyPromotedPlayers(sessionId: string, registrationIds: readonly string[]): Promise<number> {
  const ids = Array.from(new Set(registrationIds));
  if (ids.length === 0) return 0;
  let sent = 0;
  await bestEffort(`promotion notices for session ${sessionId}`, async () => {
    const session = await storage.getSessionById(sessionId);
    if (!session) return;
    const organizer = await storage.getUser(session.createdBy);
    if (!organizer) return;
    for (const id of ids) {
      await bestEffort(`promotion notice for registration ${id}`, async () => {
        const registration = await storage.getRegistrationById(id);
        if (!registration || registration.status !== "registered" || registration.userId === organizer.id) return;
        const player = await storage.getUser(registration.userId);
        if (!player) return;
        await sendMessageBetween(
          organizer,
          player.id,
          player.role,
          PROMOTED_SUBJECT,
          `A place opened up in "${session.title}" - you're registered now. It's in your My Sessions.`
        );
        sent += 1;
      });
    }
  });
  return sent;
}

/** Tells a player the organiser added them after registration closed. Once per committed addition. */
export async function notifyLateAddedPlayer(sessionId: string, organizerId: string, playerId: string): Promise<boolean> {
  let sent = false;
  await bestEffort(`late-add notice for ${playerId} in session ${sessionId}`, async () => {
    if (playerId === organizerId) return;
    const [session, organizer, player] = await Promise.all([
      storage.getSessionById(sessionId),
      storage.getUser(organizerId),
      storage.getUser(playerId),
    ]);
    if (!session || !organizer || !player) return;
    await sendMessageBetween(
      organizer,
      player.id,
      player.role,
      LATE_ADDED_SUBJECT,
      `${organizer.name} added you to "${session.title}". It's in your My Sessions.`
    );
    sent = true;
  });
  return sent;
}
