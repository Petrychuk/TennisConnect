// npx tsx --test server/lib/pgErrors.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { isUniqueViolation } from "./pgErrors";

test("unique violation: raw driver error and drizzle's wrapped error (cause)", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  const wrapped = Object.assign(new Error("Failed query: insert into session_rounds"), { cause: { code: "23505" } });
  assert.equal(isUniqueViolation(wrapped), true, "drizzle >= 0.44 keeps the pg code on .cause");
  assert.equal(isUniqueViolation({ cause: { cause: { code: "23505" } } }), true);
});

test("other errors are not unique violations", () => {
  assert.equal(isUniqueViolation(new Error("boom")), false);
  assert.equal(isUniqueViolation({ code: "23503" }), false);
  assert.equal(isUniqueViolation({ cause: { code: "40001" } }), false);
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation(undefined), false);
  assert.equal(isUniqueViolation("23505"), false);
});
