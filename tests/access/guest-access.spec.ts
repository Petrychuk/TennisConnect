import { test, expect } from '@playwright/test';
import {
    registerPlayer,
    registerCoach,
    login,
    logout,
  } from '../helpers/auth';
  
  import {
    completePlayerProfile,
    completeCoachProfile,
  } from '../helpers/profile';

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
      page.getByText(/admin access required/i)
    ).toBeVisible();
  
  });

  test('ACCESS-004 Coach → /admin', async ({ page }) => {

    await login(
        page,
        TEST_USERS.coach.email,
        TEST_USERS.coach.password
        );
  
    await page.goto('/admin');
  
    await expect(
      page.getByText(/admin access required/i)
    ).toBeVisible();
  
  });

