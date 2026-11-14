import { test, expect, type Page } from '@playwright/test';
import { becomeOrganiser, seedPlayers } from '../helpers/organiser';
import { getSession, inDays, secondOrganiser, seedHubSession, sessionRegistrations } from '../helpers/organiser-hub';
import {
  allRounds,
  apiGenerate,
  apiGoLive,
  apiScore,
  currentRound,
  expectNoHorizontalOverflow,
  liveMode,
  openLive,
  requireLiveOn,
  seedLiveSession,
  sessionStatus,
  uiScore,
} from '../helpers/live';

/*
  TC Live v1 - Social Play singles & doubles, end to end (Staging / local).

  Needs TC_LIVE_ENABLED=true on the target server (LIVE-015 needs it off).
  Run-owned organisers, players and sessions (seed-session + the
  organiser's own API for match format and courts), cleaned up by the
  run-scoped teardown. The only messages sent go to run-owned players.
  ORG-FLOW / ORG-RANK already cover results feeding Rankings and Reports;
  this suite covers the Live engine itself.
*/

test.use({ viewport: { width: 1440, height: 900 } });

function dateInput(days: number): string {
  const d = new Date(Date.now() + days * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function setUp(page: Page, options: Parameters<typeof seedLiveSession>[2]) {
  const organiser = await becomeOrganiser(page);
  await requireLiveOn(page);
  return { organiser, ...(await seedLiveSession(page, organiser, options)) };
}

test.describe('TC Live v1', () => {
  test('LIVE-001 Create a Singles session for Live in the wizard (format and courts saved)', async ({ page }) => {
    await becomeOrganiser(page);
    await requireLiveOn(page);
    const title = `Live singles ${Date.now()}`;
    await page.goto('/organiser/sessions/new');
    await page.getByTestId('organiser-wizard-session-category-social-play').click();
    await page.getByTestId('organiser-wizard-type-social').click();
    await page.getByTestId('organiser-wizard-next-bottom').click();
    await page.getByTestId('organiser-wizard-session-name').fill(title);
    await page.getByTestId('organiser-wizard-session-venue').fill('Court Complex');
    await page.getByTestId('organiser-wizard-date').fill(dateInput(7));
    await page.getByTestId('organiser-wizard-session-courts').fill('2');
    await page.getByTestId('organiser-wizard-next-bottom').click();
    await page.getByTestId('organiser-wizard-match-type-singles').click();
    await page.getByTestId('organiser-wizard-save-draft-bottom').click();
    await expect(page.getByText('Session saved as draft').first()).toBeVisible({ timeout: 15_000 });

    const mine = (await (await page.request.get('/api/organizer/sessions/mine')).json()) as { id: string; title: string }[];
    const created = mine.find((s) => s.title === title)!;
    const saved = await getSession(page, created.id);
    expect(saved.matchMode).toBe('singles');
    expect((saved as any).courtsCount).toBe(2);
    expect(saved.status).toBe('draft');
    // A draft can't go live.
    const goLive = await page.request.post(`/api/organizer/sessions/${created.id}/go-live`, { failOnStatusCode: false });
    expect(goLive.status()).toBe(400);
    expect((await goLive.json()).message).toMatch(/published first/);
  });

  test('LIVE-002 Check-in: registered players only, through the Live screen', async ({ page }) => {
    const { sessionId, registrationIds } = await setUp(page, { mode: 'singles', courts: 1, players: 3, checkedIn: 0 });
    // Move the third player to the waiting list: no longer checkable.
    await page.request.post(`/api/organizer/sessions/${sessionId}/registrations/${registrationIds[2]}/waitlist`);

    await openLive(page, sessionId);
    await expect(page.getByTestId('organiser-session-live-go-live')).toBeDisabled();
    await expect(page.getByTestId('organiser-session-live-go-live-blocker')).toContainText('Singles needs at least 2');
    for (const id of registrationIds.slice(0, 2)) {
      await page.getByTestId(`organiser-session-live-checkin-row-${id}-button`).click();
      await expect(page.getByTestId(`organiser-session-live-checkin-row-${id}-done`)).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByTestId(`organiser-session-live-checkin-row-${registrationIds[2]}`)).toHaveCount(0);

    const regs = await sessionRegistrations(page, sessionId);
    expect(regs.filter((r) => r.checkedInAt).map((r) => r.id).sort()).toEqual(registrationIds.slice(0, 2).sort());
    const waitlisted = await page.request.post(`/api/organizer/sessions/${sessionId}/checkin/${registrationIds[2]}`, { failOnStatusCode: false });
    expect(waitlisted.status()).toBe(400);
    // Checking in twice keeps the first time.
    const first = regs.find((r) => r.id === registrationIds[0])!.checkedInAt;
    await page.request.post(`/api/organizer/sessions/${sessionId}/checkin/${registrationIds[0]}`);
    expect((await sessionRegistrations(page, sessionId)).find((r) => r.id === registrationIds[0])!.checkedInAt).toBe(first);
  });

  test('LIVE-003 Go Live from the Live screen; a repeated Go Live is harmless', async ({ page }) => {
    const { sessionId } = await setUp(page, { mode: 'singles', courts: 1, players: 2 });
    await openLive(page, sessionId);
    await page.getByTestId('organiser-session-live-go-live').click();
    await expect(page.getByTestId('organiser-session-live-badge')).toHaveText(/LIVE/, { timeout: 15_000 });
    expect(await sessionStatus(page, sessionId)).toBe('live');
    const again = await page.request.post(`/api/organizer/sessions/${sessionId}/go-live`);
    expect(again.status()).toBe(200);
    expect(await sessionStatus(page, sessionId)).toBe('live');
  });

  test('LIVE-004 Round 1 puts players on courts; the rest rest', async ({ page }) => {
    const { sessionId, players } = await setUp(page, { mode: 'singles', courts: 2, players: 5 });
    await apiGoLive(page, sessionId);
    await openLive(page, sessionId);
    await page.getByTestId('organiser-session-live-generate-round').click();
    await expect(page.getByTestId('organiser-session-live-courts')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('organiser-session-live-round-status')).toContainText('1 resting');

    const round = (await currentRound(page, sessionId))!;
    expect(round.round.roundNumber).toBe(1);
    expect(round.matches.map((m) => m.courtLabel).sort()).toEqual(['Court 1', 'Court 2']);
    const onCourt = round.matches.flatMap((m) => [...m.teamAIds, ...m.teamBIds]);
    expect(new Set(onCourt).size).toBe(4);
    expect(round.round.restingPlayerIds).toHaveLength(1);
    expect(players.map((p) => p.id)).toEqual(expect.arrayContaining([...onCourt, ...round.round.restingPlayerIds!]));
    for (const m of round.matches) await expect(page.getByTestId(`organiser-session-live-match-${m.id}`)).toBeVisible();
  });

  test('LIVE-005 Scores: validated, saved, correctable', async ({ page }) => {
    const { sessionId } = await setUp(page, { mode: 'singles', courts: 1, players: 2 });
    await apiGoLive(page, sessionId);
    const { matches } = await apiGenerate(page, sessionId);
    const id = matches[0].id;
    await openLive(page, sessionId);

    const card = `organiser-session-live-match-${id}`;
    await page.getByTestId(`${card}-score-a`).fill('0');
    await page.getByTestId(`${card}-score-b`).fill('0');
    await expect(page.getByTestId(`${card}-score-error`)).toContainText("0-0 isn't a result");
    await expect(page.getByTestId(`${card}-save-score`)).toBeDisabled();
    // The server refuses it too.
    expect((await page.request.post(`/api/organizer/sessions/${sessionId}/matches/${id}/score`, { data: { teamAGames: 0, teamBGames: 0 }, failOnStatusCode: false })).status()).toBe(400);

    await uiScore(page, id, 6, 3);
    let saved = (await currentRound(page, sessionId))!.matches[0];
    expect([saved.teamAGames, saved.teamBGames, saved.status]).toEqual([6, 3, 'confirmed']);
    expect((await currentRound(page, sessionId))!.round.status).toBe('completed');

    // Correction while still live.
    await page.getByTestId(`${card}-correct`).click();
    await page.getByTestId(`${card}-score-a`).fill('6');
    await page.getByTestId(`${card}-score-b`).fill('4');
    await page.getByTestId(`${card}-save-score`).click();
    await expect(page.getByTestId(`${card}-score`)).toContainText('4', { timeout: 15_000 });
    saved = (await currentRound(page, sessionId))!.matches[0];
    expect([saved.teamAGames, saved.teamBGames]).toEqual([6, 4]);
  });

  test('LIVE-006 Next round only after every score; a rester from round 1 plays round 2', async ({ page }) => {
    const { sessionId } = await setUp(page, { mode: 'singles', courts: 1, players: 3 });
    await apiGoLive(page, sessionId);
    const r1 = await apiGenerate(page, sessionId);
    const rester = r1.round.restingPlayerIds![0];
    await openLive(page, sessionId);
    await expect(page.getByTestId('organiser-session-live-generate-round-inline')).toBeDisabled();
    const early = await page.request.post(`/api/organizer/sessions/${sessionId}/rounds/generate`, { failOnStatusCode: false });
    expect(early.status()).toBe(409);

    await uiScore(page, r1.matches[0].id, 6, 2);
    await page.getByTestId('organiser-session-live-generate-round-inline').click();
    await expect(page.getByTestId('organiser-session-live-round-status')).toContainText('Round 2', { timeout: 15_000 });
    const r2 = (await currentRound(page, sessionId))!;
    expect(r2.round.roundNumber).toBe(2);
    expect([...r2.matches[0].teamAIds, ...r2.matches[0].teamBIds]).toContain(rester);
  });

  test('LIVE-007 Leaderboard: wins, then games difference', async ({ page }) => {
    const { sessionId } = await setUp(page, { mode: 'singles', courts: 2, players: 4 });
    await apiGoLive(page, sessionId);
    const { matches } = await apiGenerate(page, sessionId);
    await openLive(page, sessionId);
    await uiScore(page, matches[0].id, 6, 0); // big win
    await uiScore(page, matches[1].id, 6, 4); // close win
    const [bigWinner, bigLoser] = [matches[0].teamAIds[0], matches[0].teamBIds[0]];
    const [closeWinner, closeLoser] = [matches[1].teamAIds[0], matches[1].teamBIds[0]];

    const board = (await (await page.request.get(`/api/organizer/sessions/${sessionId}/leaderboard`)).json()) as { userId: string }[];
    expect(board.map((r) => r.userId)).toEqual([bigWinner, closeWinner, closeLoser, bigLoser]);
    await page.getByTestId('organiser-live-tab-leaderboard').click();
    await expect(page.getByTestId(`organiser-session-live-leaderboard-row-${bigWinner}`)).toHaveAttribute('data-position', '1');
    await expect(page.getByTestId(`organiser-session-live-leaderboard-row-${bigLoser}`)).toHaveAttribute('data-position', '4');
  });

  test('LIVE-008 End Session: unscored matches need "End anyway"; history stays', async ({ page }) => {
    const { sessionId } = await setUp(page, { mode: 'singles', courts: 2, players: 4 });
    await apiGoLive(page, sessionId);
    const { matches } = await apiGenerate(page, sessionId);
    await apiScore(page, sessionId, matches[0].id, 6, 1); // second match left unscored
    await openLive(page, sessionId);

    await page.getByTestId('organiser-session-live-finish').click();
    await page.getByTestId('organiser-session-live-finish-confirm').click();
    await expect(page.getByTestId('organiser-session-live-finish-dialog')).toContainText('1 match has no score');
    expect(await sessionStatus(page, sessionId)).toBe('live');
    await page.getByTestId('organiser-session-live-finish-confirm').click(); // "End anyway"
    await expect(page.getByTestId('organiser-session-live-badge')).toHaveText(/COMPLETED/, { timeout: 15_000 });

    expect(await sessionStatus(page, sessionId)).toBe('completed');
    const [round] = await allRounds(page, sessionId);
    expect(round.round.status).toBe('completed');
    expect(round.matches.find((m) => m.id === matches[1].id)!.status).toBe('abandoned');
    // Read-only history: final leaderboard and rounds on the Live page and in the Workspace.
    await expect(page.getByTestId('organiser-session-live-leaderboard')).toContainText('Final leaderboard');
    await expect(page.getByTestId(`organiser-session-match-${matches[1].id}-status`)).toHaveText('Not played');
    await page.goto(`/organiser/sessions/${sessionId}?tab=results`);
    await expect(page.getByTestId('organiser-session-results-1')).toBeVisible({ timeout: 15_000 });
    // No more scores once completed.
    expect((await page.request.post(`/api/organizer/sessions/${sessionId}/matches/${matches[1].id}/score`, { data: { teamAGames: 6, teamBGames: 2 }, failOnStatusCode: false })).status()).toBeGreaterThanOrEqual(400);
  });

  test('LIVE-009 Doubles: 2v2 teams on every court, full round to the leaderboard', async ({ page }) => {
    const { sessionId } = await setUp(page, { mode: 'doubles', courts: 2, players: 8 });
    await apiGoLive(page, sessionId);
    await openLive(page, sessionId);
    await page.getByTestId('organiser-session-live-generate-round').click();
    await expect(page.getByTestId('organiser-session-live-courts')).toBeVisible({ timeout: 15_000 });
    const round = (await currentRound(page, sessionId))!;
    expect(round.matches).toHaveLength(2);
    for (const m of round.matches) {
      expect(m.teamAIds).toHaveLength(2);
      expect(m.teamBIds).toHaveLength(2);
    }
    for (const m of round.matches) await uiScore(page, m.id, 6, 3);
    const board = (await (await page.request.get(`/api/organizer/sessions/${sessionId}/leaderboard`)).json()) as { wins: number }[];
    expect(board).toHaveLength(8);
    expect(board.filter((r) => r.wins === 1)).toHaveLength(4);
  });

  test('LIVE-010 Odd numbers: in doubles with 5 players one rests, a different one each round', async ({ page }) => {
    const { sessionId } = await setUp(page, { mode: 'doubles', courts: 1, players: 5 });
    await apiGoLive(page, sessionId);
    const resters: string[] = [];
    for (let r = 0; r < 3; r++) {
      const round = await apiGenerate(page, sessionId);
      expect(round.matches).toHaveLength(1);
      expect(round.round.restingPlayerIds).toHaveLength(1);
      resters.push(round.round.restingPlayerIds![0]);
      await apiScore(page, sessionId, round.matches[0].id, 6, r);
    }
    expect(new Set(resters).size).toBe(3);
    // Too few for doubles: with 3 available a round is refused, not an empty one.
    const { registrationIds } = { registrationIds: (await sessionRegistrations(page, sessionId)).map((r) => r.id) };
    for (const id of registrationIds.slice(0, 2)) {
      await page.request.post(`/api/organizer/sessions/${sessionId}/registrations/${id}/live-status`, { data: { liveStatus: 'unavailable' } });
    }
    const refused = await page.request.post(`/api/organizer/sessions/${sessionId}/rounds/generate`, { failOnStatusCode: false });
    expect(refused.status()).toBe(400);
    expect((await refused.json()).message).toMatch(/Doubles needs at least 4 available players/);
    expect(await allRounds(page, sessionId)).toHaveLength(3);
  });

  test('LIVE-011 Late arrival joins the next round; a withdrawn player leaves it', async ({ page }) => {
    const { sessionId, players, registrationIds } = await setUp(page, { mode: 'singles', courts: 2, players: 4, checkedIn: 3 });
    await apiGoLive(page, sessionId);
    const r1 = await apiGenerate(page, sessionId);
    await openLive(page, sessionId);
    await page.getByTestId('organiser-live-tab-players').click();
    // Late arrival: player 4 checks in now.
    await page.getByTestId(`organiser-session-live-player-${registrationIds[3]}-checkin`).click();
    await expect(page.getByTestId(`organiser-session-live-player-${registrationIds[3]}`)).toHaveAttribute('data-state', 'available', { timeout: 15_000 });
    // Withdraw someone who played round 1.
    const leaver = r1.matches[0].teamAIds[0];
    const leaverReg = registrationIds[players.findIndex((p) => p.id === leaver)];
    await page.getByTestId(`organiser-session-live-player-${leaverReg}-withdraw`).click();
    await expect(page.getByTestId(`organiser-session-live-player-${leaverReg}`)).toHaveAttribute('data-state', 'withdrawn', { timeout: 15_000 });

    await apiScore(page, sessionId, r1.matches[0].id, 6, 2);
    const r2 = await apiGenerate(page, sessionId);
    const r2Players = [...r2.matches.flatMap((m) => [...m.teamAIds, ...m.teamBIds]), ...(r2.round.restingPlayerIds ?? [])];
    expect(r2Players).toContain(players[3].id);
    expect(r2Players).not.toContain(leaver);
    // Back in: available again for round 3.
    await page.getByTestId(`organiser-session-live-player-${leaverReg}-return`).click();
    await expect(page.getByTestId(`organiser-session-live-player-${leaverReg}`)).toHaveAttribute('data-state', 'available', { timeout: 15_000 });
  });

  test('LIVE-012 Reload and a second device see the same session', async ({ page, browser }) => {
    const { sessionId } = await setUp(page, { mode: 'singles', courts: 1, players: 2 });
    await apiGoLive(page, sessionId);
    const { matches } = await apiGenerate(page, sessionId);
    await openLive(page, sessionId);

    // A second device signed in as the same organiser.
    const other = await browser.newContext({ storageState: await page.context().storageState(), viewport: { width: 768, height: 1024 } });
    const tablet = await other.newPage();
    try {
      await openLive(tablet, sessionId);
      await expect(tablet.getByTestId(`organiser-session-live-match-${matches[0].id}`)).toHaveAttribute('data-status', 'pending');
      await uiScore(page, matches[0].id, 7, 5);
      // No reload on the tablet: it refreshes by itself while live.
      await expect(tablet.getByTestId(`organiser-session-live-match-${matches[0].id}`)).toHaveAttribute('data-status', 'confirmed', { timeout: 25_000 });
      await page.reload();
      await expect(page.getByTestId(`organiser-session-live-match-${matches[0].id}-score`)).toContainText('7', { timeout: 15_000 });
    } finally {
      await other.close();
    }
  });

  test('LIVE-013 Another organiser, a player and a guest are refused', async ({ page, browser }) => {
    test.slow();
    const { sessionId } = await setUp(page, { mode: 'singles', courts: 1, players: 2 });
    await apiGoLive(page, sessionId);
    const { matches } = await apiGenerate(page, sessionId);
    const b = await secondOrganiser(browser);
    try {
      for (const [method, path, data] of [
        ['POST', `/sessions/${sessionId}/rounds/generate`, {}],
        ['POST', `/sessions/${sessionId}/matches/${matches[0].id}/score`, { teamAGames: 6, teamBGames: 0 }],
        ['POST', `/sessions/${sessionId}/finish`, { force: true }],
        ['GET', `/sessions/${sessionId}/rounds/current`, undefined],
      ] as const) {
        const res = await b.page.request.fetch(`/api/organizer${path}`, { method, data, failOnStatusCode: false });
        expect(res.status(), `${method} ${path} as another organiser`).toBe(403);
      }
      await b.page.goto(`/organiser/sessions/${sessionId}/live`);
      await expect(b.page.getByTestId('organiser-session-live-not-found')).toBeVisible({ timeout: 15_000 });
    } finally {
      await b.close();
    }
    const guest = await browser.newContext();
    try {
      const res = await guest.request.post(new URL(`/api/organizer/sessions/${sessionId}/rounds/generate`, page.url()).toString(), { failOnStatusCode: false });
      expect(res.status()).toBe(401);
    } finally {
      await guest.close();
    }
    expect((await currentRound(page, sessionId))!.matches[0].status).not.toBe('confirmed');
    expect(await sessionStatus(page, sessionId)).toBe('live');
  });

  test('LIVE-014 Double clicks and concurrent requests never duplicate rounds or lose a round close', async ({ page }) => {
    const { sessionId } = await setUp(page, { mode: 'singles', courts: 2, players: 4 });
    const goLives = await Promise.all([1, 2].map(() => page.request.post(`/api/organizer/sessions/${sessionId}/go-live`)));
    expect(goLives.map((r) => r.status())).toEqual([200, 200]);

    const gens = await Promise.all([1, 2, 3].map(() => page.request.post(`/api/organizer/sessions/${sessionId}/rounds/generate`, { failOnStatusCode: false })));
    expect(gens.map((r) => r.status()).sort()).toEqual([201, 409, 409]);
    expect(await allRounds(page, sessionId)).toHaveLength(1);

    // Both last scores at the same moment: the round still closes.
    const round = (await currentRound(page, sessionId))!;
    const scores = await Promise.all(round.matches.map((m, i) => page.request.post(`/api/organizer/sessions/${sessionId}/matches/${m.id}/score`, { data: { teamAGames: 6, teamBGames: i } })));
    expect(scores.map((r) => r.status())).toEqual([200, 200]);
    expect((await currentRound(page, sessionId))!.round.status).toBe('completed');

    // The same score submitted twice: still one match, one result.
    await Promise.all([1, 2].map(() => page.request.post(`/api/organizer/sessions/${sessionId}/matches/${round.matches[0].id}/score`, { data: { teamAGames: 6, teamBGames: 0 } })));
    const board = (await (await page.request.get(`/api/organizer/sessions/${sessionId}/leaderboard`)).json()) as { matchesPlayed: number }[];
    expect(board.every((r) => r.matchesPlayed === 1)).toBe(true);

    const finishes = await Promise.all([1, 2].map(() => page.request.post(`/api/organizer/sessions/${sessionId}/finish`, { data: { force: true } })));
    expect(finishes.map((r) => r.status())).toEqual([200, 200]);
    expect(await sessionStatus(page, sessionId)).toBe('completed');
  });

  test('LIVE-015 Live switched off: no controls, routes closed, history readable', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    test.skip((await liveMode(page)) !== 'off', 'Needs a server with TC_LIVE_ENABLED=false (run against a local server; Staging keeps Live on). The flag itself is unit- and route-tested.');
    const seeded = await seedHubSession(page, organiser, { title: `Off ${Date.now()}`, startAt: inDays(1), status: 'published' }, { courtsCount: 1, matchMode: 'singles', location: 'X' });
    await openLive(page, seeded.id).catch(() => {});
    await expect(page.getByTestId('organiser-session-live-unavailable')).toBeVisible({ timeout: 15_000 });
    for (const path of [`/sessions/${seeded.id}/go-live`, `/sessions/${seeded.id}/rounds/generate`]) {
      expect((await page.request.post(`/api/organizer${path}`, { failOnStatusCode: false })).status()).toBe(404);
    }
    expect((await page.request.get(`/api/organizer/sessions/${seeded.id}/rounds`)).status()).toBe(200);
    await page.goto(`/organiser/sessions/${seeded.id}?tab=overview`);
    await expect(page.getByTestId('organiser-session-primary-action')).not.toHaveText(/Live/);
  });

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
  ]) {
    test(`LIVE-016 ${viewport.name}: check in, go live, score and switch sections by touch`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const { sessionId, registrationIds } = await setUp(page, { mode: 'singles', courts: 1, players: 2, checkedIn: 0 });
      await openLive(page, sessionId);
      for (const id of registrationIds) {
        const button = page.getByTestId(`organiser-session-live-checkin-row-${id}-button`);
        expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        await button.click();
        await expect(page.getByTestId(`organiser-session-live-checkin-row-${id}-done`)).toBeVisible({ timeout: 15_000 });
      }
      await page.getByTestId('organiser-session-live-go-live').click();
      await expect(page.getByTestId('organiser-session-live-badge')).toHaveText(/LIVE/, { timeout: 15_000 });
      await page.getByTestId('organiser-session-live-generate-round').click();
      const { matches } = (await currentRound(page, sessionId))!;
      const input = page.getByTestId(`organiser-session-live-match-${matches[0].id}-score-a`);
      expect((await input.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await uiScore(page, matches[0].id, 6, 4);
      await expectNoHorizontalOverflow(page, `live ${viewport.name}`);
      // One section switcher on every screen size.
      await page.getByTestId('organiser-live-tab-leaderboard').click();
      await expect(page.getByTestId('organiser-session-live-leaderboard')).toBeVisible();
      await page.getByTestId('organiser-live-tab-players').click();
      await expect(page.getByTestId('organiser-session-live-players')).toBeVisible();
      await expectNoHorizontalOverflow(page, `live players ${viewport.name}`);
      await testInfo.attach(`live-${viewport.name}`, { body: await page.screenshot(), contentType: 'image/png' });
    });
  }

  test('LIVE-017 Lifecycle: the clock never changes status - delayed start, Live past its end, Finish completes', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    await requireLiveOn(page);
    const players = await seedPlayers(page, 4);
    // Scheduled 3.6 h ago, "ended" 1.2 h ago - and nobody started it.
    const { id: sessionId } = await seedHubSession(
      page,
      organiser,
      {
        title: `Late start ${Date.now()}`,
        startAt: inDays(-0.15),
        status: 'published',
        type: 'social',
        registrations: players.map((p) => ({ userId: p.id, checkedIn: true })),
      },
      { matchMode: 'singles', courtsCount: 2, location: 'Court Complex', endAt: inDays(-0.05) },
    );

    // Opening the organiser's list used to archive it by time. Not any more.
    await page.request.get('/api/organizer/sessions/mine');
    expect(await sessionStatus(page, sessionId)).toBe('published');

    // Players and guests: archived and read-only from the start time.
    const pub = await (await page.request.get(`/api/play/sessions/${sessionId}`)).json();
    expect(pub.playStatus).toBe('archived');
    expect((await page.request.post(`/api/organizer/sessions/${sessionId}/join`, { data: { acceptedPolicies: true }, failOnStatusCode: false })).status()).toBe(400);

    // The organiser: Ready to Start, and starting late works.
    await page.goto(`/organiser/sessions/${sessionId}`);
    await expect(page.getByTestId('organiser-session-status-badge')).toHaveText('READY TO START', { timeout: 15_000 });
    await expect(page.getByTestId('organiser-session-primary-action')).toHaveText(/Start Live/);
    await apiGoLive(page, sessionId);

    // Live past the scheduled end stays live, even after the list is opened again.
    await page.request.get('/api/organizer/sessions/mine');
    expect(await sessionStatus(page, sessionId)).toBe('live');

    const { matches } = await apiGenerate(page, sessionId);
    for (const m of matches) await apiScore(page, sessionId, m.id, 6, 3);
    const finish = await page.request.post(`/api/organizer/sessions/${sessionId}/finish`, { data: {} });
    expect(finish.status(), await finish.text()).toBe(200);
    expect(await sessionStatus(page, sessionId)).toBe('completed');

    // Completed: results stay, no edits, still archived for players.
    const board = await page.request.get(`/api/organizer/sessions/${sessionId}/leaderboard`);
    expect(board.ok()).toBeTruthy();
    expect((await board.json()).length).toBeGreaterThan(0);
    const edit = await page.request.put(`/api/organizer/sessions/${sessionId}`, { data: { title: 'Changed' }, failOnStatusCode: false });
    expect(edit.status()).toBe(409);
    expect((await (await page.request.get(`/api/play/sessions/${sessionId}`)).json()).playStatus).toBe('archived');
  });

  test('LIVE-018 Not played: closes the round without a score, never counts, can still get a score while live', async ({ page }) => {
    const { sessionId, registrationIds } = await setUp(page, { mode: 'singles', courts: 2, players: 4 });
    await apiGoLive(page, sessionId);
    const r1 = await apiGenerate(page, sessionId);
    const [first, second] = r1.matches;
    await apiScore(page, sessionId, first.id, 6, 3);
    // A player on the second court leaves: flagged on the court card.
    const leaver = second.teamAIds[0];
    const fixture = await sessionRegistrations(page, sessionId);
    const leaverReg = fixture.find((r: { userId: string }) => r.userId === leaver)!.id;
    expect(registrationIds).toContain(leaverReg);
    const away = await page.request.post(`/api/organizer/sessions/${sessionId}/registrations/${leaverReg}/live-status`, { data: { liveStatus: 'withdrawn' } });
    expect(away.status()).toBe(200);

    await openLive(page, sessionId);
    const card = `organiser-session-live-match-${second.id}`;
    await expect(page.getByTestId(`${card}-player-away`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('organiser-session-live-generate-round-inline')).toBeDisabled();
    await page.getByTestId(`${card}-not-played`).click();
    await expect(page.getByTestId(card)).toHaveAttribute('data-status', 'abandoned', { timeout: 15_000 });
    await expect(page.getByTestId('organiser-session-live-round-status')).toContainText('all scores in');
    expect((await currentRound(page, sessionId))!.round.status).toBe('completed');

    // Not counted: only the scored match is on the leaderboard.
    const board = await (await page.request.get(`/api/organizer/sessions/${sessionId}/leaderboard`)).json();
    expect(board.reduce((n: number, r: { matchesPlayed: number }) => n + r.matchesPlayed, 0)).toBe(2);
    // A scored match can't be marked not played; repeating is a no-op.
    expect((await page.request.post(`/api/organizer/sessions/${sessionId}/matches/${first.id}/not-played`, { failOnStatusCode: false })).status()).toBe(409);
    expect((await page.request.post(`/api/organizer/sessions/${sessionId}/matches/${second.id}/not-played`)).status()).toBe(200);

    // Played after all: the score goes in while the session is live.
    await page.getByTestId(`${card}-enter-score`).click();
    await uiScore(page, second.id, 4, 6);
    const after = await (await page.request.get(`/api/organizer/sessions/${sessionId}/leaderboard`)).json();
    expect(after.reduce((n: number, r: { matchesPlayed: number }) => n + r.matchesPlayed, 0)).toBe(4);
    // The withdrawn player isn't drawn into round 2.
    const r2 = await apiGenerate(page, sessionId);
    expect(r2.matches.flatMap((m) => [...m.teamAIds, ...m.teamBIds])).not.toContain(leaver);
  });

  test('LIVE-019 Redo round: a late arrival joins before anyone starts; refused once a match starts', async ({ page }) => {
    const { sessionId, registrationIds, players } = await setUp(page, { mode: 'singles', courts: 2, players: 4, checkedIn: 3 });
    await apiGoLive(page, sessionId);
    const r1 = await apiGenerate(page, sessionId);
    expect(r1.matches).toHaveLength(1);
    // The fourth player arrives just after the draw.
    const late = registrationIds[3];
    expect((await page.request.post(`/api/organizer/sessions/${sessionId}/checkin/${late}`)).ok()).toBeTruthy();

    await openLive(page, sessionId);
    await expect(page.getByTestId('organiser-session-live-joiners')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('organiser-session-live-redo-round').click();
    await expect.poll(async () => (await currentRound(page, sessionId))!.matches.length, { timeout: 15_000 }).toBe(2);
    const redone = (await currentRound(page, sessionId))!;
    expect(redone.round.roundNumber).toBe(1);
    expect(redone.round.restingPlayerIds ?? []).toHaveLength(0);
    expect(redone.matches.flatMap((m) => [...m.teamAIds, ...m.teamBIds])).toContain(players[3].id);
    expect(await allRounds(page, sessionId)).toHaveLength(1);
    await expect(page.getByTestId('organiser-session-live-joiners')).toHaveCount(0);

    // Once a match is under way the round stays as drawn.
    await page.getByTestId(`organiser-session-live-match-${redone.matches[0].id}-start`).click();
    await expect(page.getByTestId(`organiser-session-live-match-${redone.matches[0].id}`)).toHaveAttribute('data-status', 'playing', { timeout: 15_000 });
    await expect(page.getByTestId('organiser-session-live-redo-round')).toHaveCount(0);
    const refused = await page.request.post(`/api/organizer/sessions/${sessionId}/rounds/current/redo`, { failOnStatusCode: false });
    expect(refused.status()).toBe(409);
    expect((await refused.json()).code).toBe('ROUND_STARTED');
  });

  test('LIVE-020 After Finish: results final in the Workspace, roster frozen, not cancelled or archived mid-play', async ({ page }) => {
    const { sessionId, registrationIds } = await setUp(page, { mode: 'singles', courts: 1, players: 3 });
    await apiGoLive(page, sessionId);
    const r1 = await apiGenerate(page, sessionId);
    await apiScore(page, sessionId, r1.matches[0].id, 6, 1);
    const api = `/api/organizer/sessions/${sessionId}`;
    // While live: End Session is the way out, not Cancel or Archive.
    expect((await page.request.post(`${api}/cancel`, { failOnStatusCode: false })).status()).toBe(409);
    expect((await page.request.post(`${api}/archive`, { failOnStatusCode: false })).status()).toBe(409);
    expect(await sessionStatus(page, sessionId)).toBe('live');
    expect((await page.request.post(`${api}/finish`)).status()).toBe(200);

    await openLive(page, sessionId);
    await expect(page.getByTestId('organiser-session-live-completed')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('organiser-session-live-open-results').click();
    const results = page.getByTestId('organiser-session-results-tab');
    await expect(results).toHaveAttribute('data-final', 'true', { timeout: 15_000 });
    await expect(page.getByTestId('organiser-session-results-podium-1')).toBeVisible();
    await expect(page.getByTestId('organiser-session-results-1')).toContainText('+5');
    await expect(page.getByTestId('organiser-session-results-summary-scored')).toContainText('1');
    await expect(page.getByTestId('organiser-session-results-summary-rounds')).toContainText('1');

    // Roster frozen: no controls, and the server refuses.
    await page.goto(`/organiser/sessions/${sessionId}?tab=players`);
    await expect(page.getByTestId('organiser-session-players-tab')).toHaveAttribute('data-roster', 'final', { timeout: 15_000 });
    await expect(page.getByTestId('organiser-players-final-note')).toBeVisible();
    await expect(page.getByTestId('organiser-players-checkin-all')).toHaveCount(0);
    const reg = registrationIds[0];
    for (const [method, path] of [['POST', `${api}/checkin/${reg}`], ['DELETE', `${api}/registrations/${reg}`], ['POST', `${api}/registrations/${reg}/waitlist`]] as const) {
      expect((await page.request.fetch(path, { method, failOnStatusCode: false })).status(), `${method} ${path}`).toBe(409);
    }
    expect((await page.request.post(`${api}/matches/${r1.matches[0].id}/score`, { data: { teamAGames: 1, teamBGames: 6 }, failOnStatusCode: false })).status()).toBeGreaterThanOrEqual(400);
    expect((await page.request.post(`${api}/cancel`, { failOnStatusCode: false })).status()).toBe(409);

    // Archived afterwards: the results are kept and still shown.
    expect((await page.request.post(`${api}/archive`)).status()).toBe(200);
    await page.goto(`/organiser/sessions/${sessionId}?tab=results`);
    await expect(page.getByTestId('organiser-session-results-1')).toBeVisible({ timeout: 15_000 });
    const board = await (await page.request.get(`${api}/leaderboard`)).json();
    expect(board[0].wins).toBe(1);
  });
});
