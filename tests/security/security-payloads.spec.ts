import { test, expect } from '@playwright/test';

export const SECURITY_PAYLOADS = [
    "'",
    "''",
    "'''",
    '"',
    '""',
    "' OR 1=1 --",
    "'; DROP TABLE users; --",
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "../../../etc/passwd",
    "DROP TABLE users;",
  ];

test.describe('Registration Security', () => {

    for (const payload of SECURITY_PAYLOADS) {
  
      test(`SEC-NAME: ${payload}`, async ({ page }) => {
  
        await page.goto('/auth');
  
        await page.getByText('Sign Up').click();
  
        await page.fill('#reg-name', payload);
  
        await page.fill(
          '#reg-email',
          `test${Date.now()}@mail.com`
        );
  
        await page.fill(
          '#reg-password',
          'Test123456!'
        );
  
        await page.fill(
          '#confirm-password',
          'Test123456!'
        );
  
        await page.check('#agreeToTerms');
  
        await page.getByRole('button', {
          name: /create account/i,
        }).click();
  
        // Главное:
        // приложение не упало
        await expect(page).not.toHaveURL(/500/);
  
      });
  
    }
  
  });

  test.describe('Login Security', () => {

    for (const payload of SECURITY_PAYLOADS) {
  
      test(`SEC-LOGIN: ${payload}`, async ({ page }) => {
  
        await page.goto('/auth');
  
        await page.getByRole('tab', {
          name: /sign in/i,
        }).click();
  
        await page.fill('#email', payload);
  
        await page.fill(
          '#password',
          'Test123456!'
        );
  
        await page.getByRole('button', {
          name: /sign in/i,
        }).click();
  
        await expect(page).toHaveURL(/auth/);
  
      });
  
    }
  
  });
 
  test.describe('Forgot Password Security', () => {

    for (const payload of SECURITY_PAYLOADS) {
  
      test(`SEC-FORGOT: ${payload}`, async ({ page }) => {
  
        await page.goto('/auth');
  
        await page.getByTestId(
          'forgot-password-link'
        ).click();
  
        await page.getByTestId(
          'forgot-email-input'
        ).fill(payload);
  
        await page.getByTestId(
          'send-reset-link-button'
        ).click();
  
        await expect(page).not.toHaveURL(/500/);
  
      });
  
    }
  
  });
