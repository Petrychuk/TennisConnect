import { test } from "node:test";
import assert from "node:assert/strict";
import { staticCacheControl } from "./staticCache";

const DIST = "/app/dist/public";

test("index.html is always revalidated", () => {
  assert.equal(staticCacheControl(`${DIST}/index.html`), "no-cache");
});

test("hashed Vite chunks are immutable for a year", () => {
  for (const f of ["coaches-B4x9QzL1.js", "index-Dk3vR2pA.css", "inter-latin-400-normal-CqXyZ12a.woff2"]) {
    assert.equal(staticCacheControl(`${DIST}/assets/${f}`), "public, max-age=31536000, immutable", f);
  }
});

test("public images keep their name when replaced, so they get a day plus background revalidation", () => {
  for (const f of ["images/dashboard_coach-1280.webp", "images/travels-hero-cote-dazur-mobile.webp", "images/tennis_main.jpg"]) {
    assert.equal(staticCacheControl(`${DIST}/assets/${f}`), "public, max-age=86400, stale-while-revalidate=604800", f);
  }
  assert.equal(staticCacheControl(`${DIST}/favicon.png`), "public, max-age=86400, stale-while-revalidate=604800");
});

test("a hyphenated public file in /assets/images is not mistaken for a hashed chunk", () => {
  // "images/" is a sub-folder, so only files directly in /assets/ can be hashed chunks.
  assert.notEqual(staticCacheControl(`${DIST}/assets/images/Dashboard_club-mobile.webp`), "public, max-age=31536000, immutable");
});
