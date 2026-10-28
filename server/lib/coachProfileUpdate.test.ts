import { test } from "node:test";
import assert from "node:assert/strict";
import { coachProfileUpdateSchema } from "./coachProfileUpdate";

// What coach-profile.tsx sends for a coach who has just finished onboarding:
// the loaded profile, with the optional fields they haven't filled in as null
// and the e-mail form default "".
const freshCoachSave = {
  name: "Coach 1793",
  title: "The best price from best coach in Sydney",
  location: "Wolli Creek",
  country: "Australia",
  isCertified: false,
  certificationDetails: null,
  bio: "Experienced coach",
  tags: [],
  photos: null,
  rate: "70",
  experience: null,
  phone: null,
  email: "",
  locations: null,
  schedule: null,
  rating: 4.9,
  reviews: 0,
  response_time: "1h",
};

test("a newly onboarded coach can save (nulls and an empty e-mail are accepted)", () => {
  const parsed = coachProfileUpdateSchema.safeParse(freshCoachSave);
  assert.ok(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues));
  const data = parsed.data as Record<string, unknown>;
  assert.equal(data.email, null);
  assert.equal(data.phone, null);
  assert.equal(data.certificationDetails, null);
  assert.equal(data.photos, undefined, "null list = not sent");
});

test("rating, reviews and unknown keys never reach the update", () => {
  const parsed = coachProfileUpdateSchema.parse(freshCoachSave) as Record<string, unknown>;
  for (const key of ["rating", "reviews", "name", "response_time"]) assert.ok(!(key in parsed), key);
});

test("title and location: null means not sent, empty is still rejected", () => {
  const parsed = coachProfileUpdateSchema.parse({ title: null, location: null }) as Record<string, unknown>;
  assert.equal(parsed.title, undefined);
  assert.equal(parsed.location, undefined);
  assert.equal(coachProfileUpdateSchema.safeParse({ title: "" }).success, false);
  assert.equal(coachProfileUpdateSchema.safeParse({ location: "   " }).success, false);
});

test("a real e-mail is still validated and limits still apply", () => {
  assert.equal(coachProfileUpdateSchema.safeParse({ email: "not-an-email" }).success, false);
  assert.equal(coachProfileUpdateSchema.parse({ email: "coach@example.com" }).email, "coach@example.com");
  assert.equal(coachProfileUpdateSchema.safeParse({ phone: "1".repeat(31) }).success, false);
  assert.equal(coachProfileUpdateSchema.safeParse({ bio: "x".repeat(2001) }).success, false);
});
