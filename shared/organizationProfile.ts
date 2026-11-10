/*
  What an organiser may set on their own organisation (Organiser Hub,
  Phase 2 Batch 2 - "Your Organisation" page).

  POST /api/organizer/organizations and PUT /api/organizer/organizations/:id
  used to validate with insertOrganizationSchema, which still contains
  `verified` and `listingType` - an organiser could mark their own
  organisation verified or premium. Only the profile fields below are
  accepted now; unknown keys are dropped (zod's default .strip()).

  Not here on purpose:
  - logo / cover: there is no organisation image upload endpoint and
    neither is shown anywhere yet (KNOWN_LIMITATIONS.md). Stored values
    are left untouched.
  - slug, ownerId, status, verified, listingType: set by the server / admins.

  Pure (zod only) - unit-tested in ./organizationProfile.test.ts.
*/
import { z } from "zod";

export const ORGANIZATION_PROFILE_LIMITS = {
  name: 120,
  description: 2000,
  website: 300,
  email: 254,
  phone: 40,
} as const;

/** "" / whitespace -> null, so a cleared field really clears the column. */
const optionalText = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return value;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }, inner.nullable().optional());

/** Adds https:// to "example.com" - organisers rarely type the scheme. */
export function normaliseWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// Rendered as <a href> on the public page, so only http(s) is accepted -
// never javascript:, data: and the like.
const website = z
  .string()
  .max(ORGANIZATION_PROFILE_LIMITS.website, "Website is too long")
  .transform(normaliseWebsite)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Enter a website address like https://yourclub.com.au");

const phone = z
  .string()
  .max(ORGANIZATION_PROFILE_LIMITS.phone, "Phone number is too long")
  .regex(/^\+?[0-9 ()-]{6,}$/, "Use digits, spaces, brackets, dashes and an optional leading +");

export const organizationProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(ORGANIZATION_PROFILE_LIMITS.name, "Name is too long"),
  description: optionalText(z.string().max(ORGANIZATION_PROFILE_LIMITS.description, "Description is too long")),
  website: optionalText(website),
  email: optionalText(z.string().max(ORGANIZATION_PROFILE_LIMITS.email).email("Enter a valid email address")),
  phone: optionalText(phone),
});

/** For PUT: any subset of the fields. */
export const organizationProfileUpdateSchema = organizationProfileSchema.partial();

export type OrganizationProfile = z.infer<typeof organizationProfileSchema>;
