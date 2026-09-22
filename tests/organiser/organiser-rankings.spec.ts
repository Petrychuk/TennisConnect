import { test, expect } from '@playwright/test';
import { becomeOrganiser, createSeason, createSeries, seedPlayers, seedSession } from '../helpers/organiser';

/*
  Rankings suite - points math reference (see
  server/services/liveEngine.ts RANKING_POINTS_PER_*):
    win  = 25 pts + 1 pt per game won
    loss = 0 pts   + 1 pt per game won
  So a 6-3 win is 25+6=31 for the winning pair, 0+3=3 for the losing
  pair. Every seeded match below is deliberately picked so the expected
  totals are easy to hand-verify from that formula.

  Sessions are seeded via /api/test-hooks/seed-session (already
  "completed" with confirmed match results) rather than played out
  through TC Live's real UI - see tests/helpers/organiser.ts and that
  hook's own comment for why. What's under test here is what Rankings
  DOES with confirmed results, not whether TC Live's live-scoring flow
  itself works (covered separately).
*/

test.describe('Organiser Rankings', () => {
  test('@smoke ORG-RANK-002 ORG-RANK-003 Completed sessions accumulate points in the Series Ranking', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [a, b, c, d] = await seedPlayers(page, 4);

    const season = await createSeason(page, {
      name: `Spring ${Date.now()}`,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
    });
    const series = await createSeries(page, { seasonId: season.id, name: 'Wednesday Competition', format: 'social' });

    const roster = [a, b, c, d].map((p) => ({ userId: p.id, checkedIn: true }));

    // Week 1: A+B beat C+D 6-3 -> A/B get 31 each, C/D get 3 each.
    await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: 'Wednesday - Week 1',
      startAt: '2026-04-01T08:30:00.000Z',
      status: 'completed',
      seasonId: season.id,
      seriesId: series.id,
      registrations: roster,
      matches: [{ teamAIds: [a.id, b.id], teamBIds: [c.id, d.id], teamAGames: 6, teamBGames: 3 }],
    });

    // Week 2: C+D beat A+B 6-2 -> C/D get 31 each, A/B get 2 each.
    await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: 'Wednesday - Week 2',
      startAt: '2026-04-08T08:30:00.000Z',
      status: 'completed',
      seasonId: season.id,
      seriesId: series.id,
      registrations: roster,
      matches: [{ teamAIds: [c.id, d.id], teamBIds: [a.id, b.id], teamAGames: 6, teamBGames: 2 }],
    });

    // Totals: A/B = 31 + 2 = 33. C/D = 3 + 31 = 34.
    await page.goto('/organiser/rankings');
    await page.getByTestId('organiser-rankings-filter-season').click();
    await page.getByTestId(`organiser-rankings-filter-season-${season.id}`).click();
    await page.getByTestId('organiser-rankings-filter-series').click();
    await page.getByTestId(`organiser-rankings-filter-series-${series.id}`).click();

    const rowA = page.getByTestId(`organiser-rankings-row-${a.id}`);
    const rowC = page.getByTestId(`organiser-rankings-row-${c.id}`);
    await expect(rowA).toBeVisible({ timeout: 15000 });
    await expect(rowA).toContainText('33');
    await expect(rowC).toContainText('34');

    // Both played in both sessions - "Sessions" column reads 2.
    await expect(rowA).toContainText('2');
    await expect(rowC).toContainText('2');
  });

  test('ORG-RANK-004 Series Rankings remain completely independent', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [a, b, c, d] = await seedPlayers(page, 4);

    const season = await createSeason(page, {
      name: `Spring ${Date.now()}`,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
    });
    const tuesday = await createSeries(page, { seasonId: season.id, name: 'Tuesday Competition', format: 'social' });
    const wednesday = await createSeries(page, { seasonId: season.id, name: 'Wednesday Competition', format: 'social' });

    const roster = [a, b, c, d].map((p) => ({ userId: p.id, checkedIn: true }));

    // Tuesday: A+B blank C+D 6-0.
    await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: 'Tuesday - Week 1',
      startAt: '2026-04-07T08:30:00.000Z',
      status: 'completed',
      seasonId: season.id,
      seriesId: tuesday.id,
      registrations: roster,
      matches: [{ teamAIds: [a.id, b.id], teamBIds: [c.id, d.id], teamAGames: 6, teamBGames: 0 }],
    });

    // Wednesday: the exact reverse result - C+D blank A+B 6-0.
    await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: 'Wednesday - Week 1',
      startAt: '2026-04-08T08:30:00.000Z',
      status: 'completed',
      seasonId: season.id,
      seriesId: wednesday.id,
      registrations: roster,
      matches: [{ teamAIds: [c.id, d.id], teamBIds: [a.id, b.id], teamAGames: 6, teamBGames: 0 }],
    });

    await page.goto('/organiser/rankings');
    await page.getByTestId('organiser-rankings-filter-season').click();
    await page.getByTestId(`organiser-rankings-filter-season-${season.id}`).click();

    // Tuesday Ranking: A/B on 25+6=31, C/D on 0.
    await page.getByTestId('organiser-rankings-filter-series').click();
    await page.getByTestId(`organiser-rankings-filter-series-${tuesday.id}`).click();
    const tuesdayRowA = page.getByTestId(`organiser-rankings-row-${a.id}`);
    await expect(tuesdayRowA).toBeVisible({ timeout: 15000 });
    await expect(tuesdayRowA).toContainText('31');

    // Switch to Wednesday - this must show the OPPOSITE result. If
    // Tuesday's points had leaked in (summed, or the filter silently
    // not applied), A would still show 31 here too.
    await page.getByTestId('organiser-rankings-filter-series').click();
    await page.getByTestId(`organiser-rankings-filter-series-${wednesday.id}`).click();
    const wednesdayRowC = page.getByTestId(`organiser-rankings-row-${c.id}`);
    const wednesdayRowA = page.getByTestId(`organiser-rankings-row-${a.id}`);
    await expect(wednesdayRowC).toBeVisible({ timeout: 15000 });
    await expect(wednesdayRowC).toContainText('31');
    await expect(wednesdayRowA).not.toContainText('31');
  });

  test('@smoke ORG-RANK-006 ORG-RANK-007 ORG-RANK-008 Session Results vs accumulated Series Ranking', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [a, b, c, d] = await seedPlayers(page, 4);

    const season = await createSeason(page, {
      name: `Spring ${Date.now()}`,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
    });
    const series = await createSeries(page, { seasonId: season.id, name: 'Wednesday Competition', format: 'social' });
    const roster = [a, b, c, d].map((p) => ({ userId: p.id, checkedIn: true }));

    const session1 = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: 'Wednesday - Week 1',
      startAt: '2026-04-01T08:30:00.000Z',
      status: 'completed',
      seasonId: season.id,
      seriesId: series.id,
      registrations: roster,
      matches: [{ teamAIds: [a.id, b.id], teamBIds: [c.id, d.id], teamAGames: 6, teamBGames: 3 }],
    });

    await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: 'Wednesday - Week 2',
      startAt: '2026-04-08T08:30:00.000Z',
      status: 'completed',
      seasonId: season.id,
      seriesId: series.id,
      registrations: roster,
      matches: [{ teamAIds: [c.id, d.id], teamBIds: [a.id, b.id], teamAGames: 6, teamBGames: 2 }],
    });

    await page.goto('/organiser/rankings');
    await page.getByTestId('organiser-rankings-filter-season').click();
    await page.getByTestId(`organiser-rankings-filter-season-${season.id}`).click();
    await page.getByTestId('organiser-rankings-filter-series').click();
    await page.getByTestId(`organiser-rankings-filter-series-${series.id}`).click();

    // All Sessions: accumulated total for A is 31 + 2 = 33.
    await expect(page.getByTestId(`organiser-rankings-row-${a.id}`)).toContainText('33', { timeout: 15000 });

    // Select the individual first session...
    await page.getByTestId('organiser-rankings-filter-session').click();
    await page.getByTestId(`organiser-rankings-filter-session-${session1.id}`).click();

    // ...Session Results shows THAT session's own points (31 for A) -
    // never the accumulated season total - and the table itself
    // switches shape (a different testid entirely).
    await expect(page.getByTestId('organiser-rankings-session-results-table')).toBeVisible({ timeout: 15000 });
    const sessionRowA = page.getByTestId(`organiser-rankings-session-row-${a.id}`);
    await expect(sessionRowA).toContainText('31');
    await expect(sessionRowA).not.toContainText('33');

    // Switch back to All Sessions - accumulated Ranking restored.
    await page.getByTestId('organiser-rankings-filter-session').click();
    await page.getByTestId('organiser-rankings-filter-session-all').click();
    await expect(page.getByTestId('organiser-rankings-table')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`organiser-rankings-row-${a.id}`)).toContainText('33');
  });
});
