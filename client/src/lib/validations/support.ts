import { z } from "zod";

export const supportSchema = z.object({
  category: z
    .string()
    .min(1, "Please select a category"),

  name: z
    .string()
    .trim()
    .min(2, "Name is too short")
    .max(100, "Name is too long"),

  email: z
    .string()
    .trim()
    .email("Invalid email address"),

  phone: z
    .string()
    .trim()
    .max(30, "Phone number is too long")
    .optional(),

  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message is too long"),
});