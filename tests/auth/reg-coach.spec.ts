import { test, expect } from '@playwright/test';
import { registerCoach } from '../helpers/auth';
import { completeCoachProfile } from '../helpers/profile';

test('@smoke REG-002 Coach can register', async ({ page }) => {

  await registerCoach(page);

  // Complete Profile page
  await expect(page).toHaveURL(/complete-profile/);

  await expect(
    page.getByRole('heading', {
      name: /complete your profile/i,
    })
  ).toBeVisible();

  await expect(
    page.getByText(/coach profile/i)
  ).toBeVisible();

  // Fill profile
  await completeCoachProfile(page);

  // Redirect to coach profile
  await expect(page).toHaveURL(/\/coach\/.+/);

  await page.waitForTimeout(3000);

  await page.screenshot({
    path: 'test-result-coach.png',
    fullPage: true,
  });
});