import { test, expect, type Page, type Route } from '@playwright/test';
import { becomeOrganiser } from '../helpers/organiser';

/*
  Organiser dashboard states (docs/organiser-hub/DASHBOARD_STATES.md).
  A run-owned organiser with an organisation and no sessions is a "new
  organiser". Failures are simulated in the browser with page.route (the
  request is answered with a 500 before it reaches the server), so nothing
  here writes anything beyond what becomeOrganiser() already creates.
*/

const SESSIONS = '**/api/organizer/sessions/mine';
const STATS = '**/api/organizer/dashboard/stats';
// The dashboard asks for ?limit=8: a glob without the trailing ** never matched, so the request wasn't failed.
const ACTIVITY = '**/api/organizer/dashboard/activity**';

const fail500 = (route: Route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) });

async function openDashboard(page: Page) {
  await page.goto('/organiser');
  await expect(page.getByTestId('organiser-dashboard-content')).toBeVisible();
}

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
];

test.describe('Organiser dashboard states', () => {
  test('ORG-DASH-001 new organiser: welcome card with Create Session, no KPI row, no warning', async ({ page }) => {
    await becomeOrganiser(page);
    await openDashboard(page);

    // The separate KPI row was removed from Home (Organiser Hub Home layout story).
    await expect(page.getByTestId('organiser-stat-strip-live')).toHaveCount(0);

    await expect(page.getByTestId('organiser-dashboard-empty')).toBeVisible();
    await expect(page.getByTestId('organiser-dashboard-error')).toHaveCount(0);

    await page.getByTestId('organiser-dashboard-empty-create').click();
    await expect(page).toHaveURL(/\/organiser\/sessions\/new/);
  });

  test('ORG-DASH-002 sessions request fails: warning with Try again, recovers on retry', async ({ page }) => {
    await becomeOrganiser(page);
    await page.route(SESSIONS, fail500);
    await openDashboard(page);

    const warning = page.getByTestId('organiser-dashboard-error');
    await expect(warning).toBeVisible();
    await expect(page.getByTestId('organiser-dashboard-error-message')).toContainText('sessions');
    await expect(page.getByTestId('organiser-dashboard-error-message')).not.toContainText('player statistics');

    await expect(page.getByTestId('organiser-live-unavailable')).toBeVisible();
    await expect(page.getByTestId('organiser-dashboard-empty')).toHaveCount(0); // a failure is not "new organiser"

    await page.unroute(SESSIONS);
    await page.getByTestId('organiser-dashboard-retry').click();
    await expect(warning).toHaveCount(0);
    await expect(page.getByTestId('organiser-dashboard-empty')).toBeVisible();
  });

  test('ORG-DASH-003 stats request failing does not affect Home (it no longer reads dashboard stats)', async ({ page }) => {
    await becomeOrganiser(page);
    await page.route(STATS, fail500);
    await openDashboard(page);

    await expect(page.getByTestId('organiser-dashboard-error')).toHaveCount(0);
    await expect(page.getByTestId('organiser-dashboard-empty')).toBeVisible();
  });

  test('ORG-DASH-004 loading: skeletons while the sessions request is pending, then real values', async ({ page }) => {
    await becomeOrganiser(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(SESSIONS, async (route) => {
      await gate;
      await route.continue();
    });
    await openDashboard(page);

    await expect(page.getByTestId('organiser-live-skeleton')).toBeVisible();
    await expect(page.getByTestId('organiser-dashboard-error')).toHaveCount(0); // loading is not a failure

    release();
    await expect(page.getByTestId('organiser-live-skeleton')).toHaveCount(0);
    await expect(page.getByTestId('organiser-dashboard-empty')).toBeVisible();
  });

  test('ORG-DASH-005 sessions and activity requests fail: one compact warning naming both, nothing invented', async ({ page }) => {
    await becomeOrganiser(page);
    await page.route(SESSIONS, fail500);
    await page.route(ACTIVITY, fail500);
    await openDashboard(page);

    await expect(page.getByTestId('organiser-dashboard-error')).toHaveCount(1);
    await expect(page.getByTestId('organiser-dashboard-error-message')).toContainText('sessions and recent activity');
    await expect(page.getByTestId('organiser-live-unavailable')).toBeVisible();
  });

  test('ORG-DASH-006 failure state at all six viewports: no horizontal overflow, 44px Try again', async ({ page }) => {
    await becomeOrganiser(page);
    await page.route(SESSIONS, fail500);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openDashboard(page);
      await expect(page.getByTestId('organiser-dashboard-error')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${vp.name}: horizontal overflow`).toBeLessThanOrEqual(0);
      const box = await page.getByTestId('organiser-dashboard-retry').boundingBox();
      expect(box?.height ?? 0, `${vp.name}: Try again height`).toBeGreaterThanOrEqual(44);
    }
  });
});
