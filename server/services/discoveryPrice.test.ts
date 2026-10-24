// npx tsx server/services/discoveryPrice.test.ts
//
// Regression for: "Strathfield Saturday Social discovered with $0 instead
// of $20". The wording was "FREE for SSC tennis members. $20 pp applicable
// to non-tennis members each week." - conditional pricing, which must
// never collapse into "free".

import assert from "node:assert/strict";
import { resolvePrice, summariseLabelForCard, priceLabelLines } from "./discoveryPrice";

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

console.log("discoveryPrice.ts");

const STRATHFIELD = "FREE for SSC tennis members. $20 pp applicable to non-tennis members each week.";

// --- the reported bug ---

test("Strathfield: price is $20 (what non-members pay) and BOTH prices are kept in the label", () => {
  const r = resolvePrice(STRATHFIELD);
  assert.equal(r.price, 20);
  assert.equal(r.label, "Free for SSC tennis members · $20 per week for non-members");
  assert.equal(r.review, null);
});

test("Strathfield: the Play card shows '$20 · Free for members'", () => {
  const r = resolvePrice(STRATHFIELD);
  assert.equal(summariseLabelForCard(r.label, r.price), "$20 · Free for members");
});

test("Strathfield: Quick View gets one line per price", () => {
  assert.deepEqual(priceLabelLines(resolvePrice(STRATHFIELD).label), [
    "Free for SSC tennis members",
    "$20 per week for non-members",
  ]);
});

test("if extraction keeps ONLY the member sentence, the result is NOT $0 - the public price is unknown and it goes to review", () => {
  const r = resolvePrice("FREE for SSC tennis members");
  assert.equal(r.price, null);
  assert.equal(r.label, "Free for SSC tennis members");
  assert.ok(r.review);
});

// --- the required regression cases ---

test("source $20 -> 20", () => {
  const r = resolvePrice("$20");
  assert.deepEqual([r.price, r.label, r.review], [20, "$20", null]);
});

test("source $25 -> 25", () => {
  assert.equal(resolvePrice("$25").price, 25);
});

test("source Free -> 0, labelled Free", () => {
  const r = resolvePrice("Free");
  assert.deepEqual([r.price, r.label, r.review], [0, "Free", null]);
});

test("an explicit $0 is free", () => {
  assert.equal(resolvePrice("$0").price, 0);
});

test("'Free entry and afternoon tea provided' is unconditionally free", () => {
  assert.equal(resolvePrice("Free entry and afternoon tea provided.").price, 0);
});

test("price absent -> null, no label, nothing to review", () => {
  for (const missing of [null, undefined, "", "   "]) {
    assert.deepEqual(resolvePrice(missing as any), { price: null, label: null, review: null });
  }
});

test("price wording that can't be parsed -> null, flagged for review", () => {
  const r = resolvePrice("Contact us for pricing");
  assert.equal(r.price, null);
  assert.ok(r.review);
});

// --- member / non-member (the design decision) ---

test("'Members free / Non-members $20' -> price 20, both kept", () => {
  const r = resolvePrice("Members free / Non-members $20");
  assert.equal(r.price, 20);
  assert.equal(r.label, "Free for members · $20 for non-members");
});

test("the same wording with no spaces around the slash is still read as two tiers", () => {
  assert.equal(resolvePrice("Members free/Non-members $20").label, "Free for members · $20 for non-members");
});

test("'Members $15 / Visitors $25' -> price 25 (the public price), both kept", () => {
  const r = resolvePrice("Members $15 / Visitors $25");
  assert.equal(r.price, 25);
  assert.equal(r.label, "$15 for members · $25 for visitors");
});

test("QTC: 'Member Rates: $20/session. Non-Member Rates: $24/session' keeps both, with units", () => {
  const r = resolvePrice("Member Rates: $20/session. Non-Member Rates: $24/session");
  assert.equal(r.price, 24);
  assert.equal(r.label, "$20 per session for members · $24 per session for non-members");
});

test("QTC list form: 'Club Members: $20.00 · Casual Players: $24.00'", () => {
  const r = resolvePrice("Club Members: $20.00 · Casual Players: $24.00");
  assert.equal(r.price, 24);
  assert.equal(r.label, "$20 for members · $24 for casual players");
});

test("a member-only price is preserved but is NOT presented as the public price", () => {
  const r = resolvePrice("Club Members: $20.00");
  assert.equal(r.price, null);
  assert.equal(r.label, "$20 for members");
  assert.ok(r.review);
});

test("card summary puts the price most players pay first, then the member deal", () => {
  assert.equal(summariseLabelForCard("$15 for members · $25 for visitors", 25), "$25 · $15 for members");
  assert.equal(summariseLabelForCard("$20 per session", 20), "$20 per session");
  assert.equal(summariseLabelForCard(null, null), null);
});

// --- conditional / unusual wording is never reduced to a misleading number ---

test("'free' for a promo week is NOT free: null price, the source's words kept, flagged", () => {
  const r = resolvePrice("In the week of 14-18 September, our sessions are FREE.");
  assert.equal(r.price, null);
  assert.ok(r.label && r.label.includes("FREE"));
  assert.ok(r.review);
});

test("'free for kids, $20 adults' isn't reduced to either number", () => {
  const r = resolvePrice("Free for kids, $20 adults");
  assert.equal(r.price, null);
  assert.ok(r.review);
});

test("a range keeps the source's wording and is flagged, not averaged or truncated", () => {
  const r = resolvePrice("$15-$20 per session");
  assert.equal(r.price, null);
  assert.equal(r.label, "$15-$20 per session");
  assert.ok(r.review);
});

test("a non-whole-dollar price keeps its wording and is flagged (the column is whole dollars; $15.50 must not become $16)", () => {
  const r = resolvePrice("$15.50 per session");
  assert.equal(r.price, null);
  assert.equal(r.label, "$15.50 per session");
  assert.ok(r.review);
});

test("a free option next to a paid price isn't resolved silently", () => {
  assert.equal(resolvePrice("Free entry. $10 for equipment hire").price, null);
});

test("thousands separators and units are read: '$1,200 per term'", () => {
  const r = resolvePrice("$1,200 per term");
  assert.equal(r.price, 1200);
  assert.equal(r.label, "$1,200 per term");
});

// --- the invariant ---

test("INVARIANT: no wording without an explicit unconditional free/$0 ever produces price 0", () => {
  const notFree = [
    null, "", "   ", STRATHFIELD, "FREE for SSC tennis members", "Members free / Non-members $20",
    "Members free", "Free for members only", "Free trial then $20", "In the week of 14-18 September, our sessions are FREE.",
    "Free for kids, $20 adults", "Contact us for pricing", "Prices on application", "$20", "$25", "$15.50",
    "Members $15 / Visitors $25", "Member Rates: $20/session. Non-Member Rates: $24/session", "TBC", "See website",
  ];
  for (const t of notFree) {
    assert.notEqual(resolvePrice(t as any).price, 0, `"${t}" must not resolve to 0`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
