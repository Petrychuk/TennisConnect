import { storage } from "../storage";

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
  
      senderName: "Site Admin",
      senderEmail: "makeinfosense@gmail.com",
  
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