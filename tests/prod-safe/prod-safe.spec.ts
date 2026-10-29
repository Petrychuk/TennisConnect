import { test, expect } from '../fixtures/prod-safe';
import type { APIRequestContext, Locator, Page, Response } from '@playwright/test';
import { dismissCookieBanner } from '../helpers/auth';
import { readVerifiedTarget } from '../safety/environment-guard';
import { parseHourlyRate } from '../../shared/coachDirectory';
import { isRetreatArchived } from '../../client/src/lib/travelStatus';
// One inbox row per conversation - the row's delete button and unread dot
// share the message-item- prefix, so a bare prefix match over-counts.
const CONVERSATION_ROW = 'button[data-testid^="message-item-"]:not([data-testid^="message-item-delete-"])';

/*
  PROD-SAFE SUITE - the ONLY tests allowed to run against PRODUCTION.

  Separate from @smoke on purpose: @smoke includes registration
  (REG-001/REG-002) and authenticated flows, which create data.

  Rules for anything in this file:
  - Read-only: public pages and GET requests only.
  - No registration, no login (it writes sessions / lockout counters),
    no form submits, uploads, admin actions or deletes.
  - Title starts with @prod-safe and has a PROD-SAFE-NNN id.
  - Every new test id must be added to PROD_SAFE_ALLOWLIST in
    tests/safety/environment-guard.ts - that addition is the approval.
  - Import test/expect from ../fixtures/prod-safe (blocks write requests).
  - API calls only through the `request` fixture (read-only proxy), never
    the page's or context's own request client (tests/safety/prod-safe-suite.unit.ts
    checks this file).
  - No fixed ids or assumed records: every test reads what the environment
    has (GET) and compares the page with it; a test that needs a record
    (a session, a premium club, a retreat) skips itself when there is none.
  - Never press Enter or the lime search button on /play: that runs the
    AI smart search (POST /api/play/smart-search). Typing is a GET.

  Run with:
    TEST_ENV=production BASE_URL=https://<production host> npm run test:e2e:prod-safe
*/

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const NO_MATCH = 'zzz-prod-safe-no-match-zzz';
// Lazy route chunks on a cold server took over 5 s in the 28 Oct Staging run
// (SEARCH-060). Used only for "the page has rendered" waits on real elements.
const PAGE_READY = { timeout: 15_000 };

type CoachesApi = {
  coaches: { id: string; slug: string; name: string; location: string; rate: string | null }[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  locations: string[];
};

async function openPage(page: Page, path: string) {
  await page.goto(path);
  await dismissCookieBanner(page);
}

async function getJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const response = await request.get(url);
  expect(response.status(), `GET ${url}`).toBe(200);
  return (await response.json()) as T;
}

/**
 * The next GET to `pathname` on the app whose query has exactly these
 * values (null = the parameter must be absent). Register before the action.
 */
function nextAppGet(page: Page, pathname: string, params: Record<string, string | null> = {}): Promise<Response> {
  return page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') return false;
    const url = new URL(response.url());
    if (url.pathname !== pathname) return false;
    return Object.entries(params).every(([key, value]) => url.searchParams.get(key) === value);
  });
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const visibleOne = (locator: Locator) => locator.filter({ visible: true }).first();

// ---------- Play ----------

const playCards = (page: Page) => page.getByTestId('play-page-results').locator('[data-testid^="play-session-card-"][data-testid$="-view"]');

/** Waits for the first list render: results, "no matches" or "nothing yet". */
async function waitForPlayList(page: Page) {
  const loaded = page
    .getByTestId('play-page-results')
    .or(page.getByTestId('play-page-no-matches'))
    .or(page.getByTestId('play-page-empty'));
  await expect(loaded.first()).toBeVisible(PAGE_READY);
}

const sessionsFoundText = (n: number) => `${n} session${n === 1 ? '' : 's'} found`;

// ---------- Coaches ----------

const coachCards = (page: Page) => page.locator('[data-testid^="coach-card-"]');
const coachesTotal = (page: Page) => page.getByTestId('coaches-results-count');

test('@prod-safe PROD-SAFE-001 Health endpoint matches verified target', async ({ request }) => {

  // ---------- Test data ----------

  const verified = readVerifiedTarget(process.env);

  // ---------- Actions ----------

  const response = await request.get('/api/health');

  // ---------- Verify request ----------

  expect(response.status()).toBe(200);

  // ---------- Final verification ----------

  const body = await response.json();

  expect(verified).toBeDefined();
  expect(String(body.dbEnv).trim().toLowerCase()).toBe(verified!.serverEnv);

});

test('@prod-safe PROD-SAFE-002 Homepage loads', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/');
  await dismissCookieBanner(page);

  // ---------- Final verification ----------

  const logoLink = page.getByTestId('navbar-logo-link');

  await expect(logoLink).toBeVisible();

});

test('@prod-safe PROD-SAFE-003 Coaches directory opens', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/coaches');
  await dismissCookieBanner(page);

  // ---------- Final verification ----------

  const searchInput = page.getByTestId('coaches-search-input');

  await expect(searchInput).toBeVisible();

});

test('@prod-safe PROD-SAFE-004 Players directory opens', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/players');
  await dismissCookieBanner(page);

  // ---------- Final verification ----------

  const searchInput = page.getByTestId('players-search-input');

  await expect(searchInput).toBeVisible();

});

test('@prod-safe PROD-SAFE-005 Guest is gated from messages', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/messages');
  await dismissCookieBanner(page);

  // ---------- Final verification ----------

  const signInPrompt = page.getByText(/sign in to view messages/i);
  const messageItems = page.locator(CONVERSATION_ROW);

  await expect(signInPrompt).toBeVisible();
  await expect(messageItems).toHaveCount(0);

});

// =====================================================================
// Home and navigation
// =====================================================================

test('@prod-safe PROD-SAFE-006 Main navigation opens every directory', async ({ page }) => {

  // ---------- Test data ----------

  const links = [
    { name: 'Players', path: '/players', ready: 'players-search-input' },
    { name: 'Games', path: '/play', ready: 'play-page-search-input' },
    { name: 'Coaches', path: '/coaches', ready: 'coaches-search-input' },
    { name: 'Clubs', path: '/clubs', ready: 'clubs-search-input' },
    { name: 'Travels', path: '/travels', ready: 'travel-search-input' },
    { name: 'Articles', path: '/articles', ready: 'articles-search-input' },
  ];

  // ---------- Open page ----------

  await page.setViewportSize(DESKTOP);
  await openPage(page, '/');
  const nav = page.getByRole('navigation', { name: 'Main' });

  for (const link of links) {

    // ---------- Actions ----------

    await nav.getByRole('link', { name: link.name, exact: true }).click();

    // ---------- Verify ----------

    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(link.path)}$`));
    await expect(page.getByTestId(link.ready)).toBeVisible(PAGE_READY);
    await expect(nav.getByRole('link', { name: link.name, exact: true })).toHaveAttribute('aria-current', 'page');
  }

  // ---------- Final verification ----------

  await page.getByTestId('navbar-logo-link').click();
  await expect(page).toHaveURL(/\/$/);

});

test('@prod-safe PROD-SAFE-007 Mobile menu opens and navigates', async ({ page }) => {

  // ---------- Open page ----------

  await page.setViewportSize(PHONE);
  await openPage(page, '/');

  // ---------- Actions ----------

  await page.getByTestId('button-mobile-menu').click();

  // ---------- Verify ----------

  for (const id of ['players', 'games', 'coaches', 'clubs', 'travels', 'articles']) {
    await expect(page.getByTestId(`drawer-link-${id}`)).toBeVisible();
  }

  // ---------- Actions ----------

  await page.getByTestId('drawer-link-coaches').click();

  // ---------- Final verification ----------

  await expect(page).toHaveURL(/\/coaches$/);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('coaches-search-input-mobile')).toBeVisible(PAGE_READY);

});

// =====================================================================
// Authentication and access (nothing is submitted)
// =====================================================================

test('@prod-safe PROD-SAFE-008 Sign-in page renders and the visitor is a guest', async ({ page, request }) => {

  // ---------- Open page ----------

  await openPage(page, '/auth');

  // ---------- Verify ----------

  await expect(page.getByTestId('login-tab')).toHaveAttribute('data-state', 'active');
  await expect(page.getByTestId('login-email')).toBeVisible();
  await expect(page.getByTestId('login-password')).toBeVisible();
  await expect(page.getByTestId('login-button')).toBeEnabled();
  await expect(page.getByTestId('register-tab')).toBeVisible();
  await expect(page.getByTestId('forgot-password-link')).toBeVisible();

  // ---------- Final verification ----------

  const me = await getJson<{ authenticated: boolean; user: unknown }>(request, '/api/auth/me');
  expect(me).toEqual({ authenticated: false, user: null });

});

test('@prod-safe PROD-SAFE-009 Forgot-password form opens without sending anything', async ({ page }) => {

  // ---------- Open page ----------

  await openPage(page, '/auth');

  // ---------- Actions ----------

  await page.getByTestId('forgot-password-link').click();

  // ---------- Final verification ----------

  // The form is shown; nothing is typed or sent (no reset email).
  await expect(page.getByTestId('forgot-email-input')).toBeVisible();
  await expect(page.getByTestId('forgot-email-input')).toHaveValue('');
  await expect(page.getByTestId('send-reset-link-button')).toBeVisible();
  await expect(page.getByTestId('forgot-password-success')).toHaveCount(0);

});

test('@prod-safe PROD-SAFE-010 Reset-password page without a token shows an invalid link', async ({ page }) => {

  // ---------- Open page ----------

  await openPage(page, '/reset-password');

  // ---------- Final verification ----------

  await expect(page.getByRole('heading', { name: 'Invalid Reset Link' })).toBeVisible(PAGE_READY);
  await expect(page.getByTestId('new-password-input')).toHaveCount(0);
  await expect(page.getByTestId('reset-password-button')).toHaveCount(0);

});

test('@prod-safe PROD-SAFE-011 Guest is gated from the admin panel', async ({ page }) => {

  // ---------- Open page ----------

  await openPage(page, '/admin');

  // ---------- Final verification ----------

  await expect(page.getByText(/admin access required/i)).toBeVisible(PAGE_READY);
  await expect(page.getByRole('tab')).toHaveCount(0);

});

test('@prod-safe PROD-SAFE-012 Guest is sent to sign in from Organiser Hub pages', async ({ page }) => {

  // ---------- Test data ----------

  const routes = ['/organiser', '/organiser/sessions', '/organiser/seasons', '/organiser/players', '/organiser/reports'];

  for (const route of routes) {

    // ---------- Open page ----------

    await openPage(page, route);

    // ---------- Verify ----------

    await expect(page, route).toHaveURL(/\/auth(\?.*)?$/, PAGE_READY);
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('organiser-bar-logo')).toHaveCount(0);
  }

});

test('@prod-safe PROD-SAFE-013 Organiser, admin and inbox APIs refuse guests without data', async ({ request }) => {

  // ---------- Test data ----------

  const protectedUrls = [
    '/api/organizer/sessions/mine',
    '/api/organizer/players/mine',
    '/api/organizer/dashboard/stats',
    '/api/organizer/seasons',
    '/api/organizer/reports',
    '/api/organizer/requests',
    '/api/admin/users',
    '/api/messages',
  ];

  for (const url of protectedUrls) {

    // ---------- Actions ----------

    const response = await request.get(url);

    // ---------- Verify request ----------

    expect(response.status(), url).toBe(401);

    // ---------- Final verification ----------

    // Only the error message - no records, counts or user fields.
    const body = await response.json();
    expect(Object.keys(body), url).toEqual(['message']);
  }

});

// =====================================================================
// Play (typing searches with GET; Enter / the search button are never used)
// =====================================================================

test('@prod-safe PROD-SAFE-014 Play page lists what the API returns', async ({ page }) => {

  // ---------- Open page ----------

  const firstLoad = nextAppGet(page, '/api/play/sessions', { search: null, format: null });
  await openPage(page, '/play');

  // ---------- Verify request ----------

  const response = await firstLoad;
  expect(response.ok()).toBeTruthy();
  const { sessions } = (await response.json()) as { sessions: unknown[] };

  // ---------- Final verification ----------

  await expect(page.getByTestId('play-page-title')).toBeVisible(PAGE_READY);
  await waitForPlayList(page);
  if (sessions.length > 0) {
    await expect(page.getByTestId('play-page-results-count')).toHaveText(sessionsFoundText(sessions.length));
    await expect(playCards(page).first()).toBeVisible();
  } else {
    await expect(page.getByTestId('play-page-empty')).toBeVisible();
  }

});

test('@prod-safe PROD-SAFE-015 Play search filters by typing and shows the no-matches state', async ({ page }) => {

  // ---------- Open page ----------

  await openPage(page, '/play');
  await waitForPlayList(page);
  const countText = page.getByTestId('play-page-results-count');
  const before = (await countText.count()) > 0 ? await countText.textContent() : null;

  // ---------- Actions ----------

  const searched = nextAppGet(page, '/api/play/sessions', { search: NO_MATCH });
  await page.getByTestId('play-page-search-input').fill(NO_MATCH);

  // ---------- Verify request ----------

  const response = await searched;
  expect(response.ok()).toBeTruthy();
  expect(((await response.json()) as { sessions: unknown[] }).sessions).toEqual([]);

  // ---------- Verify ----------

  await expect(page.getByTestId('play-page-no-matches')).toBeVisible();
  await expect(playCards(page)).toHaveCount(0);

  // ---------- Final verification ----------

  await page.getByTestId('play-page-search-input').fill('');
  await expect(page.getByTestId('play-page-no-matches')).toBeHidden();
  if (before) await expect(page.getByTestId('play-page-results-count')).toHaveText(before);

});

test('@prod-safe PROD-SAFE-016 Play format filter updates the results', async ({ page }) => {

  // ---------- Open page ----------

  await page.setViewportSize(DESKTOP);
  await openPage(page, '/play');
  await waitForPlayList(page);

  // ---------- Actions ----------

  await page.getByTestId('play-quick-filter-open').click();
  await page.getByTestId('play-filter-format').click();
  const filtered = nextAppGet(page, '/api/play/sessions', { format: 'americano' });
  await page.getByTestId('play-filter-format-americano').click();
  await page.getByTestId('play-filters-show-results').click();

  // ---------- Verify request ----------

  const response = await filtered;
  expect(response.ok()).toBeTruthy();
  const { sessions } = (await response.json()) as { sessions: { type: string }[] };
  expect(sessions.every((s) => s.type === 'americano')).toBeTruthy();

  // ---------- Final verification ----------

  await expect(page.getByTestId('play-filters-dialog')).toBeHidden();
  await expect(page.getByTestId('play-chip-format')).toBeVisible();
  if (sessions.length > 0) {
    await expect(page.getByTestId('play-page-results-count')).toHaveText(sessionsFoundText(sessions.length));
  } else {
    await expect(page.getByTestId('play-page-no-matches')).toBeVisible();
  }

});

test('@prod-safe PROD-SAFE-017 Event Quick View opens for a listed event; guests cannot join', async ({ page }) => {

  // ---------- Open page ----------

  await openPage(page, '/play');
  await waitForPlayList(page);
  const viewButtons = playCards(page);
  test.skip((await viewButtons.count()) === 0, 'No published sessions on this environment.');

  // ---------- Test data ----------

  const viewId = (await viewButtons.first().getAttribute('data-testid'))!;
  const cardId = viewId.replace(/-view$/, '');
  const title = (await page.getByTestId(`${cardId}-title`).innerText()).trim();

  // ---------- Actions ----------

  await viewButtons.first().click();

  // ---------- Verify ----------

  const modal = page.getByTestId('event-quick-view-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId('event-modal-title')).toHaveText(title);
  await expect(modal.getByTestId('event-modal-datetime')).toBeVisible();

  // ---------- Final verification ----------

  // A guest is offered sign-in (or the partner's own site), never Join.
  await expect(modal.getByTestId('event-modal-signin').or(modal.getByTestId('event-modal-view-original'))).toBeVisible();
  await expect(modal.getByTestId('event-modal-join')).toHaveCount(0);
  await expect(modal.getByTestId('event-modal-join-waitlist')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();

});

// =====================================================================
// Coaches (filters run on the server over the whole directory)
// =====================================================================

test('@prod-safe PROD-SAFE-018 Coaches directory lists every coach by default', async ({ page, request }) => {

  // ---------- Open page ----------

  const firstLoad = nextAppGet(page, '/api/coaches', { page: '1', q: null, location: null, maxRate: null });
  await openPage(page, '/coaches');

  // ---------- Verify request ----------

  const shown = (await (await firstLoad).json()) as CoachesApi;
  const all = await getJson<CoachesApi>(request, '/api/coaches?page=1&limit=16');
  expect(shown.pagination.total).toBe(all.pagination.total);

  // ---------- Final verification ----------

  await expect(coachesTotal(page)).toHaveAttribute('data-total', String(all.pagination.total), PAGE_READY);
  if (all.pagination.total > 0) {
    await expect(coachCards(page)).toHaveCount(Math.min(16, all.pagination.total));
  } else {
    await expect(page.getByRole('heading', { name: 'No coaches found' })).toBeVisible();
  }
  if (all.pagination.totalPages > 1) {
    await expect(page.getByTestId(`pagination-page-${all.pagination.totalPages}`)).toBeVisible();
  }

});

test('@prod-safe PROD-SAFE-019 Coaches search finds a coach from any page and shows the empty state', async ({ page, request }) => {

  // ---------- Open page ----------

  await openPage(page, '/coaches');
  await expect(coachesTotal(page)).toHaveAttribute('data-total', /\d+/, PAGE_READY);
  const search = page.getByTestId('coaches-search-input');

  // ---------- Actions ----------

  const noMatch = nextAppGet(page, '/api/coaches', { page: '1', q: NO_MATCH });
  await search.fill(NO_MATCH);

  // ---------- Verify ----------

  expect((await noMatch).ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'No coaches found' })).toBeVisible();
  await expect(coachCards(page)).toHaveCount(0);

  // ---------- Test data ----------

  const all = await getJson<CoachesApi>(request, '/api/coaches?page=1&limit=16');
  test.skip(all.pagination.total === 0, 'No listed coaches on this environment.');
  const lastPage = await getJson<CoachesApi>(request, `/api/coaches?page=${all.pagination.totalPages}&limit=16`);
  const target = lastPage.coaches[lastPage.coaches.length - 1];

  // ---------- Actions ----------

  const found = nextAppGet(page, '/api/coaches', { page: '1', q: target.name.trim() });
  await search.fill(target.name);

  // ---------- Final verification ----------

  expect((await found).ok()).toBeTruthy();
  await expect(page.getByTestId(`coach-card-${target.id}`)).toBeVisible();

});

test('@prod-safe PROD-SAFE-020 Coaches price filter reads formatted rates such as "$80/hr"', async ({ page, request }) => {

  // ---------- Test data ----------

  const MAX = 70;
  const all = await getJson<CoachesApi>(request, '/api/coaches?page=1&limit=100');
  const expected = await getJson<CoachesApi>(request, `/api/coaches?page=1&limit=100&maxRate=${MAX}`);

  // The server's count must equal what parsing each coach's own rate text gives
  // (a "$80/hr" coach used to be NaN and vanished from every list).
  if (all.pagination.total <= 100) {
    const parsedWithin = all.coaches.filter((c) => {
      const rate = parseHourlyRate(c.rate);
      return rate !== null && rate <= MAX;
    });
    expect(expected.pagination.total).toBe(parsedWithin.length);
  }

  // ---------- Open page ----------

  await openPage(page, '/coaches');
  await expect(coachesTotal(page)).toHaveAttribute('data-total', String(all.pagination.total), PAGE_READY);

  // ---------- Actions ----------

  const filtered = nextAppGet(page, '/api/coaches', { page: '1', maxRate: String(MAX) });
  await page.getByTestId(`coaches-shortcut-under-${MAX}`).click();

  // ---------- Verify request ----------

  const body = (await (await filtered).json()) as CoachesApi;
  expect(body.pagination.total).toBe(expected.pagination.total);
  for (const coach of body.coaches) {
    const rate = parseHourlyRate(coach.rate);
    expect(rate !== null && rate <= MAX, `rate "${coach.rate}" is within $${MAX}`).toBeTruthy();
  }

  // ---------- Final verification ----------

  await expect(coachesTotal(page)).toHaveAttribute('data-total', String(expected.pagination.total));
  const unfiltered = nextAppGet(page, '/api/coaches', { page: '1', maxRate: null });
  await page.getByTestId(`coaches-shortcut-under-${MAX}`).click();
  expect((await unfiltered).ok()).toBeTruthy();
  await expect(coachesTotal(page)).toHaveAttribute('data-total', String(all.pagination.total));

});

test('@prod-safe PROD-SAFE-021 Coaches location filter lists only that location', async ({ page, request }) => {

  // ---------- Test data ----------

  const all = await getJson<CoachesApi>(request, '/api/coaches?page=1&limit=16');
  test.skip(all.locations.length === 0, 'No coach locations on this environment.');
  const location = all.locations[0];
  const expected = await getJson<CoachesApi>(request, `/api/coaches?page=1&limit=16&location=${encodeURIComponent(location)}`);

  // ---------- Open page ----------

  await page.setViewportSize(DESKTOP);
  await openPage(page, '/coaches');
  await expect(coachesTotal(page)).toHaveAttribute('data-total', String(all.pagination.total), PAGE_READY);

  // ---------- Actions ----------

  await page.getByTestId('coaches-filters-open').click();
  await page.getByTestId('coaches-location-filter').click();
  const filtered = nextAppGet(page, '/api/coaches', { page: '1', location });
  await page.getByRole('option', { name: location, exact: true }).click();
  await page.getByTestId('coaches-filters-show-results').click();

  // ---------- Verify request ----------

  const body = (await (await filtered).json()) as CoachesApi;
  expect(body.pagination.total).toBe(expected.pagination.total);
  expect(body.coaches.every((c) => c.location === location)).toBeTruthy();

  // ---------- Final verification ----------

  await expect(coachesTotal(page)).toHaveAttribute('data-total', String(expected.pagination.total));
  await expect(coachCards(page)).toHaveCount(Math.min(16, expected.pagination.total));

});

test('@prod-safe PROD-SAFE-022 Coach profile opens and contact details stay behind sign-in', async ({ page, request }) => {

  // ---------- Test data ----------

  const all = await getJson<CoachesApi>(request, '/api/coaches?page=1&limit=16');
  test.skip(all.coaches.length === 0, 'No listed coaches on this environment.');
  const coach = all.coaches[0];

  // ---------- Open page ----------

  await openPage(page, '/coaches');
  const card = page.getByTestId(`coach-card-${coach.id}`);
  await expect(card).toBeVisible(PAGE_READY);

  // ---------- Actions ----------

  await card.getByRole('link', { name: /view profile/i }).click();

  // ---------- Verify ----------

  await expect(page).toHaveURL(new RegExp(`/coach/${escapeRegExp(coach.slug)}$`));
  await expect(page.getByTestId('coach-name-display')).toContainText(coach.name.trim(), PAGE_READY);

  // ---------- Final verification ----------

  await page.getByTestId('contact-tab').click();
  await expect(page.getByTestId('coach-contact-signed-out')).toBeVisible();
  await expect(page.getByTestId('coach-contact-sign-in')).toHaveAttribute('href', /^\/auth\?returnTo=/);

});

// =====================================================================
// Players
// =====================================================================

const playerProfileLinks = (page: Page) => page.getByRole('link', { name: /^View .+'s profile$/ });

test('@prod-safe PROD-SAFE-023 Players directory loads and search narrows the list', async ({ page }) => {

  // ---------- Open page ----------

  await openPage(page, '/players');
  const cards = page.locator('[data-testid^="player-card-"]');
  const empty = page.getByRole('heading', { name: 'No partners found' });
  await expect(cards.first().or(empty)).toBeVisible(PAGE_READY);
  const initialCount = await cards.count();
  test.skip(initialCount === 0, 'No players listed on this environment.');

  // ---------- Test data ----------

  const label = (await playerProfileLinks(page).first().getAttribute('aria-label'))!;
  const name = label.replace(/^View /, '').replace(/'s profile$/, '');

  // ---------- Actions ----------

  const search = page.getByTestId('players-search-input');
  await search.fill(name);

  // ---------- Verify ----------

  await expect(page.getByRole('link', { name: label, exact: true }).first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(initialCount);

  // ---------- Actions ----------

  await search.fill(NO_MATCH);

  // ---------- Final verification ----------

  await expect(empty).toBeVisible();
  await expect(cards).toHaveCount(0);
  await search.fill('');
  await expect(cards).toHaveCount(initialCount);

});

test('@prod-safe PROD-SAFE-024 Players "Looking to Play" filter lists only players looking to play', async ({ page }) => {

  // ---------- Open page ----------

  await page.setViewportSize(DESKTOP);
  await openPage(page, '/players');
  const cards = page.locator('[data-testid^="player-card-"]');
  await expect(cards.first().or(page.getByRole('heading', { name: 'No partners found' }))).toBeVisible(PAGE_READY);

  // ---------- Actions ----------

  await page.getByTestId('players-filters-open').click();
  const filtered = nextAppGet(page, '/api/players', { lookingToPlay: 'true' });
  await page.getByTestId('players-filter-looking-to-play').click();

  // ---------- Verify request ----------

  const response = await filtered;
  expect(response.ok()).toBeTruthy();
  const { players } = (await response.json()) as { players: { lookingToPlay?: boolean }[] };
  expect(players.every((p) => p.lookingToPlay === true)).toBeTruthy();

  // ---------- Final verification ----------

  await expect(page.getByTestId('players-filter-looking-to-play')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('players-filters-show-results').click();
  await expect(cards).toHaveCount(players.length);

});

test('@prod-safe PROD-SAFE-025 Player profile opens from the directory', async ({ page, request }) => {

  // ---------- Test data ----------

  const { players } = await getJson<{ players: unknown[] }>(request, '/api/players?page=1&limit=20');
  test.skip(players.length === 0, 'No listed players on this environment (the page shows demo cards).');

  // ---------- Open page ----------

  await openPage(page, '/players');
  const link = playerProfileLinks(page).first();
  await expect(link).toBeVisible(PAGE_READY);
  const href = (await link.getAttribute('href'))!;
  const name = (await link.getAttribute('aria-label'))!.replace(/^View /, '').replace(/'s profile$/, '');
  expect(href).toMatch(/^\/player\/[^/?#]+$/);

  // ---------- Actions ----------

  await link.click();

  // ---------- Final verification ----------

  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(href)}$`));
  await expect(page.getByTestId('player-name-display')).toContainText(name, PAGE_READY);

});

// =====================================================================
// Clubs
// =====================================================================

type ClubApi = { id: string; name: string; slug: string | null; listingType: string | null };

test('@prod-safe PROD-SAFE-026 Clubs directory loads and search narrows the list', async ({ page }) => {

  // ---------- Open page ----------

  await openPage(page, '/clubs');
  const cards = page.getByTestId('club-card');
  await expect(cards.first()).toBeVisible(PAGE_READY);

  // ---------- Test data ----------

  const name = (await cards.first().getByRole('heading', { level: 2 }).first().innerText()).trim();

  // ---------- Actions ----------

  const search = page.getByTestId('clubs-search-input');
  await search.fill(name);

  // ---------- Verify ----------

  await expect(cards.filter({ hasText: name }).first()).toBeVisible();

  // ---------- Actions ----------

  await search.fill(NO_MATCH);

  // ---------- Final verification ----------

  await expect(page.getByRole('heading', { name: 'No clubs found' })).toBeVisible();
  await expect(cards).toHaveCount(0);

});

test('@prod-safe PROD-SAFE-027 Club details open for a listed premium club', async ({ page, request }) => {

  // ---------- Test data ----------

  const clubs = await getJson<ClubApi[]>(request, '/api/clubs');
  const club = clubs.find((c) => c.slug && c.listingType === 'premium');
  test.skip(!club, 'No premium club with a detail page on this environment.');

  // ---------- Open page ----------

  await openPage(page, '/clubs');
  await expect(page.getByTestId('club-card').first()).toBeVisible(PAGE_READY);
  await page.getByTestId('clubs-search-input').fill(club!.name);

  // ---------- Actions ----------

  await page.getByTestId('club-card-name-link').filter({ hasText: club!.name }).first().click();

  // ---------- Final verification ----------

  await expect(page).toHaveURL(new RegExp(`/clubs/${escapeRegExp(club!.slug!)}$`));
  await expect(visibleOne(page.getByTestId('club-detail-name').or(page.getByTestId('club-detail-name-mobile')))).toContainText(club!.name, PAGE_READY);

});

// =====================================================================
// Travel and articles
// =====================================================================

type TravelApi = { id: string; slug: string; title: string; startDate: string | null; duration?: string | null; isActive?: boolean | null };
type ArticleApi = { id: string; slug: string; title: string };

test('@prod-safe PROD-SAFE-028 Travel listings show every active retreat', async ({ page, request }) => {

  // ---------- Test data ----------

  const packages = await getJson<TravelApi[]>(request, '/api/travel');

  // ---------- Open page ----------

  await openPage(page, '/travels');

  // ---------- Final verification ----------

  await expect(page.getByTestId('travel-search-input')).toBeVisible(PAGE_READY);
  const cards = page.locator('[data-testid^="travel-card-"]');
  if (packages.length > 0) {
    await expect(cards).toHaveCount(packages.length, PAGE_READY);
  } else {
    await expect(page.getByRole('heading', { name: 'No packages found' })).toBeVisible(PAGE_READY);
  }

});

test('@prod-safe PROD-SAFE-029 Ended retreats are marked Archived and listed after upcoming ones', async ({ page, request }) => {

  // ---------- Test data ----------

  const packages = await getJson<TravelApi[]>(request, '/api/travel');
  test.skip(packages.length === 0, 'No retreats on this environment.');
  const archived = new Set(packages.filter((p) => isRetreatArchived(p)).map((p) => p.id));

  // ---------- Open page ----------

  await openPage(page, '/travels');
  const cards = page.locator('[data-testid^="travel-card-"]');
  await expect(cards).toHaveCount(packages.length, PAGE_READY);

  // ---------- Verify ----------

  for (const pkg of packages) {
    const badge = page.getByTestId(`travel-card-${pkg.id}`).getByTestId('retreat-archived-badge');
    await expect(badge, `${pkg.title}: archived = ${archived.has(pkg.id)}`).toHaveCount(archived.has(pkg.id) ? 1 : 0);
  }

  // ---------- Final verification ----------

  const order = (await cards.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''))).map((id) =>
    id.replace(/^travel-card-/, ''),
  );
  const firstArchived = order.findIndex((id) => archived.has(id));
  if (firstArchived >= 0) {
    expect(order.slice(firstArchived).every((id) => archived.has(id)), 'no upcoming retreat after an archived one').toBeTruthy();
  }

});

test('@prod-safe PROD-SAFE-030 Retreat details open from the listing', async ({ page, request }) => {

  // ---------- Test data ----------

  const packages = await getJson<TravelApi[]>(request, '/api/travel');
  test.skip(packages.length === 0, 'No retreats on this environment.');
  const pkg = packages[0];

  // ---------- Open page ----------

  await openPage(page, '/travels');
  const card = page.getByTestId(`travel-card-${pkg.id}`);
  await expect(card).toBeVisible(PAGE_READY);

  // ---------- Actions ----------

  await card.getByRole('link').first().click();

  // ---------- Final verification ----------

  await expect(page).toHaveURL(new RegExp(`/travels/${escapeRegExp(pkg.slug)}$`));
  await expect(visibleOne(page.getByRole('heading', { level: 1 }).filter({ hasText: pkg.title.trim() }))).toBeVisible(PAGE_READY);
  await expect(page.getByRole('heading', { name: 'Package not found' })).toHaveCount(0);

});

test('@prod-safe PROD-SAFE-031 Articles directory lists published articles and search narrows it', async ({ page, request }) => {

  // ---------- Test data ----------

  const articles = await getJson<ArticleApi[]>(request, '/api/articles');

  // ---------- Open page ----------

  await openPage(page, '/articles');
  await expect(page.getByTestId('articles-search-input')).toBeVisible(PAGE_READY);
  const cards = page.locator('[data-testid^="article-card-"]');
  const empty = page.getByRole('heading', { name: 'No articles found' });

  // ---------- Verify ----------

  if (articles.length === 0) {
    await expect(empty).toBeVisible(PAGE_READY);
    return;
  }
  await expect(cards).toHaveCount(articles.length, PAGE_READY);

  // ---------- Actions ----------

  const search = page.getByTestId('articles-search-input');
  await search.fill(articles[0].title);

  // ---------- Verify ----------

  await expect(page.getByTestId(`article-card-${articles[0].id}`)).toBeVisible();

  // ---------- Actions ----------

  await search.fill(NO_MATCH);

  // ---------- Final verification ----------

  await expect(empty).toBeVisible();
  await expect(cards).toHaveCount(0);

});

test('@prod-safe PROD-SAFE-032 Published article opens from the directory', async ({ page, request }) => {

  // ---------- Test data ----------

  const articles = await getJson<ArticleApi[]>(request, '/api/articles');
  test.skip(articles.length === 0, 'No published articles on this environment.');
  const article = articles[0];

  // ---------- Open page ----------

  await openPage(page, '/articles');
  const card = page.getByTestId(`article-card-${article.id}`);
  await expect(card).toBeVisible(PAGE_READY);

  // ---------- Actions ----------

  await card.getByRole('link').first().click();

  // ---------- Final verification ----------

  await expect(page).toHaveURL(new RegExp(`/articles/${escapeRegExp(article.slug)}$`));
  await expect(visibleOne(page.getByRole('heading', { level: 1 }).filter({ hasText: article.title.trim() }))).toBeVisible(PAGE_READY);
  await expect(page.getByRole('heading', { name: 'Article not found' })).toHaveCount(0);

});
