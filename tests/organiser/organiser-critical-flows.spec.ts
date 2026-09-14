import { test, expect } from '@playwright/test';
import { becomeOrganiser, createSeason, createSeries, seedPlayers, seedSession } from '../helpers/organiser';

/*
  Cross-feature flows - the ones the regression plan calls out as more
  valuable than a pile of single-page tests, because they prove data
  created in one part of the Organiser Hub is correctly reflected in
  another, not just that each page renders in isolation.

  Note on scope: "Register Players -> Check-in Players -> Run/Complete
  Session -> Submit Results" is seeded directly via
  /api/test-hooks/seed-session rather than driven through TC Live's
  real UI (courts, round generation, live score entry) - that flow is
  its own, separately-testable surface. What ORG-FLOW-001 verifies here
  is the part the regression plan's diagram is actually about: that a
  session with confirmed results correctly propagates into Rankings AND
  Reports at the same time, from the same underlying data.
*/

test('@smoke ORG-FLOW-001 Complete recurring Series lifecycle: Session -> Ranking + Reports', async ({ page }) => {
  const organiser = await becomeOrganiser(page);
  const [a, b, c, d] = await seedPlayers(page, 4);

  const season = await createSeason(page, {
    name: `Spring ${Date.now()}`,
    startDate: '2026-03-01',
    endDate: '2026-05-31',
  });
  const series = await createSeries(page, { seasonId: season.id, name: 'Wednesday Competition', format: 'social' });

  // A+B beat C+D 6-3: A/B get 25+6=31 pts, C/D get 0+3=3 pts.
  const session = await seedSession(page, {
    organizationId: organiser.organizationId,
    createdBy: organiser.id,
    title: 'Wednesday Competition - Week 1',
    startAt: '2026-04-01T08:30:00.000Z',
    status: 'completed',
    seasonId: season.id,
    seriesId: series.id,
    registrations: [a, b, c, d].map((p) => ({ userId: p.id, checkedIn: true })),
    matches: [{ teamAIds: [a.id, b.id], teamBIds: [c.id, d.id], teamAGames: 6, teamBGames: 3 }],
  });
  expect(session.registrationIds).toHaveLength(4);
  expect(session.matchIds).toHaveLength(1);

  // ---------- Ranking recalculated ----------
  await page.goto('/organiser/rankings');
  await page.getByTestId('organiser-rankings-filter-season').click();
  await page.getByTestId(`organiser-rankings-filter-season-${season.id}`).click();
  await page.getByTestId('organiser-rankings-filter-series').click();
  await page.getByTestId(`organiser-rankings-filter-series-${series.id}`).click();

  await expect(page.getByTestId(`organiser-rankings-row-${a.id}`)).toContainText('31', { timeout: 15000 });
  await expect(page.getByTestId(`organiser-rankings-row-${c.id}`)).toContainText('3');

  // ---------- Reports updated from the same session ----------
  await page.goto('/organiser/reports');
  await page.getByTestId('organiser-reports-filter-season').click();
  await page.getByTestId(`organiser-reports-filter-season-${season.id}`).click();
  await page.getByTestId('organiser-reports-filter-series').click();
  await page.getByTestId(`organiser-reports-filter-series-${series.id}`).click();

  await expect(page.getByTestId('organiser-reports-kpi-unique-players-value')).toHaveText('4', { timeout: 15000 });
  await expect(page.getByTestId('organiser-reports-kpi-sessions-held-value')).toHaveText('1');
  await expect(page.getByTestId('organiser-reports-kpi-attendance-rate-value')).toHaveText('100%');
});

test('ORG-FLOW-003 Casual Session lifecycle: no Season/Series, no Ranking, still counted in Reports', async ({ page }) => {
  const organiser = await becomeOrganiser(page);
  const [a, b] = await seedPlayers(page, 2);

  // Deliberately no seasonId/seriesId - a casual, ranking-opted-out
  // session (spec §13: "No Ranking" is just never getting a seriesId).
  // startAt is "yesterday" (not a fixed date) so this lands inside
  // "Last 30 Days" whenever the suite actually runs.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await seedSession(page, {
    organizationId: organiser.organizationId,
    createdBy: organiser.id,
    title: 'Sunday Casual Social Tennis',
    startAt: yesterday,
    status: 'completed',
    registrations: [
      { userId: a.id, checkedIn: true },
      { userId: b.id, checkedIn: true },
    ],
  });

  // ---------- Reports: counted normally ----------
  await page.goto('/organiser/reports');
  await page.getByTestId('organiser-reports-filter-period').click();
  await page.getByTestId('organiser-reports-filter-period-last_30_days').click();

  await expect(page.getByTestId('organiser-reports-kpi-sessions-held-value')).toHaveText('1', { timeout: 15000 });
  await expect(page.getByTestId('organiser-reports-kpi-unique-players-value')).toHaveText('2');

  // A casual session was never attached to any Series, so "All Series"
  // Series Performance has nothing to group it under.
  await expect(page.getByTestId('organiser-reports-series-performance')).toContainText(
    'No sessions attached to a series in this period yet.'
  );

  // ---------- Rankings: nothing to show at all - the organiser has no
  // Series yet, since this casual session never created or needed one.
  await page.goto('/organiser/rankings');
  await expect(page.getByTestId('organiser-rankings-no-seasons')).toBeVisible({ timeout: 15000 });
});
