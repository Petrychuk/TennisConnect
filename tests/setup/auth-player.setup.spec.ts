import { test as setup, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/test-users';

setup('Authenticate Player', async ({ page }) => {
  // Открываем страницу логина
  await page.goto('/auth');

  // Переключаемся на Sign In
  await page.getByRole('tab', {
    name: /sign in/i,
  }).click();

  // Вводим данные
  await page.getByTestId('login-email').fill(
    TEST_USERS.player.email
  );

  await page.getByTestId('login-password').fill(
    TEST_USERS.player.password
  );

  // Логинимся
  await page.getByRole('button', {
    name: /sign in/i,
  }).click();

  // 🔥 ОБЯЗАТЕЛЬНО ждём окончания логина
  await expect(page).toHaveURL(/\/player\/.+/, {
    timeout: 15000,
  });

  // Проверяем, что реально вошли
  await expect(
    page.getByTestId('profile-menu')
  ).toBeVisible();

  // Только теперь сохраняем cookies
  await page.context().storageState({
    path: 'playwright/.auth/player.json',
  });
  
  console.log('PLAYER AUTH SAVED');
});