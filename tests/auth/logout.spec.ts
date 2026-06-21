import { test, expect } from '@playwright/test';

import {
  registerPlayer,
  logout,
} from '../helpers/auth';

import {
  completePlayerProfile,
} from '../helpers/profile';

test('AUTH-005 Logout', async ({ page }) => {

  await registerPlayer(page);

  await completePlayerProfile(page);

  await logout(page);

  await expect(page).toHaveURL('/');

  await expect(
    page.getByRole('button', {
      name: /sign in/i,
    })
  ).toBeVisible();

  await expect(
    page.getByTestId('profile-menu')
  ).toHaveCount(0);

});