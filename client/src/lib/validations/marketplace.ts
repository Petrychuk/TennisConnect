import { z } from "zod";

export const marketplaceSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5)
    .max(150),

  description: z
    .string()
    .trim()
    .min(20)
    .max(3000),

  price: z.coerce
    .number()
    .min(0),

  location: z
    .string()
    .trim()
    .min(2)
    .max(150),

  contactEmail: z
    .string()
    .email("Invalid email address"),

  contactPhone: z
    .string()
    .trim()
    .max(30)
    .optional(),
});