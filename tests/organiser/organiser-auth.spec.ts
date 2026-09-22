import { test, expect } from '@playwright/test';
import { registerPlayer } from '../helpers/auth';
import { becomeOrganiser } from '../helpers/organiser';

/*
  ORG-AUTH-001/002/003 - who can reach the Organiser Hub at all.
  Every other Organiser Hub suite assumes these hold, so this file has
  no dependency on anything else in tests/organiser/.

  Target page: /organiser (the Home dashboard, components/organiser/
  dashboard/organiser-dashboard.tsx) - it's the canonical "direct
  organiser URL" any of the other Hub pages would behave the same way
  for (isAuthenticated / isOrganizer are checked the same way on every
  Organiser Hub page).
*/

test('@smoke ORG-AUTH-001 Organiser can access Organiser Hub', async ({ page }) => {
  await becomeOrganiser(page);

  await page.goto('/organiser');

  await expect(page.getByTestId('organiser-dashboard')).toBeVisible({ timeout: 15000 });

  // Home / Sessions / Seasons & Series / Players / Rankings / Reports / Messages...
  for (const key of ['home', 'sessions', 'seasons', 'players', 'rankings', 'reports', 'messages']) {
    await expect(page.getByTestId(`organiser-sidebar-nav-${key}`)).toBeVisible();
  }

  // ...and Settings is not displayed (no page exists behind it yet -
  // see the commit that removed it from NAV_ITEMS).
  await expect(page.getByTestId('organiser-sidebar-nav-settings')).toHaveCount(0);
});

test('ORG-AUTH-002 Player cannot access Organiser Hub', async ({ page }) => {
  await registerPlayer(page);

  await page.goto('/organiser');

  // Stays on /organiser (no redirect) but shows the "not an organiser"
  // message instead of the real dashboard - see
  // organiser-dashboard.tsx's own !isOrganizer && !isAdmin branch.
  await expect(page.getByRole('heading', { name: 'Organiser access required' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('organiser-dashboard')).toHaveCount(0);
});

test('ORG-AUTH-003 Unauthenticated user cannot access Organiser Hub', async ({ page }) => {
  await page.goto('/organiser');

  await expect(page).toHaveURL(/\/auth/, { timeout: 15000 });
  await expect(page.getByTestId('login-email')).toBeVisible();
});
