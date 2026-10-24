import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../helpers/auth';
import { uniqueTestEmail } from '../fixtures/test-users';

test('AUTH-006 Forgot Password Success', async ({ page }) => {

    await page.goto('/auth');
    await dismissCookieBanner(page);
  
    await page.getByTestId('forgot-password-link').click();
  
    await page.getByTestId('forgot-email-input')
      // Run-owned address that was never registered: the server answers
      // with the same generic success, and no reset token is created for
      // anyone (previously a hard-coded player@test.com).
      .fill(uniqueTestEmail('forgot'));
  
    await page.getByTestId('send-reset-link-button')
      .click();
  
    await expect(
        page.getByTestId('forgot-password-success')
      ).toBeVisible();
      
    await expect(
        page.getByTestId('back-to-sign-in')
      ).toBeVisible();
  
  });
 
  test('AUTH-007 Forgot Password Empty Email', async ({ page }) => {

    await page.goto('/auth');
    await dismissCookieBanner(page);
  
    await page.getByTestId('forgot-password-link').click();
  
    await page.getByTestId('send-reset-link-button')
      .click();
  
      const valid = await page
      .getByTestId('forgot-email-input')
      .evaluate(
        el => (el as HTMLInputElement).checkValidity()
      );
    
    expect(valid).toBe(false);
  
  });

  test('AUTH-008 Invalid Reset Token', async ({ page }) => {

    await page.goto(
      '/reset-password?token=123'
    );
  
    await expect(
      page.getByRole('heading', {
        name: /invalid reset link/i,
      })
    ).toBeVisible();
  
  });
  
  /* test('AUTH-009 Password Too Short', async ({ page }) => {

    await page.goto(
      '/reset-password?token=test-token'
    );
  
    await page.fill(
      '[name="password"]',
      '123'
    );
  
    await page.fill(
      '[name="confirmPassword"]',
      '123'
    );
  
    await page.getByRole('button', {
      name: /reset password/i,
    }).click();
  
    await expect(
      page.getByText(
        /password must be at least 6 characters/i
      )
    ).toBeVisible();
  
  });
 
  test('AUTH-010 Missing Reset Token', async ({ page }) => {

    await page.goto('/reset-password');
  
    await expect(
      page.getByText(/token is required|invalid/i)
    ).toBeVisible();
  
  }); */