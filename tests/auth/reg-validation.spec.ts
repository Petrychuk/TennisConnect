import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../helpers/auth';
import { generateTestUser } from '../fixtures/test-users';

/* REG-003 Register - Invalid Email Format (client-side)

✓ registerSchema's email check (client/src/lib/validations/auth.ts)
  blocks submission and shows the real error
✓ No account gets created - stays on /auth */

test('REG-003 Register - invalid email format is rejected client-side', async ({ page }) => {

  const user = generateTestUser('player');

  await page.goto('/auth');
  await dismissCookieBanner(page);

  await page.getByTestId('register-tab').click();

  await page.getByTestId('reg-name').fill(user.name);
  await page.getByTestId('reg-email').fill('not-an-email');
  await page.getByTestId('reg-password').fill(user.password);
  await page.getByTestId('confirm-password').fill(user.password);
  await page.getByTestId('agree-to-terms').check();

  await page.getByTestId('register-button').click();

  // ---------- Verify ----------

  await expect(
    page.getByText(/please enter a valid email address/i)
  ).toBeVisible();

  await expect(page).toHaveURL(/\/auth/);
  await expect(page).not.toHaveURL(/complete-profile/);

});

/* REG-004 Register - Password Under 8 Characters (client-side)

✓ registerSchema's 8-character minimum blocks submission and shows the
  real error
✓ No account gets created - stays on /auth */

test('REG-004 Register - password under 8 characters is rejected client-side', async ({ page }) => {

  const user = generateTestUser('player');

  await page.goto('/auth');
  await dismissCookieBanner(page);

  await page.getByTestId('register-tab').click();

  await page.getByTestId('reg-name').fill(user.name);
  await page.getByTestId('reg-email').fill(user.email);
  await page.getByTestId('reg-password').fill('short1');
  await page.getByTestId('confirm-password').fill('short1');
  await page.getByTestId('agree-to-terms').check();

  await page.getByTestId('register-button').click();

  // ---------- Verify ----------

  await expect(
    page.getByText(/password must be at least 8 characters/i)
  ).toBeVisible();

  await expect(page).toHaveURL(/\/auth/);
  await expect(page).not.toHaveURL(/complete-profile/);

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
    data: { ...base, email: `reg005a_${Date.now()}@tennisconnect.test`, password: 'short1' },
  });
  expect(shortPassword.status()).toBe(400);

  const badEmail = await page.request.post('/api/auth/register', {
    data: { ...base, email: 'not-an-email', password: 'Test123456!' },
  });
  expect(badEmail.status()).toBe(400);

  const badRole = await page.request.post('/api/auth/register', {
    data: {
      ...base,
      email: `reg005b_${Date.now()}@tennisconnect.test`,
      password: 'Test123456!',
      role: 'admin',
    },
  });
  expect(badRole.status()).toBe(400);

});
