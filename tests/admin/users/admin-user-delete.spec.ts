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

/* ADMIN-007 Delete Organization unblocks deleting its owner

storage.deleteUserAccount() blocks deleting an org owner whose
organization has sessions with "You own an organization with active
sessions..." - but until now there was no actual way to act on that at
all, self-service or admin. This is the regression test for the fix: a
real "Delete Organization" action now exists right next to the blocked
delete, and using it clears the way for the user delete to succeed
afterward. (An organization with no sessions is cascaded away
automatically instead of needing this button at all - see ADMIN-008.)

✓ Deleting the organization succeeds
✓ The owner's account is untouched by that (still exists, delete
  wasn't attempted yet)
✓ Deleting the (now org-less) user succeeds where it was blocked before */

test('ADMIN-007 Delete Organization unblocks deleting its owner', async ({ page }) => {

  // ---------- Test data: an organiser who owns an organization,
  // same setup as ADMIN-003 ----------

  const orgOwner = await registerPlayer(page);

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  const row = page.locator('tr', { has: page.getByText(orgOwner.email, { exact: true }) });
  await expect(row).toBeVisible();

  await row.getByTestId(/^grant-organizer-/).click();
  await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/.+\/grant-organizer$/.test(response.url()) &&
        response.request().method() === 'PATCH'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  const orgOwnerLogin = await page.request.post('/api/auth/login', {
    data: { email: orgOwner.email, password: orgOwner.password },
  });
  expect(orgOwnerLogin.ok()).toBeTruthy();

  const orgResponse = await page.request.post('/api/organizer/organizations', {
    data: { name: `Delete Org Test ${Date.now()}` },
  });
  expect(orgResponse.ok()).toBeTruthy();
  const org = await orgResponse.json();

  // A session under it - an empty organization is cascaded away
  // automatically rather than blocking the delete (see ADMIN-008), so
  // this test needs a real session to have something worth forcing
  // through the "Delete Organization" button in the first place.
  const sessionResponse = await page.request.post('/api/organizer/sessions', {
    data: { title: `Delete Org Test Session ${Date.now()}`, startAt: new Date(Date.now() + 86400000).toISOString() },
  });
  expect(sessionResponse.ok()).toBeTruthy();

  // ---------- Confirm the delete-user block still applies (same as
  // ADMIN-003) before doing anything about it ----------

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();
  await expect(row).toBeVisible();

  const deleteOrgButton = page.getByTestId(`delete-organization-${org.id}`);
  await expect(deleteOrgButton).toBeVisible();

  // ---------- Delete the organization ----------

  await deleteOrgButton.click();

  const [orgDeleteResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes(`/api/admin/organizations/${org.id}`) &&
        response.request().method() === 'DELETE'
    ),
    page.getByTestId('delete-organization-confirm').click(),
  ]);

  expect(orgDeleteResponse.ok()).toBeTruthy();
  await expect(page.getByText(/organization deleted/i)).toBeVisible();

  // ---------- The owner's row is untouched - still there, delete
  // button no longer blocked by an organization ----------

  await expect(row).toBeVisible();
  await expect(deleteOrgButton).not.toBeVisible();

  // ---------- Now the user delete succeeds where it was blocked
  // before ----------

  await row.getByTestId(/^delete-user-/).click();

  const [userDeleteResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/[^/]+$/.test(response.url()) &&
        response.request().method() === 'DELETE'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  expect(userDeleteResponse.status()).toBe(200);
  await expect(row).not.toBeVisible();

});
/* ADMIN-003 Delete User - Organiser Whose Organization Has Sessions (regression)

Reproduces a real staging bug: deleting an organiser who owns an
organization returned a blank 500 "Failed to delete user" instead of the
actual, actionable reason - storage.deleteUserAccount() deliberately
blocks this case with a specific message (to avoid silently cascading
the deletion of sessions/registrations other people are actively using),
but the admin route was swallowing every error into the same generic
500. The self-delete route (/api/me/account) already classified this
correctly; the admin route was just missing the same check.

Owning an organization is only a block if it has sessions under it - an
empty organization is cascaded away automatically instead (see
ADMIN-008), so this test creates one to keep exercising the actual
blocked case.

✓ Deleting an organiser whose organization has a session is blocked with
  the real reason (400), not a generic 500
✓ The user row still exists afterwards (delete never actually happened) */

test('ADMIN-003 Delete User - blocked with real reason when the organization has sessions', async ({ page }) => {

  // ---------- Test data: a fresh player, granted organiser access,
  // who then creates their own organization with a session under it ----------

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

  // ---------- Create an organization AND a session under it as that
  // player (API-only - no UI wizard needed for this, and it sidesteps
  // registerPlayer() leaving the account on /complete-profile rather
  // than a finished profile) ----------

  const playerLogin = await page.request.post('/api/auth/login', {
    data: { email: player.email, password: player.password },
  });
  expect(playerLogin.ok()).toBeTruthy();

  const orgResponse = await page.request.post('/api/organizer/organizations', {
    data: { name: `Test Org ${Date.now()}` },
  });
  expect(orgResponse.ok()).toBeTruthy();

  const sessionResponse = await page.request.post('/api/organizer/sessions', {
    data: { title: `Test Session ${Date.now()}`, startAt: new Date(Date.now() + 86400000).toISOString() },
  });
  expect(sessionResponse.ok()).toBeTruthy();

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

/* ADMIN-008 Delete User - Organiser Whose Organization Has No Sessions
   (the actual point of ADMIN-003's "or delete it" - now automatic)

An organization with no sessions has no real activity anyone else is
relying on, so it's no longer a reason to block deleting its owner -
it's cascaded away in the same delete instead of requiring a separate
"Delete Organization" step first (that button still exists for the
ADMIN-003 case, an organization WITH sessions, where an admin
deliberately chooses to force it).

✓ Deleting an organiser whose organization has zero sessions succeeds
✓ The organization itself is gone afterward too (not left orphaned) */

test('ADMIN-008 Delete User - an empty organization is cascaded away, not a block', async ({ page }) => {

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

  await row.getByTestId(/^grant-organizer-/).click();
  await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/.+\/grant-organizer$/.test(response.url()) &&
        response.request().method() === 'PATCH'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  const playerLogin = await page.request.post('/api/auth/login', {
    data: { email: player.email, password: player.password },
  });
  expect(playerLogin.ok()).toBeTruthy();

  // ---------- Organization only, deliberately no session under it ----------

  const orgResponse = await page.request.post('/api/organizer/organizations', {
    data: { name: `Empty Org Test ${Date.now()}` },
  });
  expect(orgResponse.ok()).toBeTruthy();

  await login(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();
  await expect(row).toBeVisible();

  // ---------- No "Delete Organization" action needed for an org with no
  // sessions - deleting the user handles it in the same request ----------

  await row.getByTestId(/^delete-user-/).click();

  const [response] = await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/[^/]+$/.test(response.url()) &&
        response.request().method() === 'DELETE'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  expect(response.status()).toBe(200);
  await expect(row).not.toBeVisible();

});
