import { test, expect } from '@playwright/test';
import {
  registerPlayer,
  login,
  logout,
  dismissCookieBanner,
} from '../helpers/auth';

import {
  completePlayerProfile,
} from '../helpers/profile';

test('@smoke AUTH-003 Player can login', async ({ page }) => {

  const player = await registerPlayer(page);

  await completePlayerProfile(page);

  await logout(page);

  await login(
    page,
    player.email,
    player.password
  );

  await expect(page).toHaveURL(/\/player\/.+/);

});

test('AUTH-014 Logging In With An Incomplete Profile Returns To Complete Profile, Not The Profile Page', async ({ page }) => {

  // ---------- Test data ----------
  // registerPlayer() itself lands on /complete-profile and stops there
  // (deliberately not calling completePlayerProfile()) - this is
  // exactly the state a registration left in an unfinished state ends
  // up in, e.g. the client giving up on a slow response before the
  // server actually finished creating the account: the account exists
  // with profileCompleted still false, and logging in afterwards used
  // to skip straight to the (still-default, unfilled) profile page
  // instead of back to the form - onLogin never checked
  // profileCompleted, unlike onRegister.

  const player = await registerPlayer(page);

  await logout(page);

  // ---------- Actions ----------
  // Not using the shared login() helper here - it asserts a redirect
  // to /player/.. or /coach/.., which is exactly the behaviour this
  // test is confirming does NOT happen for an incomplete profile.

  await page.goto('/auth');
  await dismissCookieBanner(page);

  await page.getByTestId('login-email').fill(player.email);
  await page.getByTestId('login-password').fill(player.password);

  await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/auth/login') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('login-button').click(),
  ]);

  // ---------- Final verification ----------

  await expect(page).toHaveURL(/\/complete-profile/, { timeout: 15000 });

});