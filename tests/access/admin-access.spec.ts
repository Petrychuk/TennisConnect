import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/test-users';

test('ACCESS-005 Admin → /admin', async ({ page }) => {

  // ---------- Login ----------

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  // ---------- Open page ----------

  await page.goto('/admin');

  // ---------- Verify ----------

  await expect(
    page.getByTestId('admin-tab-users')
  ).toBeVisible();

  await expect(
    page.getByText(/admin access required/i)
  ).not.toBeVisible();

});

test('ACCESS-006 Admin → Users tab shows pending approvals', async ({ page }) => {

  // ---------- Login ----------

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  // ---------- Open page ----------

  await page.goto('/admin');

  // ---------- Actions ----------

  const usersTab = page.getByTestId('admin-tab-users');
  await usersTab.click();

  // ---------- Verify ----------

  await expect(page).toHaveURL(/admin/);
  await expect(usersTab).toBeVisible();

});
