import { test, expect } from '@playwright/test';
import { registerPlayer, login } from '../../helpers/auth';
import { TEST_USERS } from '../../fixtures/test-users';
import { expectRunOwned } from '../../fixtures/run-id';

/* ADMIN-001 New User Queue

✓ New user appears in Admin
✓ isApproved = false ("Pending")
✓ Can be approved */

test('ADMIN-001 New User Queue - Approve Pending Player', async ({ page }) => {

  // ---------- Test data ----------

  const player = await registerPlayer(page);
  // Admin action on an account: it must belong to this run.
  expectRunOwned(player.email);

  // ---------- Login ----------

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  // ---------- Open page ----------

  await page.goto('/admin');
  await page.getByTestId('organiser-sidebar-nav-admin-users').click();

  const row = page.locator('tr', {
    has: page.getByText(player.email, { exact: true }),
  });

  // ---------- Verify ----------

  await expect(row).toBeVisible();
  await expect(row.getByText('Pending')).toBeVisible();

  const approveButton = row.getByTitle('Approve User');
  await expect(approveButton).toBeVisible();

  // ---------- Actions ----------

  await approveButton.click();

  // ---------- Save ----------

  const [response] = await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/.+\/approve$/.test(response.url()) &&
        response.request().method() === 'PATCH'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  // ---------- Verify request ----------

  expect(response.ok()).toBeTruthy();

  // ---------- Final verification ----------

  await expect(row.getByText('Approved')).toBeVisible();
  await expect(row.getByText('Pending')).not.toBeVisible();

});
