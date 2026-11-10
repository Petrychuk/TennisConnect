import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA_DRIFT_MESSAGE, isSchemaDriftError } from "./schemaDrift";

test("a Drizzle 'Failed query' error whose cause is undefined_column is schema drift", () => {
  const driver = Object.assign(new Error('column "rules_text" of relation "sessions" does not exist'), { code: "42703" });
  const wrapped = Object.assign(new Error('Failed query: insert into "sessions" (...) values ($1)'), { cause: driver });
  assert.equal(isSchemaDriftError(wrapped), true);
  assert.equal(isSchemaDriftError(driver), true);
  assert.equal(isSchemaDriftError(Object.assign(new Error("x"), { code: "42P01" })), true);
});

test("other errors are not schema drift", () => {
  assert.equal(isSchemaDriftError(Object.assign(new Error("dup"), { code: "23505" })), false);
  assert.equal(isSchemaDriftError(new Error("boom")), false);
  assert.equal(isSchemaDriftError(null), false);
  assert.equal(isSchemaDriftError(undefined), false);
});

test("the client-facing message carries no SQL", () => {
  assert.doesNotMatch(SCHEMA_DRIFT_MESSAGE, /insert|select|\$1|"sessions"/i);
});
