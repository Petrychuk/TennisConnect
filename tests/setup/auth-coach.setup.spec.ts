import { test as setup, expect } from '@playwright/test';
import { dismissCookieBanner } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/test-users';

setup('Authenticate Coach', async ({ page }) => {
  await page.goto('/auth');
  await dismissCookieBanner(page);

  await page.getByTestId('login-tab').click();

  await page.getByTestId('login-email').fill(
    TEST_USERS.coach.email
  );

  await page.getByTestId('login-password').fill(
    TEST_USERS.coach.password
  );

  await page.getByTestId('login-button').click();

  // Ждём открытия профиля тренера
  await expect(page).toHaveURL(/\/coach\/.+/, {
    timeout: 15000,
  });

  // Проверяем успешную авторизацию
  await expect(
    page.getByTestId('profile-menu')
  ).toBeVisible();

  // Сохраняем cookies
  await page.context().storageState({
    path: 'playwright/.auth/coach.json',
  });
});