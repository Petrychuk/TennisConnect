import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../helpers/auth';

test('SEC-001 SQL Injection', async ({ page }) => {

    await page.goto('/auth');
    await dismissCookieBanner(page);
  
    await page.getByText('Sign Up').click();
  
    await page.fill(
      '#reg-email',
      "' OR 1=1 --"
    );
  
    await page.fill(
      '#reg-name',
      'SQL Test'
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
  
    await expect(page).toHaveURL(/auth/);
  });