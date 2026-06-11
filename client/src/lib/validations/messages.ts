import { z } from "zod";

// Player/Coach -> Player (page players) 
export const quickMessageSchema = z.object({
    content: z
      .string()
      .trim()
      .min(5, "Message must be at least 5 characters")
      .max(1000, "Message is too long"),
  });

// Player -> Coach
export const messageSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(100, "Subject is too long"),

  message: z
    .string()
    .trim()
    .min(5, "Message must be at least 5 characters")
    .max(1000, "Message is too long"),

  phone: z
    .string()
    .trim()
    .max(30, "Phone number is too long")
    .optional(),
});

// Reply om page messagers
export const replySchema = z.object({
    content: z
      .string()
      .trim()
      .min(5, "Reply must be at least 5 characters")
      .max(1000, "Reply is too long"),
  });