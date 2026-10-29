import { z } from "zod";

/*
  Body of PUT /api/me/coach-profile (coach-profile.tsx "Save").

  The page sends back the whole profile it loaded, so every optional
  column a coach hasn't filled in yet arrives as null (or "" for the
  e-mail field's form default). The schema used to accept only strings
  or a missing key there, so a newly onboarded coach - no bio, phone,
  e-mail or certification details yet - could not save any edit at all:
  400 "Invalid input" (PROFILE-004 / PROFILE-012, 28 Oct Staging run).

  - Nullable columns: null or "" means "empty" and is stored as null.
  - title / location are NOT NULL columns: null means "not sent" (left
    as is); an empty string is still rejected.
  - rating / reviews are deliberately not accepted - earned, never
    self-reported. Unknown keys (name, rating, ...) are stripped; the
    route updates `name` separately.
*/

const emptyToNull = (value: unknown) => (value === "" ? null : value);
const nullToUndefined = (value: unknown) => (value === null ? undefined : value);

const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());
const requiredTextIfSent = (max: number) => z.preprocess(nullToUndefined, z.string().trim().min(1).max(max).optional());
const optionalList = z.preprocess(nullToUndefined, z.array(z.string()).optional());

export const coachProfileUpdateSchema = z.object({
  country: optionalText(100),
  isCertified: z.preprocess(nullToUndefined, z.boolean().optional()),
  certificationDetails: optionalText(200),
  title: requiredTextIfSent(100),
  location: requiredTextIfSent(100),
  bio: optionalText(2000),
  tags: optionalList,
  photos: optionalList,
  rate: optionalText(50),
  experience: optionalText(50),
  phone: optionalText(30),
  email: z.preprocess(emptyToNull, z.string().trim().email().max(200).nullable().optional()),
  locations: optionalList,
  schedule: z.any().optional(),
});

export type CoachProfileUpdate = z.infer<typeof coachProfileUpdateSchema>;
