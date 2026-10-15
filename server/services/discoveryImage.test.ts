// npx tsx server/services/discoveryImage.test.ts
import assert from "node:assert/strict";
import { extractPageImage, resolveImageUrl } from "./discoveryImage";

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
const PAGE = "https://club.example.com/events/saturday-social/";

test("reads og:image (property before content)", () => {
  const html = `<head><meta property="og:image" content="https://cdn.example.com/a.jpg"></head>`;
  assert.equal(extractPageImage(html, PAGE), "https://cdn.example.com/a.jpg");
});
test("reads og:image (content before property) and decodes &amp;", () => {
  const html = `<meta content="https://cdn.example.com/a.jpg?w=1&amp;h=2" property="og:image" />`;
  assert.equal(extractPageImage(html, PAGE), "https://cdn.example.com/a.jpg?w=1&h=2");
});
test("resolves a relative image against the page URL", () => {
  assert.equal(extractPageImage(`<meta property="og:image" content="/img/court.jpg">`, PAGE), "https://club.example.com/img/court.jpg");
});
test("falls back to twitter:image when og:image is absent", () => {
  assert.equal(extractPageImage(`<meta name="twitter:image" content="https://cdn.example.com/t.png">`, PAGE), "https://cdn.example.com/t.png");
});
test("skips an unusable og:image and uses the next candidate", () => {
  const html = `<meta property="og:image" content="https://x.com/logo.svg"><meta name="twitter:image" content="https://x.com/real.jpg">`;
  assert.equal(extractPageImage(html, PAGE), "https://x.com/real.jpg");
});
test("no image meta -> null (nothing invented)", () => {
  assert.equal(extractPageImage("<html><body><img src='/a.jpg'></body></html>", PAGE), null);
});
test("rejects non-http(s), data:, svg, credentials, favicons", () => {
  for (const bad of ["javascript:alert(1)", "data:image/png;base64,AAAA", "ftp://x.com/a.jpg", "https://x.com/a.svg", "https://u:p@x.com/a.jpg", "https://x.com/favicon.ico", "https://x.com/site-logo.png"]) {
    assert.equal(resolveImageUrl(bad, PAGE), null, bad);
  }
});
test("rejects overlong URLs", () => {
  assert.equal(resolveImageUrl(`https://x.com/${"a".repeat(600)}.jpg`, PAGE), null);
});
test("empty / missing candidates -> null", () => {
  assert.equal(resolveImageUrl("", PAGE), null);
  assert.equal(resolveImageUrl(null, PAGE), null);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
