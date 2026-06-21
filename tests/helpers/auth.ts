import { expect, Page } from '@playwright/test';
import { generateTestUser } from '../fixtures/test-users';

export async function registerPlayer(page: Page) {
  const user = generateTestUser('player');

  await page.goto('/auth');

  await page.getByText('Sign Up').click();
  await page.locator('label[for="role-player"]').click();

  await page.fill('#reg-name', user.name);
  await page.fill('#reg-email', user.email);
  await page.fill('#reg-password', user.password);
  await page.fill('#confirm-password', user.password);

  await page.check('#agreeToTerms');

  await page.getByRole('button', {
    name: /create account/i,
  }).click();

  return user;
}

export async function registerCoach(page: Page) {
  const user = generateTestUser('coach');

  await page.goto('/auth');
  
  await page.getByText('Sign Up').click();
  await page.locator('label[for="role-coach"]').click();

  await page.fill('#reg-name', user.name);
  await page.fill('#reg-email', user.email);
  await page.fill('#reg-password', user.password);
  await page.fill('#confirm-password', user.password);

  await page.check('#agreeToTerms');

  await page.getByRole('button', {
    name: /create account/i,
  }).click();

  return user;
}

export async function login(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/auth');

  await page.getByRole('tab', {
    name: /sign in/i,
  }).click();

  await page.fill('#email', email);
  await page.fill('#password', password);

  await page.getByRole('button', {
    name: /sign in/i,
  }).click();

  // ждём пока уйдём со страницы auth
  await expect(page).not.toHaveURL(/auth/);
}

export async function logout(page: Page) {
  await page.getByTestId('profile-menu').click();
  await page.getByTestId('logout-btn').click();

  await expect(page).toHaveURL('/');
}