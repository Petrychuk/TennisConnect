export async function sendTelegramNotification({
    category,
    name,
    email,
    phone,
    message,
  }: {
    category: string;
    name: string;
    email: string;
    phone?: string;
    message: string;
  }) {
    try {
      const text = `
  🎾 TennisConnect Support Request
  
  Category:
  ${category}
  
  Name:
  ${name}
  
  Email:
  ${email}
  
  Phone:
  ${phone || "-"}
  
  Message:
  ${message}
  `;
  
      const controller = new AbortController();
      // Same reasoning as emailService.ts's Resend call - this fetch
      // previously had no ceiling at all, so a slow/unresponsive
      // Telegram API could hold the request open indefinitely.
      const timeout = setTimeout(() => controller.abort(), 8000);
      let response: Response;
      try {
        response = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: process.env.TELEGRAM_CHAT_ID,
              text,
            }),
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeout);
      }
  
      const result = await response.json();
  
      console.log("Telegram response:", result);
  
      if (!response.ok) {
        throw new Error(
          `Telegram API Error: ${JSON.stringify(result)}`
        );
      }
  
      return result;
    } catch (error) {
      console.error("Telegram notification failed:", error);
      throw error;
    }
  }