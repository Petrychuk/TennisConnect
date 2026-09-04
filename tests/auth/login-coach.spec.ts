import { test, expect } from '@playwright/test';
import {
  registerCoach,
  login,
  logout,
} from '../helpers/auth';

import {
  completeCoachProfile,
} from '../helpers/profile';

test('@smoke AUTH-004 Login - Coach', async ({ page }) => {

  const coach = await registerCoach(page);

  await completeCoachProfile(page);

  await logout(page);

  await login(
    page,
    coach.email,
    coach.password
  );

  await expect(page).toHaveURL(/\/coach\/.+/);

});