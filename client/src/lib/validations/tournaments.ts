import { z } from "zod";

export const tournamentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5)
    .max(150),

  location: z
    .string()
    .trim()
    .min(2)
    .max(150),

  date: z
    .string()
    .min(1, "Tournament date is required"),

  entryFee: z.coerce
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
});