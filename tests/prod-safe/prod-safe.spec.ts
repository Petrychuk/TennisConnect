import { test, expect } from '../fixtures/prod-safe';
import { dismissCookieBanner } from '../helpers/auth';
import { readVerifiedTarget } from '../safety/environment-guard';

/*
  PROD-SAFE SUITE - the ONLY tests allowed to run against PRODUCTION.

  Separate from @smoke on purpose: @smoke includes registration
  (REG-001/REG-002) and authenticated flows, which create data.

  Rules for anything in this file:
  - Read-only: public pages and GET requests only.
  - No registration, no login (it writes sessions / lockout counters),
    no form submits, uploads, admin actions or deletes.
  - Title starts with @prod-safe and has a PROD-SAFE-NNN id.
  - Every new test id must be added to PROD_SAFE_ALLOWLIST in
    tests/safety/environment-guard.ts - that addition is the approval.
  - Import test/expect from ../fixtures/prod-safe (blocks write requests).

  Run with:
    TEST_ENV=production BASE_URL=https://<production host> npm run test:e2e:prod-safe
*/

test('@prod-safe PROD-SAFE-001 Health endpoint matches verified target', async ({ request }) => {

  // ---------- Test data ----------

  const verified = readVerifiedTarget(process.env);

  // ---------- Actions ----------

  const response = await request.get('/api/health');

  // ---------- Verify request ----------

  expect(response.status()).toBe(200);

  // ---------- Final verification ----------

  const body = await response.json();

  expect(verified).toBeDefined();
  expect(String(body.dbEnv).trim().toLowerCase()).toBe(verified!.serverEnv);

});

test('@prod-safe PROD-SAFE-002 Homepage loads', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/');
  await dismissCookieBanner(page);

  // ---------- Final verification ----------

  const logoLink = page.getByTestId('navbar-logo-link');

  await expect(logoLink).toBeVisible();

});

test('@prod-safe PROD-SAFE-003 Coaches directory opens', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/coaches');
  await dismissCookieBanner(page);

  // ---------- Final verification ----------

  const searchInput = page.getByTestId('coaches-search-input');

  await expect(searchInput).toBeVisible();

});

test('@prod-safe PROD-SAFE-004 Players directory opens', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/players');
  await dismissCookieBanner(page);

  // ---------- Final verification ----------

  const searchInput = page.getByTestId('players-search-input');

  await expect(searchInput).toBeVisible();

});

test('@prod-safe PROD-SAFE-005 Guest is gated from messages', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/messages');
  await dismissCookieBanner(page);

  // ---------- Final verification ----------

  const signInPrompt = page.getByText(/sign in to view messages/i);
  const messageItems = page.locator('[data-testid^="message-item-"]');

  await expect(signInPrompt).toBeVisible();
  await expect(messageItems).toHaveCount(0);

});
