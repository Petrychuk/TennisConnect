import { z } from "zod";

export const travelSchema = z.object({
  title: z.string().trim().min(5).max(150),
  destination: z.string().trim().min(2).max(100),
  duration: z.string().trim().min(2).max(50),
  price: z.coerce.number().min(0),
  description: z.string().trim().min(20).max(5000),
  content: z.string().trim().max(50000).optional(),
  coverImage: z.string().url("Invalid image URL"),
  gallery: z.array(z.string().url()).max(10).optional(),
  providerName: z.string().trim().max(150).optional(),
  providerWebsite: z.string().url().optional().or(z.literal("")),
  providerLogo: z.string().url().optional().or(z.literal("")),
  ctaText: z.string().trim().max(50).optional(),
  ctaUrl: z.string().url().optional().or(z.literal("")),
  tags: z.array(z.string()).max(20).optional(),
  seoTitle: z.string().trim().max(70, "SEO Title must be 70 characters or less.").optional(),
  metaDescription: z.string().trim().max(160, "Meta Description must be 160 characters or less.").optional(),
  spotsLeft: z.coerce
    .number()
    .min(0)
    .max(100),
  isFeatured: z.boolean().optional().default(false),
});