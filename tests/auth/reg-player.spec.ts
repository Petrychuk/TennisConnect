import { test, expect } from '@playwright/test';
import { registerPlayer } from '../helpers/auth';
import { completePlayerProfile } from '../helpers/profile';

test('@smoke REG-001 Player can register', async ({ page }) => {

  await registerPlayer(page);

  // Complete Profile page
  await expect(page).toHaveURL(/complete-profile/);

  await expect(
    page.getByRole('heading', {
      name: /complete your profile/i,
    })
  ).toBeVisible();

  await expect(
    page.getByText(/player profile/i)
  ).toBeVisible();

  // Fill profile
  await completePlayerProfile(page);

  // Redirect to player profile
  await expect(page).toHaveURL(/\/player\/.+/);
  
  await page.waitForTimeout(3000);

  await page.screenshot({
    path: 'test-result.png',
    fullPage: true,
  });
});