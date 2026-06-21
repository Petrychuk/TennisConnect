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