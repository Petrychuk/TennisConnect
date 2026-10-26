// npx tsx --test client/src/lib/zodFormErrors.test.ts   (part of npm run test:form-validation)
//
// Regression for REG-003 / REG-004: with Zod 4, @hookform/resolvers 3.x
// re-threw validation failures (it looked for ZodError.errors, which Zod 4
// removed), so the registration form blocked submission but showed no
// message. The app's real schemas must produce the real field messages.

import assert from "node:assert/strict";
import test from "node:test";
import { loginSchema, registerSchema, resetPasswordSchema } from "./validations/auth";
import { zodIssuesToFieldErrors, type ZodIssueLike } from "./zodFormErrors";

const validRegistration = {
  role: "player",
  name: "Tester",
  email: "reg@tennisconnect.test",
  password: "Test123456!",
  confirmPassword: "Test123456!",
  agreeToTerms: true,
  wantsToOrganize: false,
};

function messagesFor(schema: { safeParse(data: unknown): { success: boolean; error?: { issues: readonly ZodIssueLike[] } } }, data: unknown) {
  const result = schema.safeParse(data);
  assert.equal(result.success, false, "the input must be rejected");
  return Object.fromEntries(Object.entries(zodIssuesToFieldErrors(result.error!.issues)).map(([path, error]) => [path, error.message]));
}

test("Zod 4 failures carry .issues, not .errors (why the 3.x resolver broke)", () => {
  const result = registerSchema.safeParse({ ...validRegistration, email: "not-an-email" });
  assert.equal(result.success, false);
  assert.ok(Array.isArray(result.error?.issues) && result.error.issues.length > 0);
  assert.equal(Array.isArray((result.error as unknown as { errors?: unknown }).errors), false);
});

test("REG-003: an invalid email gives the email field its message - and nothing else", () => {
  assert.deepEqual(messagesFor(registerSchema, { ...validRegistration, email: "not-an-email" }), {
    email: "Please enter a valid email address",
  });
});

test("REG-004: a password under 8 characters gives the password field its message", () => {
  assert.deepEqual(messagesFor(registerSchema, { ...validRegistration, password: "short1", confirmPassword: "short1" }), {
    password: "Password must be at least 8 characters",
  });
  // 8 characters is enough.
  assert.equal(registerSchema.safeParse({ ...validRegistration, password: "Abcdef1!", confirmPassword: "Abcdef1!" }).success, true);
});

test("cross-field and checkbox rules land on the right field", () => {
  assert.deepEqual(messagesFor(registerSchema, { ...validRegistration, confirmPassword: "Different1!", agreeToTerms: false }), {
    agreeToTerms: "You must accept the Terms of Service and Privacy Policy",
    confirmPassword: "Passwords do not match",
  });
});

test("every invalid field is reported at once; the first message per field wins", () => {
  const errors = messagesFor(registerSchema, { ...validRegistration, name: "", email: "x", password: "1", confirmPassword: "1" });
  assert.deepEqual(Object.keys(errors).sort(), ["email", "name", "password"]);
  assert.equal(errors.name, "Name must be at least 2 characters");
});

test("login and reset-password schemas map the same way", () => {
  assert.deepEqual(messagesFor(loginSchema, { email: "bad", password: "12345" }), {
    email: "Please enter a valid email address",
    password: "Password must be at least 6 characters",
  });
  assert.deepEqual(messagesFor(resetPasswordSchema, { password: "Abcdefgh1", confirmPassword: "nope" }), {
    confirmPassword: "Passwords do not match",
  });
});

test("criteriaMode 'all' keeps every message per code; nested and union paths", () => {
  const issues: ZodIssueLike[] = [
    { code: "too_small", message: "too short", path: ["password"] },
    { code: "invalid_format", message: "needs a digit", path: ["password"] },
    { code: "invalid_format", message: "needs a symbol", path: ["password"] },
    { code: "invalid_type", message: "required", path: ["address", "city"] },
    { code: "invalid_union", message: "Invalid input", path: ["contact"], errors: [[{ code: "invalid_format", message: "not an email", path: [] }], []] },
  ];
  const all = zodIssuesToFieldErrors(issues, true);
  assert.equal(all.password.message, "too short");
  assert.deepEqual(all.password.types, { too_small: "too short", invalid_format: ["needs a digit", "needs a symbol"] });
  assert.equal(all["address.city"].message, "required");
  assert.deepEqual(all.contact, { type: "invalid_format", message: "not an email", types: { invalid_format: "not an email" } });
  assert.equal(zodIssuesToFieldErrors(issues).password.types, undefined, "no types unless all criteria are requested");
});
