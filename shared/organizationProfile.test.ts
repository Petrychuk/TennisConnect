import assert from "node:assert/strict";
import test from "node:test";
import { normaliseWebsite, organizationProfileSchema, organizationProfileUpdateSchema } from "./organizationProfile";

test("an organiser can't set verified, listingType, status, slug or ownerId (unknown keys are dropped)", () => {
  const parsed = organizationProfileUpdateSchema.parse({
    name: "Lyne Park Tennis",
    verified: true,
    listingType: "premium",
    status: "published",
    slug: "taken",
    ownerId: "someone-else",
    logo: "https://x.example/logo.png",
  });
  assert.deepEqual(parsed, { name: "Lyne Park Tennis" });
});

test("cleared fields become null; untouched fields stay absent", () => {
  const parsed = organizationProfileUpdateSchema.parse({ website: "  ", phone: "", email: null });
  assert.deepEqual(parsed, { website: null, phone: null, email: null });
  assert.deepEqual(organizationProfileUpdateSchema.parse({}), {});
});

test("website: scheme is added, only http(s) with a real host is accepted", () => {
  assert.equal(normaliseWebsite("lyneparktennis.com.au"), "https://lyneparktennis.com.au");
  assert.equal(organizationProfileUpdateSchema.parse({ website: "lyneparktennis.com.au" }).website, "https://lyneparktennis.com.au");
  assert.equal(organizationProfileUpdateSchema.parse({ website: "http://club.example/path" }).website, "http://club.example/path");
  for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://club.example", "https://localhost", "not a url"]) {
    assert.equal(organizationProfileUpdateSchema.safeParse({ website: bad }).success, false, bad);
  }
});

test("name, email and phone validation", () => {
  assert.equal(organizationProfileSchema.safeParse({}).success, false, "name is required on create");
  assert.equal(organizationProfileSchema.safeParse({ name: " a " }).success, false);
  assert.equal(organizationProfileSchema.parse({ name: "  Club  " }).name, "Club");
  assert.equal(organizationProfileUpdateSchema.safeParse({ email: "nope" }).success, false);
  assert.equal(organizationProfileUpdateSchema.parse({ email: "hi@club.example" }).email, "hi@club.example");
  assert.equal(organizationProfileUpdateSchema.parse({ phone: "+61 (2) 9000-1234" }).phone, "+61 (2) 9000-1234");
  assert.equal(organizationProfileUpdateSchema.safeParse({ phone: "call me" }).success, false);
  assert.equal(organizationProfileUpdateSchema.safeParse({ description: "x".repeat(2001) }).success, false);
});
