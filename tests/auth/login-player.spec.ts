import { test, expect } from '@playwright/test';
import {
  registerPlayer,
  login,
  logout,
} from '../helpers/auth';

import {
  completePlayerProfile,
} from '../helpers/profile';

test('AUTH-003 Login - Player', async ({ page }) => {

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