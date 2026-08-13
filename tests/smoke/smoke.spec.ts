import { test, expect } from '@playwright/test';
import { login, logout, dismissCookieBanner } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/test-users';

/*
  SMOKE SUITE — safe to run against PROD.

  Rules for anything in this file:
  - No registration (registerPlayer/registerCoach) - never create new users.
  - No profile edits, uploads, admin actions, or deletes.
  - Only: navigation, reading public pages, login/logout with the
    already-seeded TEST_USERS.

  Run with:
    npx playwright test --grep @smoke

  Everything else in tests/ (registration, profile edit, uploads, admin
  CRUD, access/security payloads) is destructive/data-creating and should
  only run against STAGING, e.g.:
    BASE_URL=https://staging.tennisconnect.example npm run test:e2e
*/

test('@smoke HOME-001 Homepage loads', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/');
  await dismissCookieBanner(page);

  // ---------- Verify ----------

  await expect(
    page.getByTestId('navbar-logo-link')
  ).toBeVisible();

});

test('@smoke PUBLIC-SMOKE-001 Coaches directory opens', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/coaches');
  await dismissCookieBanner(page);

  // ---------- Verify ----------

  await expect(
    page.getByTestId('coaches-search-input')
  ).toBeVisible();

});

test('@smoke PUBLIC-SMOKE-002 Players directory opens', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/players');
  await dismissCookieBanner(page);

  // ---------- Verify ----------

  await expect(
    page.getByTestId('players-search-input')
  ).toBeVisible();

});

test('@smoke AUTH-SMOKE-001 Login and logout with seeded player', async ({ page }) => {

  // ---------- Login ----------

  await login(
    page,
    TEST_USERS.player.email,
    TEST_USERS.player.password
  );

  // ---------- Verify login ----------

  await expect(page).toHaveURL(/\/player\/.+/);

  // ---------- Logout ----------

  await logout(page);

  // ---------- Final verification ----------

  await expect(page).toHaveURL('/');

});

/*
  Messaging smoke checks — read-only only. A real "send message" test
  writes a row to the prod DB every run, which is exactly what
  tests/global-setup.ts exists to block outside @smoke. So these 5 prove
  the messaging system is alive on prod without ever calling
  POST /api/messages or /api/messages/reply. Full send/reply/delete
  flows (MSG-001..015) stay staging-only in tests/messages/messages.spec.ts.
*/

test('@smoke MSG-SMOKE-001 Guest cannot access messages', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/messages');
  await dismissCookieBanner(page);

  // ---------- Verify ----------

  await expect(
    page.getByText(/sign in to view messages/i)
  ).toBeVisible();

  await expect(
    page.locator('[data-testid^="message-item-"]')
  ).toHaveCount(0);

});

test('@smoke MSG-SMOKE-002 Guest contact form redirects to sign in', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto(`/coach/${TEST_USERS.coach.slug}?tab=contact`);
  await dismissCookieBanner(page);
  await page.getByTestId('contact-tab').click();

  // ---------- Verify ----------

  await expect(
    page.getByTestId('coach-contact-signed-out')
  ).toBeVisible();

  // ---------- Actions ----------

  await page.getByTestId('coach-contact-sign-in').click();

  // ---------- Final verification ----------

  await expect(page).toHaveURL(/\/auth/);

});

test('@smoke MSG-SMOKE-003 Empty message keeps send button disabled', async ({ page }) => {

  // ---------- Login ----------

  await login(
    page,
    TEST_USERS.player.email,
    TEST_USERS.player.password
  );

  // ---------- Open page ----------

  await page.goto(`/coach/${TEST_USERS.coach.slug}?tab=contact`);
  await page.getByTestId('contact-tab').click();

  // ---------- Verify (nothing typed - no request should ever be possible) ----------

  await expect(
    page.getByTestId('button-send-contact-message')
  ).toBeDisabled();

});

test('@smoke MSG-SMOKE-004 Seeded player inbox opens without error', async ({ page }) => {

  // ---------- Login ----------

  await login(
    page,
    TEST_USERS.player.email,
    TEST_USERS.player.password
  );

  // ---------- Open page ----------

  await page.goto('/messages');

  // ---------- Verify ----------

  await expect(
    page.getByTestId('text-page-title')
  ).toBeVisible();

});

test('@smoke MSG-SMOKE-005 Seeded coach inbox opens without error', async ({ page }) => {

  // ---------- Login ----------

  await login(
    page,
    TEST_USERS.coach.email,
    TEST_USERS.coach.password
  );

  // ---------- Open page ----------

  await page.goto('/messages');

  // ---------- Verify ----------

  await expect(
    page.getByTestId('text-page-title')
  ).toBeVisible();

});
