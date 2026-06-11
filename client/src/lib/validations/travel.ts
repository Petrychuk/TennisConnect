import { z } from "zod";

export const travelSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5)
    .max(150),

  destination: z
    .string()
    .trim()
    .min(2)
    .max(100),

  duration: z
    .string()
    .trim()
    .min(2)
    .max(50),

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

  spotsLeft: z.coerce
    .number()
    .min(0)
    .max(10000),
});