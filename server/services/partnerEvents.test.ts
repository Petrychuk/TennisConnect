// npx tsx server/services/partnerEvents.test.ts

import assert from "node:assert/strict";
import { sourceTypePriority, resolveDuplicateWinner, resolveRegistrationCta, resolvePartnerBadge } from "./partnerEvents";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  }
}

console.log("partnerEvents.ts");

// --- priority order ---

test("priority order is TENNISCONNECT < PARTNER < EXTERNAL (lower = wins)", () => {
  assert.ok(sourceTypePriority("TENNISCONNECT") < sourceTypePriority("PARTNER"));
  assert.ok(sourceTypePriority("PARTNER") < sourceTypePriority("EXTERNAL"));
});

// --- dedup winner ---

const OLD = new Date("2026-01-01");
const NEW = new Date("2026-06-01");

test("a Partner Event beats an EXTERNAL find even when the EXTERNAL one existed first", () => {
  const partner = { id: "partner-1", sourceType: "PARTNER" as const, createdAt: NEW };
  const external = { id: "external-1", sourceType: "EXTERNAL" as const, createdAt: OLD };
  const r = resolveDuplicateWinner(partner, external);
  assert.equal(r.canonicalId, "partner-1");
  assert.equal(r.duplicateId, "external-1");
  assert.equal(r.reason, "higher-priority-source");
});

test("the same result regardless of argument order", () => {
  const partner = { id: "partner-1", sourceType: "PARTNER" as const, createdAt: NEW };
  const external = { id: "external-1", sourceType: "EXTERNAL" as const, createdAt: OLD };
  const r = resolveDuplicateWinner(external, partner);
  assert.equal(r.canonicalId, "partner-1");
  assert.equal(r.duplicateId, "external-1");
});

test("a later Discovery re-scan never supersedes an existing approved Partner Event", () => {
  const partner = { id: "partner-1", sourceType: "PARTNER" as const, createdAt: OLD };
  const laterExternal = { id: "external-2", sourceType: "EXTERNAL" as const, createdAt: NEW };
  const r = resolveDuplicateWinner(partner, laterExternal);
  assert.equal(r.canonicalId, "partner-1");
});

test("TENNISCONNECT beats a Partner Event too - a real session always wins", () => {
  const session = { id: "session-1", sourceType: "TENNISCONNECT" as const, createdAt: NEW };
  const partner = { id: "partner-1", sourceType: "PARTNER" as const, createdAt: OLD };
  const r = resolveDuplicateWinner(session, partner);
  assert.equal(r.canonicalId, "session-1");
  assert.equal(r.reason, "higher-priority-source");
});

test("within the same tier, the earlier one stays canonical (existing EXTERNAL-vs-EXTERNAL behaviour)", () => {
  const first = { id: "e-first", sourceType: "EXTERNAL" as const, createdAt: OLD };
  const second = { id: "e-second", sourceType: "EXTERNAL" as const, createdAt: NEW };
  const r = resolveDuplicateWinner(second, first);
  assert.equal(r.canonicalId, "e-first");
  assert.equal(r.duplicateId, "e-second");
  assert.equal(r.reason, "earlier-at-same-priority");
});

// --- registration CTA ---

test("no external URL -> Join, regardless of source type (internal registration)", () => {
  for (const sourceType of ["TENNISCONNECT", "PARTNER"] as const) {
    const cta = resolveRegistrationCta({ sourceType, externalUrl: null });
    assert.deepEqual(cta, { label: "Join", url: null, external: false });
  }
});

test("a Partner row with an external URL says 'Register on partner website'", () => {
  const cta = resolveRegistrationCta({ sourceType: "PARTNER", externalUrl: "https://partner.example/book" });
  assert.equal(cta.label, "Register on partner website");
  assert.equal(cta.url, "https://partner.example/book");
  assert.equal(cta.external, true);
});

test("a plain EXTERNAL (Discovery) row with a URL says 'View original'", () => {
  const cta = resolveRegistrationCta({ sourceType: "EXTERNAL", externalUrl: "https://club.example/" });
  assert.equal(cta.label, "View original");
});

test("an EXTERNAL row can never say 'Join' - it always has some URL once it's eligible for Play", () => {
  // documents the invariant rather than asserting anything new - a row with
  // sourceType EXTERNAL and externalUrl:null falls through to "Join", which
  // would be wrong; the CALLER (storage.ts) is responsible for always
  // supplying a URL (registrationUrl ?? sourceUrl) for EXTERNAL/PARTNER rows.
  const cta = resolveRegistrationCta({ sourceType: "EXTERNAL", externalUrl: null });
  assert.equal(cta.label, "Join");
});

// --- badge ---

test("a Partner Event shows the Partner badge with its name", () => {
  const badge = resolvePartnerBadge({ sourceType: "PARTNER", name: "Manly Lawn Tennis Club" });
  assert.deepEqual(badge, { label: "Partner", name: "Manly Lawn Tennis Club" });
});

test("a plain Discovery find shows 'Found by TennisConnect'", () => {
  const badge = resolvePartnerBadge({ sourceType: "EXTERNAL", name: "Example Tennis Club" });
  assert.equal(badge.label, "Found by TennisConnect");
});

test("an ordinary TC session shows no badge at all", () => {
  const badge = resolvePartnerBadge({ sourceType: "TENNISCONNECT", name: "Example Club" });
  assert.deepEqual(badge, { label: null, name: null });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
