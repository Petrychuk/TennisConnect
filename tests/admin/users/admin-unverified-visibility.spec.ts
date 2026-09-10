import { test, expect } from '@playwright/test';
import { login, completeVerification, dismissCookieBanner } from '../../helpers/auth';
import { generateTestUser, TEST_USERS } from '../../fixtures/test-users';

/* ADMIN-004 Unverified accounts stay out of Users Moderation (regression)

storage.getAllUsers() (the admin users list's only data source) filters
to emailVerified = true - added after a real concern: without it, every
POST /api/auth/register call, including from a bot hammering the
endpoint with throwaway addresses, immediately showed up as an
"Awaiting Approval" row whether or not the address was ever real.

✓ A freshly-registered, not-yet-verified account does NOT appear in the
  admin list
✓ The same account DOES appear once its email is confirmed */

test('ADMIN-004 Unverified accounts are hidden until the email is confirmed', async ({ page }) => {

  // ---------- Test data: register directly via the API, deliberately
  // NOT using registerPlayer() (which always completes verification
  // before returning) - this test is specifically about the window
  // before that happens ----------

  const user = generateTestUser('player');

  const registerRes = await page.request.post('/api/auth/register', {
    data: { name: user.name, email: user.email, password: user.password, role: 'player' },
  });
  expect(registerRes.ok()).toBeTruthy();

  // ---------- Login as admin, confirm the row is absent ----------

  await login(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  await page.goto('/admin');
  await dismissCookieBanner(page);
  await page.getByTestId('admin-tab-users').click();

  await expect(page.getByText(user.email, { exact: true })).not.toBeVisible();

  // ---------- Verify the email - this signs in as the test user in
  // this same browser context, replacing the admin session ----------

  await completeVerification(page, user.email);

  // ---------- Log back in as admin and confirm the row now appears ----------

  await login(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  await expect(page.getByText(user.email, { exact: true })).toBeVisible();

});
