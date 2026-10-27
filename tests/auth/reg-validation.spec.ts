import { test, expect, type Page } from '@playwright/test';
import { dismissCookieBanner } from '../helpers/auth';
import { generateTestUser, uniqueTestEmail } from '../fixtures/test-users';

/*
  How registration validation works (client/src/pages/auth.tsx):
  react-hook-form + Zod (registerSchema, client/src/lib/validations/auth.ts)
  through client/src/lib/zodResolver.ts. NOT native HTML5 validation - the
  email input is type="text" and the password has no minLength, so the
  browser's validity API reports both as valid and never blocks submission;
  the app's own message under the field is the only feedback a user gets.

  Regression: with Zod 4, @hookform/resolvers 3.x re-threw every
  validation failure (it looked for ZodError.errors, removed in Zod 4).
  Submission was blocked only because handleSubmit crashed, and no message
  was shown - which is what REG-003/REG-004 caught on Staging.

  Each test checks that the bad input is rejected with the field's real
  message, that nothing was sent to the server, that the page did not
  crash, and that the user is still on the registration form.
*/

interface RegistrationAttempt {
  /** POSTs to /api/auth/register while the form was submitted. */
  registerRequests: string[];
  /** Uncaught errors / unhandled rejections in the page. */
  pageErrors: string[];
}

async function submitRegistration(
  page: Page,
  fields: { name: string; email: string; password: string; confirmPassword: string }
): Promise<RegistrationAttempt> {
  const attempt: RegistrationAttempt = { registerRequests: [], pageErrors: [] };
  page.on('pageerror', error => attempt.pageErrors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/auth/register') {
      attempt.registerRequests.push(request.url());
    }
  });

  await page.goto('/auth');
  await dismissCookieBanner(page);
  await page.getByTestId('register-tab').click();

  await page.getByTestId('reg-name').fill(fields.name);
  await page.getByTestId('reg-email').fill(fields.email);
  await page.getByTestId('reg-password').fill(fields.password);
  await page.getByTestId('confirm-password').fill(fields.confirmPassword);
  await page.getByTestId('agree-to-terms').check();

  await page.getByTestId('register-button').click();
  return attempt;
}

/** The field's validation message is the only thing that went wrong, and registration did not proceed. */
async function expectRejectedClientSide(page: Page, attempt: RegistrationAttempt, field: string, message: string) {
  const form = page.locator('form').filter({ has: page.getByTestId('register-button') });

  // The real message, exactly once, inside the registration form.
  await expect(form.getByText(message, { exact: true })).toHaveCount(1);
  await expect(form.getByText(message, { exact: true })).toBeVisible();
  // ...and the field is marked as invalid (the app's error styling).
  await expect(page.getByTestId(field)).toHaveClass(/border-destructive/);

  // Native validation is not what blocked it - the browser considers the input valid.
  expect(await page.getByTestId(field).evaluate(el => (el as HTMLInputElement).validity.valid)).toBe(true);

  // Registration did not proceed: no request, still on the form, no verification screen.
  await expect(page.getByTestId('register-button')).toBeEnabled();
  expect(attempt.registerRequests).toEqual([]);
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByTestId('verification-required-screen')).toHaveCount(0);

  // Rejected by validation, not by a crash.
  expect(attempt.pageErrors).toEqual([]);
}

/* REG-003 Register - Invalid Email Format (client-side) */

test('REG-003 Register - invalid email format is rejected client-side', async ({ page }) => {
  const user = generateTestUser('player');

  const attempt = await submitRegistration(page, {
    name: user.name,
    email: 'not-an-email',
    password: user.password,
    confirmPassword: user.password,
  });

  await expectRejectedClientSide(page, attempt, 'reg-email', 'Please enter a valid email address');
});

/* REG-004 Register - Password Under 8 Characters (client-side) */

test('REG-004 Register - password under 8 characters is rejected client-side', async ({ page }) => {
  const user = generateTestUser('player');

  const attempt = await submitRegistration(page, {
    name: user.name,
    email: user.email,
    password: 'short1',
    confirmPassword: 'short1',
  });

  await expectRejectedClientSide(page, attempt, 'reg-password', 'Password must be at least 8 characters');
});

/* REG-005 Register API - Server Rejects Bad Input When the Form Is
   Bypassed (regression for the direct-POST registration hole)

Client-side validation (REG-003/REG-004 above) only ever protects
someone using the real form - a direct POST to /api/auth/register used
to accept whatever was sent, since insertUserSchema only picked these
fields with no further constraints. Confirms the server itself now
enforces the same rules the form does, independently of the UI. */

test('REG-005 Register API - rejects short password, bad email and bad role directly', async ({ page }) => {

  const base = generateTestUser('player');

  const shortPassword = await page.request.post('/api/auth/register', {
    data: { ...base, email: uniqueTestEmail('reg005a'), password: 'short1' },
  });
  expect(shortPassword.status()).toBe(400);

  const badEmail = await page.request.post('/api/auth/register', {
    data: { ...base, email: 'not-an-email', password: 'Test123456!' },
  });
  expect(badEmail.status()).toBe(400);

  const badRole = await page.request.post('/api/auth/register', {
    data: {
      ...base,
      email: uniqueTestEmail('reg005b'),
      password: 'Test123456!',
      role: 'admin',
    },
  });
  expect(badRole.status()).toBe(400);

});
