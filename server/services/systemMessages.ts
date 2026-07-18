import { storage } from "../storage";

export async function sendSystemMessage(
    recipientId: string,
    recipientType: string,
    subject: string,
    content: string
  ) {
  
    const conversationId = `admin-${recipientId}`;
  
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

// Sent whenever a user gains organizer access — whether their Organizer
// Request was approved, or an admin granted it to them directly from
// the Users tab. Kept in one place so both paths say the same thing.
export const ORGANIZER_APPROVED_SUBJECT = "You're Approved as an Organizer!";
export const ORGANIZER_APPROVED_MESSAGE =
  "Great news — you've been approved as an Organizer on TennisConnect. " +
  "You can now create social competitions and tournaments, and manage " +
  "them right from your dashboard. Head to your Organizer Dashboard to " +
  "get started. — TennisConnect Team";