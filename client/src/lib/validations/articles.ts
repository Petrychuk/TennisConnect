import { z } from "zod";

export const articleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(150, "Title is too long"),

  slug: z
    .string()
    .trim()
    .min(3, "Slug is required")
    .max(200, "Slug is too long"),

  category: z
    .string()
    .min(1, "Category is required"),

  author: z
    .string()
    .trim()
    .min(2, "Author is required")
    .max(100, "Author name is too long"),

  excerpt: z
    .string()
    .trim()
    .min(20, "Excerpt is too short")
    .max(500, "Excerpt is too long"),

  content: z
    .string()
    .trim()
    .min(50, "Content is too short")
    .max(50000, "Content is too long"),

  coverImage: z
    .string()
    .url("Invalid image URL"),

  readTime: z.coerce
    .number()
    .min(1)
    .max(120),

  seoTitle: z
    .string()
    .trim()
    .max(70, "SEO Title must be 70 characters or less.")
    .optional(),

  metaDescription: z
    .string()
    .trim()
    .max(160, "Meta Description must be 160 characters or less.")
    .optional(),

  tags: z
    .string()
    .max(500)
    .optional(),
});