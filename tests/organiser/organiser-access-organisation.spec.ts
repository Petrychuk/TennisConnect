import { test, expect } from '@playwright/test';
import { becomeOrganiser } from '../helpers/organiser';
import { inDays, openWorkspaceTab, seedHubSession } from '../helpers/organiser-hub';

/*
  Organiser Hub - access on navigation, and Your Organisation validation
  (automation gap report, P0).

  Test plan
  - Risk: a signed-out session still sees Hub pages; a refresh or
    back/forward drops the organiser onto an error or the wrong page; an
    invalid organisation name is saved.
  - Fixtures: run-owned organiser (becomeOrganiser). ORG-ACC-002 also
    seeds one published session (inDays(3)).
  - Writes: ORG-ORGN-001 sends nothing; it only checks that a refused save
    changes nothing. The organisation is the run-owned one.
  - Cleanup: run-scoped teardown removes the organiser and session.
  - Assertions: URL, page testids and the organisation read back from the
    API (GET /api/organizer/organizations/me). No retries added.
  - Run: npm run test:e2e -- tests/organiser/organiser-access-organisation.spec.ts

  Staging / local only (phase hub-msg-admin).
*/

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Organiser Hub - access and organisation', () => {
  test('ORG-ACC-001 A signed-out browser is sent to sign-in with a return path', async ({ page, context }) => {
    await becomeOrganiser(page);
    await context.clearCookies();

    await page.goto('/organiser/sessions');
    await expect(page).toHaveURL(/\/auth\?returnTo=/, { timeout: 15_000 });
    await expect(page.getByTestId('organiser-sessions-page')).toHaveCount(0);
  });

  test('ORG-ACC-002 A refresh keeps the organiser on the same session tab', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const session = await seedHubSession(page, organiser, {
      title: `Refresh ${Date.now()}`,
      startAt: inDays(3),
      status: 'published',
      type: 'social',
    });

    await openWorkspaceTab(page, session.id, 'players');
    await expect(page.getByTestId('organiser-session-players-tab')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/organiser/sessions/${session.id}\\?tab=players`));
    await expect(page.getByTestId('organiser-session-players-tab')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('organiser-session-workspace-tab-players')).toHaveAttribute('data-state', 'active');
  });

  test('ORG-ACC-003 Back and forward between Hub pages show each page without an error', async ({ page }) => {
    await becomeOrganiser(page);

    await page.goto('/organiser');
    await expect(page.getByTestId('organiser-dashboard')).toBeVisible({ timeout: 15_000 });
    await page.goto('/organiser/sessions');
    await expect(page.getByTestId('organiser-sessions-page')).toBeVisible({ timeout: 15_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/organiser$/);
    await expect(page.getByTestId('organiser-dashboard')).toBeVisible({ timeout: 15_000 });

    await page.goForward();
    await expect(page).toHaveURL(/\/organiser\/sessions$/);
    await expect(page.getByTestId('organiser-sessions-page')).toBeVisible({ timeout: 15_000 });
  });

  test('ORG-ORGN-001 A one-letter organisation name is refused and nothing is saved', async ({ page }) => {
    const organiser = await becomeOrganiser(page);

    await page.goto('/organiser/organisation');
    const name = page.getByTestId('organiser-organisation-name');
    await expect(name).toHaveValue(organiser.organizationName, { timeout: 15_000 });

    await name.fill('A');
    await page.getByTestId('organiser-organisation-save').click();
    await expect(page.locator('#org-name-error')).toBeVisible();
    await expect(page.locator('#org-name-error')).toContainText('at least 2 characters');

    // Nothing was sent: the stored name is still the one the organiser started with.
    const res = await page.request.get('/api/organizer/organizations/me');
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).name).toBe(organiser.organizationName);
  });
});
