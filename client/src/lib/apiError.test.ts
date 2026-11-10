import test from "node:test";
import assert from "node:assert/strict";
import { friendlyApiError } from "./apiError";

test("unwraps the status prefix and the JSON message", () => {
  assert.equal(friendlyApiError(new Error('400: {"message":"Registration can\'t close after the session date"}')), "Registration can't close after the session date");
  assert.equal(friendlyApiError(new Error("403: Forbidden")), "Forbidden");
});

test("never shows a SQL statement", () => {
  const sql = '500: {"message":"Failed query: insert into \\"sessions\\" (\\"id\\") values ($1)"}';
  assert.equal(friendlyApiError(new Error(sql)), "Please try again.");
  assert.equal(friendlyApiError(new Error(sql), "Couldn't save"), "Couldn't save");
});

test("falls back for empty or non-error input and caps long text", () => {
  assert.equal(friendlyApiError(undefined), "Please try again.");
  assert.equal(friendlyApiError(new Error("")), "Please try again.");
  assert.ok(friendlyApiError(new Error("x".repeat(500))).length <= 240);
});
