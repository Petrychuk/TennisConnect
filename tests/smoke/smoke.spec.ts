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

  await page.goto('/partners');
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
