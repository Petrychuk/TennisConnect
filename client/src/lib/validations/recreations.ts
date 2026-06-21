import { z } from "zod";

export const recreationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(150),

  provider: z
    .string()
    .trim()
    .min(2)
    .max(150),

  location: z
    .string()
    .trim()
    .min(2)
    .max(150),

  duration: z
    .string()
    .trim()
    .max(100)
    .optional(),

  price: z.coerce
    .number()
    .min(0),

  description: z
    .string()
    .trim()
    .min(20)
    .max(5000),

  coverImage: z
    .string()
    .url("Invalid image URL"),

  rating: z.coerce
    .number()
    .min(0)
    .max(5)
    .optional(),
});