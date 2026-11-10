import { expect, type Browser, type Page } from '@playwright/test';
import { becomeOrganiser, seedSession, type OrganiserFixture, type SeededSession } from './organiser';

/*
  Organiser Hub Phase 2 helpers (permissions, wizard, Workspace, actions).

  Everything goes through the real organiser API as the signed-in,
  run-owned organiser (no test-only endpoints beyond seed-session, which
  helpers/organiser.ts already wraps). Assertions in the specs read state
  back from the API - a toast or a click is never the evidence.
*/

const API = '/api/organizer';

export interface ApiSession {
  id: string;
  title: string;
  status: string;
  type: string;
  visibility: string;
  matchMode: string | null;
  gamesTo: number | null;
  plannedRoundsCount: number | null;
  description: string | null;
  rulesText: string | null;
  refundPolicy: string | null;
  latePolicy: string | null;
  cancellationPolicy: string | null;
  endAt: string | null;
  startAt: string;
}

async function json<T>(res: import('@playwright/test').APIResponse, what: string): Promise<T> {
  if (!res.ok()) throw new Error(`${what} returned ${res.status()}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

export async function getSession(page: Page, id: string): Promise<ApiSession> {
  return json(await page.request.get(`${API}/sessions/${id}`), `GET ${API}/sessions/${id}`);
}

export async function mySessions(page: Page): Promise<ApiSession[]> {
  return json(await page.request.get(`${API}/sessions/mine`), `GET ${API}/sessions/mine`);
}

/** The newest of my sessions with this exact title (titles carry Date.now()). */
export async function findMySession(page: Page, title: string): Promise<ApiSession> {
  let found: ApiSession | undefined;
  await expect
    .poll(async () => {
      found = (await mySessions(page)).find((s) => s.title === title);
      return !!found;
    }, { message: `session "${title}" was saved`, timeout: 15_000 })
    .toBe(true);
  return found!;
}

export async function updateSession(page: Page, id: string, data: Record<string, unknown>): Promise<ApiSession> {
  return json(await page.request.put(`${API}/sessions/${id}`, { data }), `PUT ${API}/sessions/${id}`);
}

export async function sessionRegistrations(page: Page, id: string): Promise<{ id: string; userId: string; status: string; checkedInAt: string | null }[]> {
  return json(await page.request.get(`${API}/sessions/${id}/registrations`), `GET ${API}/sessions/${id}/registrations`);
}

export const inDays = (days: number) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

/**
 * A seeded session (helpers/organiser.ts seedSession) plus the fields the
 * seed hook doesn't take (policies, endAt, visibility, description), set
 * through the organiser's own PUT /sessions/:id.
 */
export async function seedHubSession(
  page: Page,
  organiser: OrganiserFixture,
  data: Parameters<typeof seedSession>[1] extends infer D ? Omit<D & object, 'organizationId' | 'createdBy'> : never,
  extra: Record<string, unknown> = {},
): Promise<SeededSession> {
  const seeded = await seedSession(page, { organizationId: organiser.organizationId, createdBy: organiser.id, ...(data as any) });
  if (Object.keys(extra).length > 0) await updateSession(page, seeded.id, extra);
  return seeded;
}

/** A second, independent organiser in its own browser context. */
export async function secondOrganiser(browser: Browser): Promise<{ page: Page; organiser: OrganiserFixture; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const organiser = await becomeOrganiser(page);
  return { page, organiser, close: () => context.close() };
}

/** Opens a Workspace tab by its key and waits for the tab to be selected. */
export async function openWorkspaceTab(page: Page, sessionId: string, tab: string) {
  await page.goto(`/organiser/sessions/${sessionId}?tab=${tab}`);
  await expect(page.getByTestId('organiser-session-workspace')).toBeVisible({ timeout: 15_000 });
}

/** Opens the Workspace "More" menu (desktop header). */
export async function openMoreMenu(page: Page) {
  await page.getByTestId('organiser-session-more-button').click();
}
