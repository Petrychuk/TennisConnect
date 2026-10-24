// npx tsx --test server/lib/appUrl.test.ts   (part of npm run test:staging-safety)
//
// Links in verification / password-reset emails must point at a known
// TennisConnect site - never at whatever Origin header the caller sent.

import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCTION_SITE, STAGING_SITE, publicAppUrl } from "./appUrl";

const EVIL = "https://evil.example";

test("a forged Origin never reaches the email link", () => {
  for (const dbEnv of ["production", "staging", "development", undefined]) {
    for (const origin of [EVIL, "https://www.tennisconnect.com.au.evil.example", "javascript:alert(1)", "https://user:pw@www.tennisconnect.com.au"]) {
      const url = publicAppUrl({ origin, dbEnv });
      assert.ok(!url.includes("evil") && !url.startsWith("javascript") && !url.includes("@"), `${dbEnv} ${origin} -> ${url}`);
    }
  }
});

test("production: known production origins are kept, anything else -> www site", () => {
  assert.equal(publicAppUrl({ origin: "https://www.tennisconnect.com.au", dbEnv: "production" }), PRODUCTION_SITE);
  assert.equal(publicAppUrl({ origin: "https://tennisconnect.com.au", dbEnv: "production" }), "https://tennisconnect.com.au");
  assert.equal(publicAppUrl({ origin: undefined, dbEnv: "production" }), PRODUCTION_SITE);
  assert.equal(publicAppUrl({ origin: STAGING_SITE, dbEnv: "production" }), PRODUCTION_SITE, "staging link never in a production email");
  assert.equal(publicAppUrl({ origin: "http://localhost:5000", dbEnv: "production" }), PRODUCTION_SITE);
});

test("staging: links point at Staging, not Production (also without an Origin)", () => {
  assert.equal(publicAppUrl({ origin: STAGING_SITE, dbEnv: "staging" }), STAGING_SITE);
  assert.equal(publicAppUrl({ origin: `${STAGING_SITE}/`, dbEnv: "Staging" }), STAGING_SITE);
  assert.equal(publicAppUrl({ origin: undefined, dbEnv: "staging" }), STAGING_SITE);
  assert.equal(publicAppUrl({ origin: PRODUCTION_SITE, dbEnv: "staging" }), STAGING_SITE);
});

test("development keeps localhost origins, otherwise the old default", () => {
  assert.equal(publicAppUrl({ origin: "http://localhost:5000", dbEnv: "development" }), "http://localhost:5000");
  assert.equal(publicAppUrl({ origin: "http://127.0.0.1:3000", dbEnv: undefined }), "http://127.0.0.1:3000");
  assert.equal(publicAppUrl({ origin: undefined, dbEnv: undefined }), PRODUCTION_SITE);
});

test("APP_URL overrides when it is https (or localhost); otherwise ignored", () => {
  assert.equal(publicAppUrl({ origin: EVIL, dbEnv: "staging", configured: "https://preview.tennisconnect.com.au/" }), "https://preview.tennisconnect.com.au");
  assert.equal(publicAppUrl({ origin: undefined, dbEnv: "development", configured: "http://localhost:5173" }), "http://localhost:5173");
  assert.equal(publicAppUrl({ origin: undefined, dbEnv: "staging", configured: "http://insecure.example" }), STAGING_SITE);
  assert.equal(publicAppUrl({ origin: undefined, dbEnv: "production", configured: "not a url" }), PRODUCTION_SITE);
});

test("routes.ts builds every email link through publicAppUrl, never the raw Origin", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const routes = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../routes.ts"), "utf8");
  assert.doesNotMatch(routes, /\$\{req\.headers\.origin/);
  assert.equal((routes.match(/\$\{emailLinkBase\(req\)\}\/(verify-email|reset-password)\?token=/g) ?? []).length, 3);
});
