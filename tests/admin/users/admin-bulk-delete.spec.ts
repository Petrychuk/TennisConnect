import { test, expect } from '@playwright/test';
import { registerPlayer, login } from '../../helpers/auth';
import { TEST_USERS } from '../../fixtures/test-users';

/* ADMIN-005 Bulk Delete - selected ordinary players are all removed

✓ Checking two rows and confirming "Delete Selected" removes both
✓ Response reports both ids under `deleted`, none under `failed` */

test('ADMIN-005 Bulk delete - selected ordinary players are all removed', async ({ page }) => {

  // ---------- Test data: two plain players, no org/sessions ----------

  const playerA = await registerPlayer(page);
  const playerB = await registerPlayer(page);

  // ---------- Login as admin ----------

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  const rowA = page.locator('tr', { has: page.getByText(playerA.email, { exact: true }) });
  const rowB = page.locator('tr', { has: page.getByText(playerB.email, { exact: true }) });
  await expect(rowA).toBeVisible();
  await expect(rowB).toBeVisible();

  // ---------- Select both, delete ----------

  await rowA.getByTestId(/^select-user-/).check();
  await rowB.getByTestId(/^select-user-/).check();

  await expect(page.getByTestId('bulk-delete-button')).toContainText('2');

  await page.getByTestId('bulk-delete-button').click();

  const [response] = await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/admin/users/bulk-delete') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('bulk-delete-confirm').click(),
  ]);

  // ---------- Verify request ----------

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.deleted).toHaveLength(2);
  expect(body.failed).toHaveLength(0);

  // ---------- Final verification: both rows gone, selection bar too ----------

  await expect(rowA).not.toBeVisible();
  await expect(rowB).not.toBeVisible();
  await expect(page.getByTestId('bulk-delete-bar')).not.toBeVisible();

});

/* ADMIN-006 Bulk Delete - an org owner in the selection is skipped, not
   force-deleted (regression for the same rule ADMIN-003 covers for a
   single delete)

The org owner's organization has a session under it here - an empty
organization is cascaded away instead of blocking the delete (see
ADMIN-008), so this needs one to stay a genuine blocked case.

✓ A plain player in the same batch is still deleted
✓ The org-owning organiser is reported under the response's failed
  array with the real reason, and its row still exists afterward */

test('ADMIN-006 Bulk delete - an org owner in the batch is reported, not deleted', async ({ page }) => {

  // ---------- Test data: one plain player, one organiser who owns an
  // organization ----------

  const plainPlayer = await registerPlayer(page);
  const orgOwner = await registerPlayer(page);

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  const orgOwnerRow = page.locator('tr', { has: page.getByText(orgOwner.email, { exact: true }) });
  await expect(orgOwnerRow).toBeVisible();

  await orgOwnerRow.getByTestId(/^grant-organizer-/).click();
  await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/.+\/grant-organizer$/.test(response.url()) &&
        response.request().method() === 'PATCH'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  // ---------- Create an organization as that player (API-only, same
  // approach as ADMIN-003) ----------

  const orgOwnerLogin = await page.request.post('/api/auth/login', {
    data: { email: orgOwner.email, password: orgOwner.password },
  });
  expect(orgOwnerLogin.ok()).toBeTruthy();

  const orgResponse = await page.request.post('/api/organizer/organizations', {
    data: { name: `Bulk Delete Test Org ${Date.now()}` },
  });
  expect(orgResponse.ok()).toBeTruthy();

  // A session under it - an empty organization is cascaded away rather
  // than blocking the delete (see ADMIN-008), so this needs a real
  // session to stay a genuine "blocked" case.
  const sessionResponse = await page.request.post('/api/organizer/sessions', {
    data: { title: `Bulk Delete Test Session ${Date.now()}`, startAt: new Date(Date.now() + 86400000).toISOString() },
  });
  expect(sessionResponse.ok()).toBeTruthy();

  // ---------- Back to admin, select both, bulk delete ----------

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  const plainPlayerRow = page.locator('tr', { has: page.getByText(plainPlayer.email, { exact: true }) });
  await expect(plainPlayerRow).toBeVisible();
  await expect(orgOwnerRow).toBeVisible();

  await plainPlayerRow.getByTestId(/^select-user-/).check();
  await orgOwnerRow.getByTestId(/^select-user-/).check();

  await page.getByTestId('bulk-delete-button').click();

  const [response] = await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/admin/users/bulk-delete') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('bulk-delete-confirm').click(),
  ]);

  // ---------- Verify request: one deleted, one blocked with the real
  // reason ----------

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.deleted).toHaveLength(1);
  expect(body.failed).toHaveLength(1);
  expect(body.failed[0].message).toContain('You own an organization');

  // ---------- Final verification: plain player gone, org owner's row
  // still there (not force-deleted) ----------

  await expect(plainPlayerRow).not.toBeVisible();
  await expect(orgOwnerRow).toBeVisible();

});
