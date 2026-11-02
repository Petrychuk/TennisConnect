import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { becomeOrganiser, seedPlayers } from '../helpers/organiser';
import { inDays, openWorkspaceTab, seedHubSession } from '../helpers/organiser-hub';

/*
  Session Workspace (Organiser Hub Phase 2): real rounds and results,
  loading / empty / error states, policies, coaching navigation, and
  where Live is offered.

  Staging / local only (phase hub-msg-admin). Run-owned organiser,
  players and sessions (seed-session: round 1, confirmed matches on
  "Court 1"). Read-only apart from the seeding; the error state is
  produced by failing the one rounds request in this browser only
  (page.route), never on the server.
*/

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Session Workspace', () => {
  test('ORG-WS-001 Rounds and Results show the stored rounds, scores and standings; results export', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [a, b, c, d] = await seedPlayers(page, 4);
    const session = await seedHubSession(page, organiser, {
      title: `Rounds ${Date.now()}`,
      startAt: inDays(-1),
      status: 'completed',
      type: 'americano',
      registrations: [a, b, c, d].map((p) => ({ userId: p.id, checkedIn: true })),
      matches: [{ teamAIds: [a.id, b.id], teamBIds: [c.id, d.id], teamAGames: 6, teamBGames: 4 }],
    });

    // The API first: one round, one confirmed match with these teams.
    const rounds = await (await page.request.get(`/api/organizer/sessions/${session.id}/rounds`)).json();
    expect(rounds).toHaveLength(1);
    expect(rounds[0].matches).toHaveLength(1);

    await openWorkspaceTab(page, session.id, 'rounds');
    const round = page.getByTestId('organiser-session-round-1');
    await expect(round).toBeVisible({ timeout: 15_000 });
    await expect(round).toContainText('Completed');
    const match = page.getByTestId(`organiser-session-match-${session.matchIds[0]}`);
    await expect(match).toContainText('Court 1');
    await expect(match).toContainText(`${a.name} & ${b.name}`);
    await expect(match).toContainText(`${c.name} & ${d.name}`);
    await expect(page.getByTestId(`organiser-session-match-${session.matchIds[0]}-status`)).toHaveText('Final');
    await expect(match).toContainText('6');
    await expect(match).toContainText('4');
    await expect(page.getByTestId('organiser-session-round-2')).toHaveCount(0); // no placeholder rounds

    // Results: standings from the same match, and a real CSV.
    await page.getByTestId('organiser-session-workspace-tab-results').click();
    await expect(page.getByTestId('organiser-session-results-1')).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('organiser-session-results-export').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/-results\.csv$/);
    const csv = readFileSync(await download.path(), 'utf8');
    expect(csv.split('\n')[0]).toBe('"Position","Player","Played","Won","Drawn","Lost","Games won","Games lost"');
    expect(csv).toContain(a.name);
    expect(csv.split('\n')).toHaveLength(5); // header + 4 players
  });

  test('ORG-WS-002 Rounds: empty and error states', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const session = await seedHubSession(page, organiser, { title: `No rounds ${Date.now()}`, startAt: inDays(3), status: 'published', type: 'social' });

    await openWorkspaceTab(page, session.id, 'rounds');
    await expect(page.getByTestId('organiser-session-rounds-empty')).toBeVisible({ timeout: 15_000 });
    // "Open Live" only where TC Live runs for this session (TC_LIVE_ENABLED, via
    // GET /api/organizer/features; seeded sessions are never internal).
    const { live } = await (await page.request.get('/api/organizer/features')).json();
    await expect(page.getByTestId('organiser-session-rounds-open-live')).toHaveCount(live === 'on' ? 1 : 0);

    // A failed load shows an error with a retry, not an empty list.
    let fail = true;
    await page.route(`**/api/organizer/sessions/${session.id}/rounds`, (route) =>
      fail ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"test failure"}' }) : route.continue(),
    );
    await page.reload();
    await expect(page.getByTestId('organiser-session-rounds-retry')).toBeVisible({ timeout: 30_000 });
    fail = false;
    await page.getByTestId('organiser-session-rounds-retry').click();
    await expect(page.getByTestId('organiser-session-rounds-empty')).toBeVisible({ timeout: 15_000 });
  });

  test('ORG-WS-003 Coaching & Fitness: no Rounds, Results or Live; Format tab says why', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const session = await seedHubSession(page, organiser, { title: `Clinic ${Date.now()}`, startAt: inDays(2), status: 'published', type: 'coaching-clinic' });

    await openWorkspaceTab(page, session.id, 'overview');
    await expect(page.getByTestId('organiser-session-workspace-tab-players')).toBeVisible();
    await expect(page.getByTestId('organiser-session-workspace-tab-rounds')).toHaveCount(0);
    await expect(page.getByTestId('organiser-session-workspace-tab-results')).toHaveCount(0);
    await expect(page.getByTestId('organiser-session-primary-action')).not.toHaveText(/Live/);

    // A deep link to a tab this session doesn't have stays on Overview.
    await page.goto(`/organiser/sessions/${session.id}?tab=rounds`);
    await expect(page.getByTestId('organiser-session-workspace-tab-overview')).toHaveAttribute('data-state', 'active', { timeout: 15_000 });

    await page.getByTestId('organiser-session-workspace-tab-format').click();
    await expect(page.getByTestId('organiser-session-format-tab')).toContainText(/coach-led/i);
  });

  test('ORG-WS-004 Live entry points follow the environment and the category', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const social = await seedHubSession(page, organiser, { title: `Live social ${Date.now()}`, startAt: inDays(1), status: 'published', type: 'social' });
    // TC_LIVE_ENABLED decides (GET /api/organizer/features); a seeded session is never internal.
    const { live } = await (await page.request.get('/api/organizer/features')).json();
    const liveHere = live === 'on';

    await openWorkspaceTab(page, social.id, 'overview');
    const primary = page.getByTestId('organiser-session-primary-action');
    await expect(primary).toBeVisible();
    if (liveHere) {
      await expect(primary).toHaveText(/Enter Live Session/);
    } else {
      await expect(primary).toHaveText(/Manage Players/);
      // And the Live route itself is closed for this session.
      const res = await page.request.post(`/api/organizer/sessions/${social.id}/go-live`, { failOnStatusCode: false });
      expect(res.status()).toBe(404);
    }
  });

  test('ORG-WS-005 Policies show on the Format tab, empty state when there are none', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const withPolicies = await seedHubSession(
      page,
      organiser,
      { title: `Policies ${Date.now()}`, startAt: inDays(4), status: 'published', type: 'league' },
      { refundPolicy: 'No refunds within 24 hours', latePolicy: 'Arrive 10 minutes early' },
    );
    const without = await seedHubSession(page, organiser, { title: `No policies ${Date.now()}`, startAt: inDays(4), status: 'published', type: 'league' });

    await openWorkspaceTab(page, withPolicies.id, 'format');
    const card = page.getByTestId('organiser-session-format-policies');
    await expect(card).toContainText('No refunds within 24 hours', { timeout: 15_000 });
    await expect(card).toContainText('Arrive 10 minutes early');

    await openWorkspaceTab(page, without.id, 'format');
    await expect(page.getByTestId('organiser-session-format-policies')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('organiser-session-policies')).toHaveCount(0);
  });
});
