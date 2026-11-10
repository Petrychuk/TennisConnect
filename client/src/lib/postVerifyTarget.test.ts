// npm run test:ui
//
// Where a person lands after email verification / sign-in (ORG-ONB-001, -008,
// -012): their own profile, never /organiser by default, and a returnTo is only
// followed when it stays on this site.

import assert from "node:assert/strict";
import test from "node:test";
import { postVerifyTarget, profilePathFor, resolveReturnTarget, safeReturnPath } from "./postVerifyTarget";

test("profilePathFor builds the signed-in person's own route from their account", () => {
  assert.equal(profilePathFor({ role: "player", slug: "sam-lee" }), "/player/sam-lee");
  assert.equal(profilePathFor({ role: "coach", slug: "ana-k" }), "/coach/ana-k");
  assert.equal(profilePathFor({ role: "player", slug: "" }), "/");
  assert.equal(profilePathFor(null), "/");
  assert.equal(profilePathFor({ role: null, slug: "sam-lee" }), "/");
  assert.equal(profilePathFor({ role: "", slug: "sam-lee" }), "/");
  assert.equal(profilePathFor({ role: "player", slug: null }), "/");
});

test("after verification: own profile once the profile is complete, /complete-profile before", () => {
  assert.equal(postVerifyTarget({ role: "player", slug: "sam-lee", profileCompleted: true }, null), "/player/sam-lee");
  assert.equal(postVerifyTarget({ role: "player", slug: "sam-lee", profileCompleted: false }, null), "/complete-profile");
});

test("after verification: never /organiser unless a returnTo asked for it", () => {
  for (const user of [
    { role: "player", slug: "a", profileCompleted: true },
    { role: "coach", slug: "b", profileCompleted: false },
  ]) {
    assert.doesNotMatch(postVerifyTarget(user, null), /^\/organiser/);
    assert.doesNotMatch(postVerifyTarget(user, {}), /^\/organiser/);
  }
  // A guest who opened /organiser, registered and verified comes back to it;
  // the Hub's own gate then decides what they see.
  assert.equal(postVerifyTarget({ role: "player", slug: "a", profileCompleted: true }, { returnTo: "/organiser" }), "/organiser");
});

test("a stashed returnTo and joinSession are followed", () => {
  const user = { role: "player", slug: "a", profileCompleted: false };
  assert.equal(postVerifyTarget(user, { returnTo: "/play/s-1", joinSession: "s-1" }), "/play/s-1?joinSession=s-1");
  assert.equal(resolveReturnTarget({ returnTo: "/play?x=1", joinSession: "abc" }), "/play?x=1&joinSession=abc");
  assert.equal(resolveReturnTarget({ returnTo: "/organiser/sessions" }), "/organiser/sessions");
});

test("returnTo must stay on this site", () => {
  const refused = [
    "https://evil.example/x",
    "http://evil.example",
    "//evil.example/x",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "organiser",
    "",
    " ",
    "/ok\nHeader: x",
    "/ok\u0000",
  ];
  for (const value of refused) assert.equal(safeReturnPath(value), null, JSON.stringify(value));
  assert.equal(safeReturnPath(undefined), null);
  assert.equal(safeReturnPath(null), null);
  assert.equal(safeReturnPath("/organiser/sessions?tab=live"), "/organiser/sessions?tab=live");
  assert.equal(safeReturnPath("  /play  "), "/play");
});

test("an unsafe returnTo is ignored, not repaired", () => {
  const user = { role: "player", slug: "sam-lee", profileCompleted: true };
  assert.equal(postVerifyTarget(user, { returnTo: "https://evil.example/x" }), "/player/sam-lee");
  assert.equal(postVerifyTarget(user, { returnTo: "//evil.example", joinSession: "s" }), "/player/sam-lee");
  assert.equal(resolveReturnTarget({ returnTo: "https://evil.example", joinSession: "s" }), null);
});

test("postVerifyTarget handles role: null explicitly, without throwing or inventing a route", () => {
  assert.equal(postVerifyTarget({ role: null, slug: "a", profileCompleted: true }, null), "/");
  assert.equal(postVerifyTarget({ role: null, slug: "a", profileCompleted: false }, null), "/complete-profile");
  assert.equal(postVerifyTarget({ role: null, profileCompleted: true }, { returnTo: "/play/s-1" }), "/play/s-1");
});
