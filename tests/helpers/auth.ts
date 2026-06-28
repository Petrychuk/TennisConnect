import { expect, Page } from '@playwright/test';
import { generateTestUser } from '../fixtures/test-users';

export async function registerPlayer(page: Page) {
  const user = generateTestUser('player');

  await page.goto('/auth');

  await page.getByTestId('register-tab').click();
  //await page.getByTestId('player-card').click();

  await page.getByTestId('reg-name').fill(user.name);
  await page.getByTestId('reg-email').fill(user.email);
  await page.getByTestId('reg-password').fill(user.password);
  await page.getByTestId('confirm-password').fill(user.password);

  await page.getByTestId('agree-to-terms').check();

  await page.getByTestId('register-button').click();

  return user;
}

export async function registerCoach(page: Page) {
  const user = generateTestUser('coach');

  await page.goto('/auth');

  await page.getByTestId('register-tab').click();
  await page.getByTestId('coach-card').click();

  await page.getByTestId('reg-name').fill(user.name);
  await page.getByTestId('reg-email').fill(user.email);
  await page.getByTestId('reg-password').fill(user.password);
  await page.getByTestId('confirm-password').fill(user.password);

  await page.getByTestId('agree-to-terms').check();

  await page.getByTestId('register-button').click();

  return user;
}

export async function login(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/auth');

  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);

  await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/auth/login') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('login-button').click(),
  ]);

  // дождаться окончания редиректа
  await expect(page).toHaveURL(/\/player\/.+|\/coach\/.+/, {
    timeout: 15000,
  });

  // дождаться появления меню пользователя
  await expect(
    page.getByTestId('profile-menu')
  ).toBeVisible({
    timeout: 15000,
  });
}

export async function logout(page: Page) {
  await page.getByTestId('profile-menu').click();

  await page.getByTestId('logout-btn').click();

  await expect(page).toHaveURL('/');
}