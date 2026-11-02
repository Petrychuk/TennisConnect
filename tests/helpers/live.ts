import { expect, type Page } from '@playwright/test';
import { seedPlayers, type OrganiserFixture, type SeededPlayer } from './organiser';
import { inDays, seedHubSession, updateSession } from './organiser-hub';

/*
  TC Live v1 E2E helpers (tests/live/). Staging / local only.

  Sessions come from seed-session (published, run-owned players registered)
  plus the organiser's own PUT for the Live settings the seed doesn't take
  (match format, courts, venue). Everything else - check-in, go live,
  rounds, scores, finish - goes through the Live screen or the real API.
*/

const API = '/api/organizer';

/** The server's TC_LIVE_ENABLED as the Hub sees it. */
export async function liveMode(page: Page): Promise<'off' | 'internal' | 'on'> {
  const res = await page.request.get(`${API}/features`);
  expect(res.ok(), 'GET /api/organizer/features').toBeTruthy();
  return (await res.json()).live;
}

/** LIVE-001..014/016 need Live on: fail with the fix, not with a missing button. */
export async function requireLiveOn(page: Page) {
  expect(await liveMode(page), 'TC Live must be enabled on this server: set TC_LIVE_ENABLED=true (Staging) - docs/live/LIVE_RUNBOOK.md').toBe('on');
}

export interface LiveFixture {
  sessionId: string;
  players: SeededPlayer[];
  /** registrationIds[i] belongs to players[i]. */
  registrationIds: string[];
}

export async function seedLiveSession(
  page: Page,
  organiser: OrganiserFixture,
  options: { mode: 'singles' | 'doubles'; courts: number; players: number; checkedIn?: number; title?: string },
): Promise<LiveFixture> {
  const players = await seedPlayers(page, options.players);
  const checkedIn = options.checkedIn ?? options.players;
  const seeded = await seedHubSession(
    page,
    organiser,
    {
      title: options.title ?? `Live ${options.mode} ${Date.now()}`,
      startAt: inDays(0.05),
      status: 'published',
      type: 'social',
      registrations: players.map((p, i) => ({ userId: p.id, checkedIn: i < checkedIn })),
    },
    { matchMode: options.mode, courtsCount: options.courts, location: 'Court Complex' },
  );
  return { sessionId: seeded.id, players, registrationIds: seeded.registrationIds };
}

export interface ApiRound {
  round: { id: string; roundNumber: number; status: string; restingPlayerIds: string[] | null };
  matches: { id: string; status: string; courtLabel: string; teamAIds: string[]; teamBIds: string[]; teamAGames: number | null; teamBGames: number | null }[];
}

export async function currentRound(page: Page, sessionId: string): Promise<ApiRound | null> {
  const res = await page.request.get(`${API}/sessions/${sessionId}/rounds/current`);
  expect(res.ok(), 'GET rounds/current').toBeTruthy();
  return res.json();
}

export async function allRounds(page: Page, sessionId: string): Promise<ApiRound[]> {
  const res = await page.request.get(`${API}/sessions/${sessionId}/rounds`);
  expect(res.ok(), 'GET rounds').toBeTruthy();
  return res.json();
}

export async function sessionStatus(page: Page, sessionId: string): Promise<string> {
  return (await (await page.request.get(`${API}/sessions/${sessionId}`)).json()).status;
}

export async function apiGoLive(page: Page, sessionId: string) {
  const res = await page.request.post(`${API}/sessions/${sessionId}/go-live`);
  expect(res.status(), `go-live: ${await res.text()}`).toBe(200);
}

export async function apiGenerate(page: Page, sessionId: string): Promise<ApiRound> {
  const res = await page.request.post(`${API}/sessions/${sessionId}/rounds/generate`);
  expect(res.status(), `generate: ${await res.text()}`).toBe(201);
  return res.json();
}

export async function apiScore(page: Page, sessionId: string, matchId: string, a: number, b: number) {
  const res = await page.request.post(`${API}/sessions/${sessionId}/matches/${matchId}/score`, { data: { teamAGames: a, teamBGames: b } });
  expect(res.status(), `score: ${await res.text()}`).toBe(200);
}

export async function openLive(page: Page, sessionId: string) {
  await page.goto(`/organiser/sessions/${sessionId}/live`);
  await expect(page.getByTestId('organiser-session-live')).toBeVisible({ timeout: 20_000 });
}

/** Enters a score through the match card on the Live screen. */
export async function uiScore(page: Page, matchId: string, a: number, b: number) {
  const card = `organiser-session-live-match-${matchId}`;
  await page.getByTestId(`${card}-score-a`).fill(String(a));
  await page.getByTestId(`${card}-score-b`).fill(String(b));
  await page.getByTestId(`${card}-save-score`).click();
  await expect(page.getByTestId(card)).toHaveAttribute('data-status', 'confirmed', { timeout: 15_000 });
}

export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${label}: ${scrollWidth}px wide in ${clientWidth}px`).toBeLessThanOrEqual(clientWidth + 1);
}
