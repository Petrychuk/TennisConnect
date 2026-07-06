import { z } from "zod";

export const clubValidationSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100),

  slug: z
    .string()
    .min(2)
    .max(120),

  category: z
    .string(),

  shortDescription: z
    .string()
    .max(250)
    .optional(),

  description: z
    .string()
    .min(20),

  website: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),

  email: z
    .string()
    .email()
    .optional()
    .or(z.literal("")),

  phone: z
    .string()
    .max(30)
    .optional(),

  googleMapsUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),

  facebook: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),

  instagram: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),

  hourlyPrice: z
    .number()
    .nullable()
    .optional(),

  seoTitle: z
    .string()
    .max(60)
    .optional(),

  metaDescription: z
    .string()
    .max(160)
    .optional(),

  metaKeywords: z
    .string()
    .max(255)
    .optional(),

  status: z.string(),

  listingType: z.string(),
});