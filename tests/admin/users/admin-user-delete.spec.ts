import { test, expect } from '@playwright/test';
import { registerPlayer, login } from '../../helpers/auth';
import { TEST_USERS } from '../../fixtures/test-users';

/* ADMIN-002 Delete User - Ordinary Player (happy path)

✓ Admin can delete a plain player with no organisation/sessions
✓ Response is 200, row disappears from the table */

test('ADMIN-002 Delete User - ordinary player succeeds', async ({ page }) => {

  // ---------- Test data ----------

  const player = await registerPlayer(page);

  // ---------- Login as admin ----------

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  // ---------- Open page ----------

  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  const row = page.locator('tr', {
    has: page.getByText(player.email, { exact: true }),
  });
  await expect(row).toBeVisible();

  // ---------- Actions ----------

  await row.getByTestId(/^delete-user-/).click();

  const [response] = await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/[^/]+$/.test(response.url()) &&
        response.request().method() === 'DELETE'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  // ---------- Verify request ----------

  expect(response.status()).toBe(200);

  // ---------- Final verification ----------

  await expect(page.getByText(/user deleted/i)).toBeVisible();
  await expect(row).not.toBeVisible();

});

/* ADMIN-003 Delete User - Organiser Who Owns an Organisation (regression)

Reproduces a real staging bug: deleting an organiser who owns an
organization returned a blank 500 "Failed to delete user" instead of the
actual, actionable reason - storage.deleteUserAccount() deliberately
blocks this case with a specific message (to avoid silently cascading
the deletion of an organization other people may be using), but the
admin route was swallowing every error into the same generic 500. The
self-delete route (/api/me/account) already classified this correctly;
the admin route was just missing the same check.

✓ Deleting an org-owning organiser is blocked with the real reason (400),
  not a generic 500
✓ The user row still exists afterwards (delete never actually happened) */

test('ADMIN-003 Delete User - blocked with real reason for an org owner', async ({ page }) => {

  // ---------- Test data: a fresh player, granted organiser access,
  // who then creates their own organization ----------

  const player = await registerPlayer(page);

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  const row = page.locator('tr', {
    has: page.getByText(player.email, { exact: true }),
  });
  await expect(row).toBeVisible();

  // ---------- Grant organiser access ----------

  await row.getByTestId(/^grant-organizer-/).click();

  await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/.+\/grant-organizer$/.test(response.url()) &&
        response.request().method() === 'PATCH'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  // ---------- Create an organization as that player (API-only - no UI
  // wizard needed for this, and it sidesteps registerPlayer() leaving
  // the account on /complete-profile rather than a finished profile) ----------

  const playerLogin = await page.request.post('/api/auth/login', {
    data: { email: player.email, password: player.password },
  });
  expect(playerLogin.ok()).toBeTruthy();

  const orgResponse = await page.request.post('/api/organizer/organizations', {
    data: { name: `Test Org ${Date.now()}` },
  });
  expect(orgResponse.ok()).toBeTruthy();

  // ---------- Back to admin, attempt the delete ----------

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  await expect(row).toBeVisible();

  await row.getByTestId(/^delete-user-/).click();

  const [response] = await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/[^/]+$/.test(response.url()) &&
        response.request().method() === 'DELETE'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  // ---------- Verify request: real reason, not a blank 500 ----------

  expect(response.status()).toBe(400);

  const body = await response.json();
  expect(body.message).toContain('You own an organization');

  // ---------- Final verification: toast shows the real reason, and the
  // user was NOT actually deleted ----------

  await expect(page.getByText(/you own an organization/i)).toBeVisible();
  await expect(row).toBeVisible();

});
