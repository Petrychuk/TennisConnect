import { test, expect } from '@playwright/test';

test('SEC-003 Script Tags', async ({ page }) => {

    await page.goto('/auth');
  
    await page.getByText('Sign Up').click();
  
    await page.fill(
      '#reg-name',
      '<img src=x onerror=alert(1)>'
    );
  
    await page.fill(
      '#reg-email',
      'script@test.com'
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
  
    await expect(page).not.toHaveURL(/player/);
  
  });

  test('SEC-004 Long Input', async ({ page }) => {

    const longText = 'A'.repeat(5000);
  
    await page.goto('/auth');
  
    await page.getByText('Sign Up').click();
  
    await page.fill(
      '#reg-name',
      longText
    );
  
    await expect(
      page.locator('#reg-name')
    ).toBeVisible();
  
  });

  test('SEC-005 Special Characters', async ({ page }) => {

    await page.goto('/auth');
  
    await page.getByText('Sign Up').click();
  
    await page.fill(
      '#reg-name',
      `!@#$%^&*()_+{}[]:;"'<>,.?/`
    );
  
    await expect(
      page.locator('#reg-name')
    ).toBeVisible();
  
  });