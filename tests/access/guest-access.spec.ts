import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth'; 
import { TEST_USERS } from '../fixtures/test-users'; 

test('ACCESS-001 Guest → /messages', async ({ page }) => {

    await page.goto('/messages');
  
    await expect(
      page.getByText(/sign in to view messages/i)
    ).toBeVisible();
  
  });

  test('ACCESS-002 Guest → /admin', async ({ page }) => {

    await page.goto('/admin');
  
    await expect(
      page.getByText(/admin access required/i)
    ).toBeVisible();
  
  });

  test('ACCESS-003 Player → /admin', async ({ page }) => {

    await login(
        page,
        TEST_USERS.player.email,
        TEST_USERS.player.password
        );
  
    await page.goto('/admin');
  
    await expect(
      page.getByRole('heading', { name: /admin access required/i })
    ).toBeVisible();
    await expect(page.getByText("You don't have admin privileges.")).toBeVisible();

    // The page is only the visible half - the admin API itself must refuse
    // this signed-in non-admin too (server/requireAuth.ts requireAdmin).
    const api = await page.request.get('/api/admin/users', { failOnStatusCode: false });
    expect(api.status()).toBe(403);
  
  });

  test('ACCESS-004 Coach → /admin', async ({ page }) => {

    await login(
        page,
        TEST_USERS.coach.email,
        TEST_USERS.coach.password
        );
  
    await page.goto('/admin');
  
    await expect(
      page.getByRole('heading', { name: /admin access required/i })
    ).toBeVisible();
    await expect(page.getByText("You don't have admin privileges.")).toBeVisible();

    // The page is only the visible half - the admin API itself must refuse
    // this signed-in non-admin too (server/requireAuth.ts requireAdmin).
    const api = await page.request.get('/api/admin/users', { failOnStatusCode: false });
    expect(api.status()).toBe(403);
  
  });

