import { test, expect } from '@playwright/test';

test('SEC-002 XSS', async ({ page }) => {

    await page.goto('/auth');
  
    await page.getByText('Sign Up').click();
  
    await page.fill(
      '#reg-name',
      '<script>alert(1)</script>'
    );
  
    await page.fill(
      '#reg-email',
      'xss@test.com'
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
  
    await expect(
      page.locator('text=alert')
    ).not.toBeVisible();
  
  });