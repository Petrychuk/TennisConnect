import { test } from '@playwright/test';

test('Open auth page', async ({ page }, testInfo) => {
  console.log(testInfo.project.use.baseURL);

  await page.goto('/auth');
  
  await page.getByTestId('login-email').fill('player@test.com');
  await page.getByTestId('login-password').fill('Test12345!');

  await page.getByTestId('login-button').click();

  console.log('logined');
});