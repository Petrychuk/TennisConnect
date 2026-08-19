import { storage } from "../storage";

// Same two people always get the same thread, regardless of who sent
// which message or what it was about - "conversation between admin
// and this organiser about their sessions", not a new thread per event.
function pairConversationId(idA: string, idB: string): string {
  return `conv-${[idA, idB].sort().join("-")}`;
}

/**
 * A message with a real sender behind it - the actual admin, organiser,
 * or player involved, not an impersonal "Site Admin" placeholder. This
 * is what makes Reply work (it requires a real senderUserId) and what
 * makes the inbox show who a notification is actually about. Groups
 * with any other message between this same pair of people into one
 * conversation thread.
 */
export async function sendMessageBetween(
  sender: { id: string; name: string; email: string },
  recipientId: string,
  recipientType: string,
  subject: string,
  content: string,
  invitation?: {
    messageType: "community_invite" | "session_invite";
    relatedSessionId?: string;
    relatedOrganizationId?: string;
  }
) {
  await storage.createMessage({
    recipientId,
    recipientType,

    senderUserId: sender.id,
    senderName: sender.name,
    senderEmail: sender.email,

    senderPhone: null,

    conversationId: pairConversationId(sender.id, recipientId),

    messageType: invitation?.messageType ?? null,
    relatedSessionId: invitation?.relatedSessionId ?? null,
    relatedOrganizationId: invitation?.relatedOrganizationId ?? null,
    actionStatus: invitation ? "pending" : null,

    subject,
    content,
  });
}

// The one case with no other real person to attribute it to - kept as
// a system notice from "Tennis Connect" (the platform, not a specific
// admin), not repliable. Still one thread per recipient (the original
// admin-${recipientId} scheme), so e.g. a repeated welcome message
// doesn't create a new thread each time.
export async function sendSystemMessage(
    recipientId: string,
    recipientType: string,
    subject: string,
    content: string,
    conversationId: string = `admin-${recipientId}`
  ) {
  
    await storage.createMessage({
      recipientId,
      recipientType,
  
      senderUserId: null,
  
      senderName: "Tennis Connect",
      senderEmail: "tennisconnect.au@gmail.com",
  
      senderPhone: null,
  
      conversationId,
  
      subject,
      content,
    });
  }

// Sent whenever a user gains organiser access — whether their Organiser
// Request was approved, or an admin granted it to them directly from
// the Users tab. Kept in one place so both paths say the same thing.
export const ORGANIZER_APPROVED_SUBJECT = "You're Approved as an Organiser!";
export const ORGANIZER_APPROVED_MESSAGE =
  "Great news — you've been approved as an Organiser on TennisConnect. " +
  "You can now create social competitions and tournaments, and manage " +
  "them right from your dashboard. Head to your Organiser Dashboard to " +
  "get started. — TennisConnect Team";
