// npx tsx server/services/partnerImport.test.ts

import assert from "node:assert/strict";
import { findExactUrlDuplicate, decideStubReason } from "./partnerImport";

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

console.log("partnerImport.ts");

const CANDIDATES = [
  { id: "a", title: "Saturday Social", sourceUrl: "https://club.example/events/social" },
  { id: "b", title: "Sunday Round Robin", sourceUrl: "https://other.example/round-robin" },
];

test("an exact sourceUrl match is found", () => {
  const found = findExactUrlDuplicate("https://club.example/events/social", CANDIDATES);
  assert.equal(found?.id, "a");
});

test("a trailing slash difference still counts as the same URL", () => {
  const found = findExactUrlDuplicate("https://club.example/events/social/", CANDIDATES);
  assert.equal(found?.id, "a");
});

test("no match returns null, not the wrong row", () => {
  assert.equal(findExactUrlDuplicate("https://club.example/events/different", CANDIDATES), null);
});

test("an empty candidate list never matches", () => {
  assert.equal(findExactUrlDuplicate("https://club.example/events/social", []), null);
});

test("stub reason mentions the fetch failure when the page couldn't be read at all", () => {
  const reason = decideStubReason({ fetchFailed: true, fetchError: "HTTP 404" });
  assert.ok(reason.includes("HTTP 404"));
  assert.ok(reason.toLowerCase().includes("url"));
});

test("stub reason is generic (no fetch error mentioned) when the page WAS read but had nothing extractable", () => {
  const reason = decideStubReason({ fetchFailed: false });
  assert.equal(reason.includes("undefined"), false);
  assert.ok(reason.toLowerCase().includes("extracted"));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
