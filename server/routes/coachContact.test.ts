// npx tsx --test server/routes/coachContact.test.ts
//
// GET /api/coaches/:slug and GET /api/coaches through the REAL router on a
// loopback server. `storage` is faked (no Postgres) and sign-in is stubbed
// by a test-only middleware that sets req.user / req.isAuthenticated from an
// `x-test-viewer` header - what a Passport session has already done by the
// time the route runs.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";

const PHONE = "+61 400 111 222";
const CONTACT_EMAIL = "coach.contact@example.invalid";
const LOGIN_EMAIL = "coach.login@example.invalid";

const COACH = {
  id: "coach-1", email: LOGIN_EMAIL, password: "hash", name: "Jordan Coach", role: "coach", slug: "jordan-coach",
  avatar: null, cover: null, status: "active", profileCompleted: true, isAdmin: false, isOrganizer: false,
  isApproved: true, isTestUser: false, isHidden: false, failedLoginAttempts: 2, lockedUntil: null,
  emailVerified: true, emailVerifiedAt: null, createdAt: "2026-01-01T00:00:00.000Z",
};
const PROFILE = {
  id: "p-1", userId: "coach-1", title: "Head Coach", country: "AU", isCertified: false, certificationDetails: null,
  location: "Bondi", locations: ["Bondi"], latitude: -33.9, longitude: 151.3, bio: "Bio", rating: null, reviews: 0,
  rate: "$80/hr", experience: "5 years", tags: [], photos: [], schedule: null, phone: PHONE, email: CONTACT_EMAIL,
  isDraft: false, createdAt: "2026-01-01T00:00:00.000Z",
};
// Not publicly visible, each for one reason. Same contact data as COACH.
const variant = (slug: string, over: Record<string, unknown>) => ({ ...COACH, id: `id-${slug}`, slug, ...over });
const NOT_PUBLIC = {
  unapproved: variant("unapproved-coach", { isApproved: false }),
  hidden: variant("hidden-coach", { isHidden: true }),
  inactive: variant("inactive-coach", { status: "suspended" }),
  draft: variant("draft-coach", {}),
  incomplete: variant("incomplete-coach", { profileCompleted: false }),
};
const COACHES_BY_SLUG: Record<string, typeof COACH> = {
  [COACH.slug]: COACH,
  ...Object.fromEntries(Object.values(NOT_PUBLIC).map((c) => [c.slug, c])),
};
const profileFor = (id: string) => {
  if (id === NOT_PUBLIC.draft.id) return { ...PROFILE, userId: id, isDraft: true };
  return Object.values(COACHES_BY_SLUG).some((c) => c.id === id) ? { ...PROFILE, userId: id } : undefined;
};

const VIEWERS: Record<string, object> = {
  approved: { id: "player-1", role: "player", isAdmin: false, isApproved: true, isHidden: false, status: "active" },
  unapproved: { id: "player-2", role: "player", isAdmin: false, isApproved: false, isHidden: false, status: "active" },
  admin: { id: "admin-1", role: "player", isAdmin: true, isApproved: true, isHidden: false, status: "active" },
  self: { ...COACH },
};

let server: http.Server;
let base = "";
let restore = () => {};

before(async () => {
  const { storage } = await import("../storage");
  const s = storage as any;
  const originals = { getUserBySlug: s.getUserBySlug, getCoachProfile: s.getCoachProfile, getAllCoachesWithProfiles: s.getAllCoachesWithProfiles };
  s.getUserBySlug = async (slug: string) => COACHES_BY_SLUG[slug];
  s.getCoachProfile = async (id: string) => profileFor(id);
  s.getAllCoachesWithProfiles = async () => [{ user: COACH, profile: PROFILE }];
  restore = () => Object.assign(s, originals);
  const { default: router } = await import("./coaches");
  const app = express();
  app.use((req: any, _res: any, next: any) => {
    const who = req.headers["x-test-viewer"];
    const user = typeof who === "string" ? VIEWERS[who] : undefined;
    req.user = user;
    req.isAuthenticated = () => !!user;
    next();
  });
  app.use("/api/coaches", router);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  restore();
  server?.close();
});

async function get(path: string, viewer?: string) {
  const res = await fetch(`${base}${path}`, { headers: viewer ? { "x-test-viewer": viewer } : {} });
  return { res, text: await res.text() };
}

test("guest: public fields only - no phone, contact email or login email anywhere in the body", async () => {
  const { res, text } = await get("/api/coaches/jordan-coach");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  for (const value of [PHONE, CONTACT_EMAIL, LOGIN_EMAIL, "hash"]) assert.ok(!text.includes(value), `leaked ${value}`);
  const body = JSON.parse(text);
  assert.equal(body.contact, null);
  assert.equal(body.contactAccess, "sign-in");
  assert.ok(!("failedLoginAttempts" in body.user) && !("lockedUntil" in body.user) && !("isApproved" in body.user));
  // Still renders: the fields the page uses are there.
  assert.equal(body.user.name, "Jordan Coach");
  assert.equal(body.user.slug, "jordan-coach");
  assert.equal(body.profile.title, "Head Coach");
  assert.equal(body.profile.rate, "$80/hr");
});

test("signed in but not approved: still no contact details", async () => {
  const { text } = await get("/api/coaches/jordan-coach", "unapproved");
  const body = JSON.parse(text);
  assert.equal(body.contact, null);
  assert.equal(body.contactAccess, "pending-approval");
  assert.ok(!text.includes(PHONE) && !text.includes(CONTACT_EMAIL));
});

test("approved account, admin and the coach themselves get the contact details (never the login email)", async () => {
  for (const who of ["approved", "admin", "self"]) {
    const { text } = await get("/api/coaches/jordan-coach", who);
    const body = JSON.parse(text);
    assert.deepEqual(body.contact, { phone: PHONE, email: CONTACT_EMAIL }, who);
    assert.equal(body.contactAccess, "granted", who);
    assert.ok(!("phone" in body.profile) && !("email" in body.profile), `${who}: not inside profile`);
    assert.ok(!text.includes(LOGIN_EMAIL), `${who}: login email`);
  }
});

test("directory list never carries contact details", async () => {
  for (const who of [undefined, "approved"]) {
    const { res, text } = await get("/api/coaches?page=1&limit=16", who);
    assert.equal(res.status, 200);
    for (const value of [PHONE, CONTACT_EMAIL, LOGIN_EMAIL]) assert.ok(!text.includes(value), `${who ?? "guest"} leaked ${value}`);
    const body = JSON.parse(text);
    assert.equal(body.coaches.length, 1);
    for (const key of ["phone", "email"]) assert.ok(!(key in body.coaches[0]), key);
  }
});

test("a coach who is not public is a 404 for guests and approved members - same body, no data", async () => {
  for (const [why, coach] of Object.entries(NOT_PUBLIC)) {
    for (const viewer of [undefined, "approved"]) {
      const { res, text } = await get(`/api/coaches/${coach.slug}`, viewer);
      assert.equal(res.status, 404, `${why} / ${viewer ?? "guest"}`);
      assert.deepEqual(JSON.parse(text), { message: "Coach not found" }, why);
      assert.equal(res.headers.get("cache-control"), "private, no-store");
    }
  }
  assert.equal((await get("/api/coaches/no-such-coach")).res.status, 404);
});

test("the coach and admins can still open a hidden or unapproved profile (approval and editing keep working)", async () => {
  VIEWERS.hiddenSelf = { ...NOT_PUBLIC.hidden };
  VIEWERS.unapprovedSelf = { ...NOT_PUBLIC.unapproved };
  for (const [slug, who] of [
    [NOT_PUBLIC.hidden.slug, "hiddenSelf"],
    [NOT_PUBLIC.unapproved.slug, "unapprovedSelf"],
    [NOT_PUBLIC.hidden.slug, "admin"],
    [NOT_PUBLIC.inactive.slug, "admin"],
  ]) {
    const { res, text } = await get(`/api/coaches/${slug}`, who);
    assert.equal(res.status, 200, `${who} -> ${slug}`);
    const body = JSON.parse(text);
    assert.equal(body.contactAccess, "granted", `${who} -> ${slug}`);
    assert.ok(!text.includes(LOGIN_EMAIL), "never the login email");
  }
  // An unrelated coach does not count as the owner.
  assert.equal((await get(`/api/coaches/${NOT_PUBLIC.hidden.slug}`, "self")).res.status, 404);
  // Nothing to show before onboarding, even for admins.
  assert.equal((await get(`/api/coaches/${NOT_PUBLIC.incomplete.slug}`, "admin")).res.status, 404);
});
