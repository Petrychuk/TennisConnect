// npx tsx --test server/lib/publicProfiles.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { toPublicUser, PUBLIC_USER_FIELDS } from "./sanitizeUser";
import {
  PUBLIC_COACH_PROFILE_FIELDS,
  coachContactAccess,
  publicCoachResponse,
  toPublicCoachProfile,
  toPublicMarketplaceItem,
} from "./publicProfiles";

// Full rows, every column (shared/schema.ts users / coach_profiles).
const COACH_USER = {
  id: "coach-1", email: "coach.login@example.invalid", password: "hash", name: "Jordan Coach", role: "coach",
  slug: "jordan-coach", avatar: "a.webp", cover: "c.webp", status: "active", profileCompleted: true,
  isAdmin: false, isOrganizer: true, isApproved: true, isTestUser: false, isHidden: false,
  failedLoginAttempts: 3, lockedUntil: new Date(0), emailVerified: true, emailVerifiedAt: new Date(0), createdAt: new Date(0),
};
const COACH_PROFILE = {
  id: "p-1", userId: "coach-1", title: "Head Coach", country: "AU", isCertified: true, certificationDetails: "TA",
  location: "Bondi", locations: ["Bondi"], latitude: -33.89, longitude: 151.27, bio: "Bio", rating: 4.9, reviews: 2,
  rate: "$80/hr", experience: "10 years", tags: ["Juniors"], photos: [], schedule: {},
  phone: "+61 400 000 000", email: "coach.contact@example.invalid", isDraft: false, createdAt: new Date(0),
};
const viewer = (over: Record<string, unknown> = {}) => ({ id: "viewer-1", isAdmin: false, isApproved: true, isHidden: false, status: "active", ...over });

// Every value a guest must never see, wherever it might be nested.
const PRIVATE_VALUES = [COACH_PROFILE.phone, COACH_PROFILE.email, COACH_USER.email, COACH_USER.password];
const leaks = (body: unknown) => PRIVATE_VALUES.filter((v) => JSON.stringify(body).includes(v));

test("public user = allowlist: no login email, flags, status or lockout counters", () => {
  const out = toPublicUser(COACH_USER);
  assert.deepEqual(Object.keys(out).sort(), [...PUBLIC_USER_FIELDS].sort());
  for (const key of ["email", "password", "isAdmin", "isApproved", "isTestUser", "isHidden", "status", "failedLoginAttempts", "lockedUntil", "emailVerified", "emailVerifiedAt"]) {
    assert.ok(!(key in out), key);
  }
  assert.ok(!("secretColumnAddedLater" in toPublicUser({ ...COACH_USER, secretColumnAddedLater: "x" })), "new columns stay private");
});

test("public coach profile = allowlist: no phone, email, draft flag or coordinates", () => {
  const out = toPublicCoachProfile(COACH_PROFILE);
  assert.deepEqual(Object.keys(out).sort(), [...PUBLIC_COACH_PROFILE_FIELDS].sort());
  for (const key of ["phone", "email", "isDraft", "latitude", "longitude"]) assert.ok(!(key in out), key);
  assert.equal(out.title, "Head Coach");
  assert.equal(out.rate, "$80/hr");
});

test("contact policy: guests never; unapproved, hidden or inactive accounts never; approved, self and admins yes", () => {
  assert.equal(coachContactAccess(null, "coach-1"), "sign-in");
  assert.equal(coachContactAccess(viewer({ isApproved: false }), "coach-1"), "pending-approval");
  assert.equal(coachContactAccess(viewer({ isHidden: true }), "coach-1"), "pending-approval");
  assert.equal(coachContactAccess(viewer({ status: "suspended" }), "coach-1"), "pending-approval");
  assert.equal(coachContactAccess(viewer(), "coach-1"), "granted");
  assert.equal(coachContactAccess(viewer({ status: null }), "coach-1"), "granted");
  assert.equal(coachContactAccess(viewer({ id: "coach-1", isApproved: false }), "coach-1"), "granted", "the coach, even before approval");
  assert.equal(coachContactAccess(viewer({ isAdmin: true, isApproved: false }), "coach-1"), "granted");
});

test("GET /api/coaches/:slug body: contact only for allowed viewers, nowhere else in the body", () => {
  const body = (v: ReturnType<typeof viewer> | null) =>
    publicCoachResponse({ user: COACH_USER, publicUser: toPublicUser(COACH_USER), profile: COACH_PROFILE, viewer: v });

  for (const v of [null, viewer({ isApproved: false })]) {
    const b = body(v);
    assert.equal(b.contact, null);
    assert.deepEqual(leaks(b), [], "no private value anywhere in the body");
  }
  const allowed = body(viewer());
  assert.deepEqual(allowed.contact, { phone: COACH_PROFILE.phone, email: COACH_PROFILE.email });
  assert.equal(allowed.contactAccess, "granted");
  assert.ok(!("phone" in allowed.profile!) && !("email" in allowed.profile!), "still not inside profile");
  assert.ok(!JSON.stringify(allowed).includes(COACH_USER.email), "the login email is never sent");
});

test("public marketplace items drop sellerEmail (the seller's login email)", () => {
  const item = { id: "m1", userId: "coach-1", title: "Racket", price: "50", sellerName: "Jordan", sellerEmail: "coach.login@example.invalid", isActive: true };
  const out = toPublicMarketplaceItem(item);
  assert.ok(!("sellerEmail" in out));
  assert.equal(out.title, "Racket");
});

// ---------- Profile visibility (29 Oct, second pass) ----------

import { coachProfileAccess, isCoachPubliclyVisible } from "./publicProfiles";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const visibleCoach = { id: "coach-1", role: "coach", profileCompleted: true, isApproved: true, isHidden: false, status: "active" };
const publishedProfile = { isDraft: false };

test("visibility: only a completed, approved, visible, active coach with a published profile is public", () => {
  assert.equal(isCoachPubliclyVisible(visibleCoach, publishedProfile), true);
  assert.equal(isCoachPubliclyVisible({ ...visibleCoach, status: null }, publishedProfile), true, "no status = active");
  for (const [why, user, profile] of [
    ["unapproved", { ...visibleCoach, isApproved: false }, publishedProfile],
    ["hidden", { ...visibleCoach, isHidden: true }, publishedProfile],
    ["inactive", { ...visibleCoach, status: "suspended" }, publishedProfile],
    ["not completed", { ...visibleCoach, profileCompleted: false }, publishedProfile],
    ["draft profile", visibleCoach, { isDraft: true }],
    ["no profile", visibleCoach, null],
    ["not a coach", { ...visibleCoach, role: "player" }, publishedProfile],
  ] as const) {
    assert.equal(isCoachPubliclyVisible(user, profile), false, why);
  }
});

test("profile access: a non-public coach is not-found for guests and members, but open to the coach and admins", () => {
  const hidden = { ...visibleCoach, isHidden: true };
  const member = { id: "m-1", isApproved: true, isHidden: false, status: "active" };
  assert.equal(coachProfileAccess(visibleCoach, publishedProfile, null), "public");
  assert.equal(coachProfileAccess(hidden, publishedProfile, null), "not-found");
  assert.equal(coachProfileAccess(hidden, publishedProfile, member), "not-found", "a direct link is no way around it");
  assert.equal(coachProfileAccess(hidden, publishedProfile, { id: "coach-1" }), "owner");
  assert.equal(coachProfileAccess(hidden, publishedProfile, { id: "a-1", isAdmin: true }), "admin");
  assert.equal(
    coachProfileAccess({ ...visibleCoach, profileCompleted: false }, publishedProfile, { id: "a-1", isAdmin: true }),
    "not-found",
    "nothing to show before onboarding, even for admins",
  );
});

test("future 'Only me' preference: members lose access, the coach and admins keep it", () => {
  const member = { id: "m-1", isApproved: true, isHidden: false, status: "active" };
  assert.equal(coachContactAccess(member, "coach-1", "approved-members"), "granted");
  assert.equal(coachContactAccess(member, "coach-1", "only-me"), "private");
  assert.equal(coachContactAccess(null, "coach-1", "only-me"), "private");
  assert.equal(coachContactAccess({ id: "coach-1" }, "coach-1", "only-me"), "granted");
  assert.equal(coachContactAccess({ id: "a-1", isAdmin: true }, "coach-1", "only-me"), "granted");
  assert.equal(coachContactAccess(member, "coach-1"), "granted", "default = approved members");
});

test("the directory query uses the same visibility rule as the profile route", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const storage = readFileSync(path.join(root, "server/storage.ts"), "utf8");
  const body = storage.slice(storage.indexOf("async getAllCoachesWithProfiles()"), storage.indexOf(".orderBy(", storage.indexOf("async getAllCoachesWithProfiles()")));
  for (const condition of [
    'eq(users.role, "coach")',
    "eq(coachProfiles.isDraft, false)",
    "eq(users.profileCompleted, true)",
    "eq(users.isApproved, true)",
    "eq(users.isHidden, false)",
    'or(isNull(users.status), eq(users.status, "active"))',
  ]) {
    assert.ok(body.includes(condition), condition);
  }
});
