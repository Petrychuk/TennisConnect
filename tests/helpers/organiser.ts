import { Page } from '@playwright/test';
import { registerPlayer } from './auth';
import { grantOrganizerAccess } from './messages';
import { TEST_USERS } from '../fixtures/test-users';

/*
  Organiser Hub test helpers.

  Per the Organiser Hub regression plan: don't create everything through
  the UI before every test - it's slow and flaky. Season/Series go
  through the real organizer API (they're normal authenticated
  endpoints, nothing test-only about them). Sessions with confirmed
  match results go through the /api/test-hooks/seed-session hook
  instead of TC Live's real multi-step flow (check-in -> generate round
  -> enter score -> confirm -> complete) - see that hook's own comment
  in server/routes/testHooks.ts for why. Tests that specifically need
  to exercise TC Live itself (check-in, live scoring) should do that
  through the UI as normal; these helpers are for tests where the Live
  flow itself isn't what's being tested.
*/

export interface OrganiserFixture {
  id: string;
  name: string;
  email: string;
  slug: string;
  organizationId: string;
  organizationName: string;
}

// Registers a fresh player account, grants it organizer access (via a
// separate admin browser context, same recipe as
// helpers/messages.ts:grantOrganizerAccess), then creates its
// Organization - the one-time setup every Organiser Hub page requires
// (GET /api/organizer/organizations/me). Returns with `page` already
// logged in as the new organiser, sitting wherever
// registerPlayer()/the reload left it.
export async function becomeOrganiser(page: Page, organizationName?: string): Promise<OrganiserFixture> {
  const organiser = await registerPlayer(page);

  const browser = page.context().browser();
  if (!browser) {
    throw new Error('becomeOrganiser(): page has no browser (persistent context?) - cannot open a separate admin session.');
  }
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  try {
    await grantOrganizerAccess(adminPage, TEST_USERS.admin.email, TEST_USERS.admin.password, organiser.email);
  } finally {
    await adminContext.close();
  }

  // The page's own session cookie is still valid - it just needs a
  // fresh /api/auth/me for the client to see isOrganizer: true.
  await page.reload();

  const meRes = await page.request.get('/api/auth/me');
  const me = await meRes.json();

  const name = organizationName ?? `Playwright Club ${Date.now()}`;
  const orgRes = await page.request.post('/api/organizations', { data: { name } });
  if (!orgRes.ok()) {
    throw new Error(`becomeOrganiser(): POST /api/organizations returned ${orgRes.status()} - ${await orgRes.text()}`);
  }
  const organization = await orgRes.json();

  return {
    id: me.id,
    name: me.name,
    email: organiser.email,
    slug: me.slug,
    organizationId: organization.id,
    organizationName: organization.name,
  };
}

async function getMyUserId(page: Page): Promise<string> {
  const res = await page.request.get('/api/auth/me');
  const me = await res.json();
  return me.id;
}

export interface SeasonFixture {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export async function createSeason(
  page: Page,
  data: { name: string; startDate: string; endDate: string; type?: string; description?: string }
): Promise<SeasonFixture> {
  const res = await page.request.post('/api/organizer/seasons', { data });
  if (!res.ok()) {
    throw new Error(`createSeason(): POST /api/organizer/seasons returned ${res.status()} - ${await res.text()}`);
  }
  return res.json();
}

export interface SeriesFixture {
  id: string;
  name: string;
  seasonId: string;
  format: string;
}

export async function createSeries(
  page: Page,
  data: { seasonId: string; name: string; format: string; description?: string }
): Promise<SeriesFixture> {
  const res = await page.request.post('/api/organizer/series', { data });
  if (!res.ok()) {
    throw new Error(`createSeries(): POST /api/organizer/series returned ${res.status()} - ${await res.text()}`);
  }
  return res.json();
}

export interface SeededPlayer {
  id: string;
  name: string;
  email: string;
  slug: string;
  password: string;
}

// Creates `count` real, usable player accounts directly (verified,
// approved, profile-complete) via /api/test-hooks/seed-players - for
// tests that just need userIds for registrations/match results, not
// full register+verify-email flows per player.
export async function seedPlayers(page: Page, count: number): Promise<SeededPlayer[]> {
  const res = await page.request.post('/api/test-hooks/seed-players', { data: { count } });
  if (!res.ok()) {
    throw new Error(
      `seedPlayers(): /api/test-hooks/seed-players returned ${res.status()} - is the server running with ` +
      `NODE_ENV=development or DB_ENV=staging? ${await res.text()}`
    );
  }
  const { players } = await res.json();
  return players;
}

export interface SeededMatch {
  teamAIds: string[];
  teamBIds: string[];
  teamAGames: number;
  teamBGames: number;
}

export interface SeededSession {
  id: string;
  registrationIds: string[];
  matchIds: string[];
}

// Creates one Session - by default already "completed" - optionally
// under a Season/Series, with registrations (each optionally checked
// in) and confirmed match results, in a single call via
// /api/test-hooks/seed-session. `organizationId`/`createdBy` should be
// the organiser fixture's own ids (see becomeOrganiser above).
export async function seedSession(
  page: Page,
  data: {
    organizationId: string;
    createdBy: string;
    title: string;
    startAt: string; // ISO
    status?: 'draft' | 'published' | 'completed' | 'cancelled' | 'live';
    seasonId?: string;
    seriesId?: string;
    type?: string;
    maxParticipants?: number;
    waitingListEnabled?: boolean;
    registrations?: { userId: string; checkedIn?: boolean }[];
    matches?: SeededMatch[];
  }
): Promise<SeededSession> {
  const res = await page.request.post('/api/test-hooks/seed-session', { data });
  if (!res.ok()) {
    throw new Error(`seedSession(): /api/test-hooks/seed-session returned ${res.status()} - ${await res.text()}`);
  }
  return res.json();
}
