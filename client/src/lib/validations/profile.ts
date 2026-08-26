import { z } from "zod";

export const playerProfileSchema = z.object({
  // No longer collected/shown anywhere in the UI - kept optional here
  // (not removed outright) so the field can still round-trip safely for
  // any existing profile that already has one on file, without either
  // this form's submit or its own validation ever depending on it again.
  age: z.string().optional(),

  country: z
    .string()
    .min(1, "Country is required"),

  location: z
    .string()
    .trim()
    .min(2, "City is required")
    .max(100, "City is too long"),

  skillLevel: z
    .string()
    .min(1, "Skill level is required"),

  preferredCourts: z
    .string()
    .trim()
    .max(500, "Preferred locations are too long")
    .optional(),

  bio: z
    .string()
    .trim()
    .min(10, "Bio must be at least 10 characters")
    .max(1000, "Bio is too long"),
});

export const coachProfileSchema = z.object({
    location: z
      .string()
      .trim()
      .min(2, "City is required")
      .max(100, "City is too long"),
  
    title: z
      .string()
      .trim()
      .min(2, "Title is required")
      .max(100, "Title is too long"),
  
    bio: z
      .string()
      .trim()
      .min(10, "Bio must be at least 10 characters")
      .max(2000, "Bio is too long"),
  
    experience: z
      .string()
      .max(50, "Experience field is too long")
      .optional(),
  
    rate: z
      .string()
      .max(50, "Rate field is too long")
      .optional(),
  });