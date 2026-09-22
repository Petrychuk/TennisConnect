import { test, expect } from '@playwright/test';
import { becomeOrganiser, createSeason, createSeries, seedPlayers, seedSession } from '../helpers/organiser';

/*
  Reports suite - known dataset, hand-verified expected numbers (see
  server/storage.ts getReportsData for the exact rules):

  Session 1 (2026-04-01): A, B, C, D all register and check in.
    -> registered 4, attended 4 (100%)
  Session 2 (2026-04-08): A, B register and check in; C registers but
  does NOT check in; D doesn't register at all.
    -> registered 3, attended 2 (67%, rounded)

  Totals across both sessions:
    Unique Players   = 4 (A, B, C, D each had >=1 valid registration)
    Sessions Held    = 2
    Attendance Rate  = attended 6 / valid registrations 7 = 86% (rounded)
    Returning Players = attended >=2 sessions: A, B (2 of the 4 players
      who attended at least once) = 50%
*/

async function seedKnownReportsDataset(page: import('@playwright/test').Page) {
  const organiser = await becomeOrganiser(page);
  const [a, b, c, d] = await seedPlayers(page, 4);

  const season = await createSeason(page, {
    name: `Spring ${Date.now()}`,
    startDate: '2026-03-01',
    endDate: '2026-05-31',
  });
  const series = await createSeries(page, { seasonId: season.id, name: 'Wednesday Competition', format: 'social' });

  const session1 = await seedSession(page, {
    organizationId: organiser.organizationId,
    createdBy: organiser.id,
    title: 'Wednesday - Week 1',
    startAt: '2026-04-01T08:30:00.000Z',
    status: 'completed',
    seasonId: season.id,
    seriesId: series.id,
    registrations: [a, b, c, d].map((p) => ({ userId: p.id, checkedIn: true })),
    matches: [{ teamAIds: [a.id, b.id], teamBIds: [c.id, d.id], teamAGames: 6, teamBGames: 3 }],
  });

  const session2 = await seedSession(page, {
    organizationId: organiser.organizationId,
    createdBy: organiser.id,
    title: 'Wednesday - Week 2',
    startAt: '2026-04-08T08:30:00.000Z',
    status: 'completed',
    seasonId: season.id,
    seriesId: series.id,
    registrations: [
      { userId: a.id, checkedIn: true },
      { userId: b.id, checkedIn: true },
      { userId: c.id, checkedIn: false },
    ],
    matches: [{ teamAIds: [a.id, b.id], teamBIds: [c.id], teamAGames: 6, teamBGames: 1 }],
  });

  return { organiser, players: { a, b, c, d }, season, series, session1, session2 };
}

test.describe('Organiser Reports', () => {
  test('@smoke ORG-REPORT-004 ORG-REPORT-005 ORG-REPORT-006 ORG-REPORT-007 KPI calculations', async ({ page }) => {
    const { season, series } = await seedKnownReportsDataset(page);

    await page.goto('/organiser/reports');
    await page.getByTestId('organiser-reports-filter-season').click();
    await page.getByTestId(`organiser-reports-filter-season-${season.id}`).click();
    await page.getByTestId('organiser-reports-filter-series').click();
    await page.getByTestId(`organiser-reports-filter-series-${series.id}`).click();

    await expect(page.getByTestId('organiser-reports-kpi-unique-players-value')).toHaveText('4', { timeout: 15000 });
    await expect(page.getByTestId('organiser-reports-kpi-sessions-held-value')).toHaveText('2');
    await expect(page.getByTestId('organiser-reports-kpi-attendance-rate-value')).toHaveText('86%');
    await expect(page.getByTestId('organiser-reports-kpi-returning-players-value')).toHaveText('50%');
  });

  test('@smoke ORG-REPORT-003 ORG-REPORT-009 Series Performance reflects only the selected Series', async ({ page }) => {
    const { season, series } = await seedKnownReportsDataset(page);

    await page.goto('/organiser/reports');
    await page.getByTestId('organiser-reports-filter-season').click();
    await page.getByTestId(`organiser-reports-filter-season-${season.id}`).click();

    // "All Series" (default): the one real series shows up in the table
    // with the same totals as the KPIs above (it's the only data there is).
    await expect(page.getByTestId('organiser-reports-series-performance')).toBeVisible({ timeout: 15000 });
    const seriesRow = page.getByTestId(`organiser-reports-series-row-${series.id}`);
    await expect(seriesRow).toContainText('Wednesday Competition');
    await expect(seriesRow).toContainText('2'); // sessions
    await expect(seriesRow).toContainText('86%'); // attendance
    await expect(seriesRow).toContainText('50%'); // returning
  });

  test('ORG-REPORT-010 Series Performance drill-down switches to Session Performance', async ({ page }) => {
    const { season, series, session1, session2 } = await seedKnownReportsDataset(page);

    await page.goto('/organiser/reports');
    await page.getByTestId('organiser-reports-filter-season').click();
    await page.getByTestId(`organiser-reports-filter-season-${season.id}`).click();

    await expect(page.getByTestId(`organiser-reports-series-row-${series.id}`)).toBeVisible({ timeout: 15000 });
    await page.getByTestId(`organiser-reports-series-row-${series.id}`).click();

    // Global Series filter is now Wednesday Competition...
    await expect(page.getByTestId('organiser-reports-clear-series')).toBeVisible();

    // ...and the report switches from Series Performance to Session
    // Performance for just that series' two sessions.
    await expect(page.getByTestId('organiser-reports-session-performance')).toBeVisible();
    const row1 = page.getByTestId(`organiser-reports-session-row-${session1.id}`);
    const row2 = page.getByTestId(`organiser-reports-session-row-${session2.id}`);
    await expect(row1).toContainText('100%'); // 4 registered, 4 attended
    await expect(row2).toContainText('67%'); // 3 registered, 2 attended

    // "Clear filter" returns to Series Performance / All Series.
    await page.getByTestId('organiser-reports-clear-series').click();
    await expect(page.getByTestId('organiser-reports-series-performance')).toBeVisible();
  });

  test('ORG-REPORT-012 Reports empty state for a brand new organiser', async ({ page }) => {
    await becomeOrganiser(page);

    await page.goto('/organiser/reports');

    await expect(page.getByTestId('organiser-reports-empty')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Not enough data yet')).toBeVisible();

    // No zero-filled charts/KPIs pretending there's real data.
    await expect(page.getByTestId('organiser-reports-kpis')).toHaveCount(0);
    await expect(page.getByTestId('organiser-reports-participation-chart')).toHaveCount(0);
  });
});
