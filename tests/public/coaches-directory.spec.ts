import { test, expect, type Page } from '@playwright/test';
import { dismissCookieBanner } from '../helpers/auth';

test('PUBLIC-001 Coaches directory lists coaches', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/coaches');

  // ---------- Verify ----------

  const firstCard = page.locator('[data-testid^="coach-card-"]').first();

  await expect(firstCard).toBeVisible();

});

test('PUBLIC-002 Coaches directory search filters results', async ({ page }) => {

  // Same load race as PUBLIC-006: the grid starts empty while
  // /api/coaches loads, so wait for the cards before counting.

  // ---------- Open page ----------

  await page.goto('/coaches');

  const searchInput = page.getByTestId('coaches-search-input');
  const cards = page.locator('[data-testid^="coach-card-"]');
  const noResults = page.getByRole('heading', { name: 'No coaches found' });

  await expect(searchInput).toBeVisible();
  await expect(cards.first()).toBeVisible();

  const initialCount = await cards.count();
  expect(initialCount).toBeGreaterThan(0);

  // ---------- Actions ----------

  await searchInput.fill('zzz-no-such-coach-zzz');

  // ---------- Verify ----------

  await expect(cards).toHaveCount(0);
  await expect(noResults).toBeVisible();

  await searchInput.fill('');

  await expect(cards).toHaveCount(initialCount);
  await expect(noResults).toBeHidden();

});

test('PUBLIC-003 Coaches directory pagination navigates to next page', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/coaches');

  const cards = page.locator('[data-testid^="coach-card-"]');
  // The pager only renders once the first page has loaded - without this
  // wait the skip check below could run before the list exists.
  await expect(cards.first()).toBeVisible();

  const nextButton = page.getByTestId('pagination-next-button');

  // Only relevant when there is more than one page of coaches.
  if (!(await nextButton.isVisible().catch(() => false))) {
    test.skip(true, 'Needs more than 16 listed coaches on this environment (16 per page).');
  }

  await expect(nextButton).toBeEnabled();

  const firstPageFirstCard = await cards.first().getAttribute('data-testid');
  expect(firstPageFirstCard).toBeTruthy();

  // ---------- Actions ----------

  const page2Response = page.waitForResponse(
    (r) => r.request().method() === 'GET' && r.url().includes('/api/coaches') && /[?&]page=2\b/.test(r.url()),
  );
  await nextButton.click();

  // ---------- Verify request ----------

  expect((await page2Response).ok()).toBeTruthy();

  // ---------- Verify ----------

  await expect(
    page.getByTestId('pagination-page-2')
  ).toHaveAttribute('aria-current', 'page');

  // The pager marks page 2 as soon as it's clicked, but the cards change only
  // when page 2's data has rendered. Reading the first card right away (as
  // before) raced that render and saw page 1's card. This retries until the
  // first card really is a different coach - it still fails if page 2 never
  // shows different results.
  await expect(cards.first()).not.toHaveAttribute('data-testid', firstPageFirstCard!);

});

test('PUBLIC-004 Coach card opens coach profile', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/coaches');

  const firstCard = page.locator('[data-testid^="coach-card-"]').first();
  await expect(firstCard).toBeVisible();

  // ---------- Actions ----------

  await firstCard.getByRole('link', { name: /view profile/i }).click();

  // ---------- Verify ----------

  await expect(page).toHaveURL(/\/coach\/.+/);

});

/*
  Directory filters run on the server over EVERY listed coach
  (shared/coachDirectory.ts), then the result is paged 16 at a time.
  Before, the page filtered only the 16 coaches it had loaded, so a coach
  on page 2 could never be found. These tests compare the page with what
  GET /api/coaches says for the same filters. Guest-only, GET-only.
*/

type CoachesApi = {
  coaches: { id: string; name: string; location: string; rate: string | null }[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  locations: string[];
};

async function apiCoaches(page: Page, query: Record<string, string> = {}): Promise<CoachesApi> {
  const res = await page.request.get(`/api/coaches?${new URLSearchParams({ page: '1', limit: '16', ...query })}`);
  expect(res.ok(), `GET /api/coaches ${JSON.stringify(query)} -> ${res.status()}`).toBeTruthy();
  return res.json();
}

/** The next /api/coaches response whose query matches `params` exactly (missing = must be absent). */
function nextCoachesResponse(page: Page, params: Record<string, string | null>) {
  return page.waitForResponse((r) => {
    if (r.request().method() !== 'GET') return false;
    const url = new URL(r.url());
    if (url.pathname !== '/api/coaches') return false;
    return Object.entries(params).every(([k, v]) => url.searchParams.get(k) === v);
  });
}

const cardsOf = (page: Page) => page.locator('[data-testid^="coach-card-"]');
const resultsCount = (page: Page) => page.getByTestId('coaches-results-count');

test('PUBLIC-COACH-001 By default the directory lists every coach, across all pages', async ({ page }) => {

  // ---------- Open page ----------

  const firstLoad = nextCoachesResponse(page, { page: '1', q: null, location: null, maxRate: null });
  await page.goto('/coaches');
  const shown = (await (await firstLoad).json()) as CoachesApi;

  // ---------- Verify ----------

  // The page's own unfiltered request is the whole directory.
  const expected = await apiCoaches(page);
  expect(shown.pagination.total).toBe(expected.pagination.total);
  expect(expected.pagination.total, 'environment has listed coaches').toBeGreaterThan(0);
  await expect(resultsCount(page)).toHaveAttribute('data-total', String(expected.pagination.total));
  await expect(cardsOf(page)).toHaveCount(Math.min(16, expected.pagination.total));

  // Every page together = every coach, none twice.
  const ids = new Set<string>();
  for (let p = 1; p <= expected.pagination.totalPages; p++) {
    for (const c of (await apiCoaches(page, { page: String(p) })).coaches) ids.add(c.id);
  }
  expect(ids.size).toBe(expected.pagination.total);

  if (expected.pagination.totalPages > 1) {
    await expect(page.getByTestId(`pagination-page-${expected.pagination.totalPages}`)).toBeVisible();
  }

});

test('PUBLIC-COACH-002 Search finds a coach who is not on the first page', async ({ page }) => {

  // ---------- Setup ----------

  await page.goto('/coaches');
  await expect(cardsOf(page).first()).toBeVisible();
  const all = await apiCoaches(page);
  const lastPage = await apiCoaches(page, { page: String(Math.max(1, all.pagination.totalPages)) });
  const target = lastPage.coaches[lastPage.coaches.length - 1];
  expect(target, 'a coach on the last page').toBeTruthy();

  // ---------- Actions ----------

  const searched = nextCoachesResponse(page, { page: '1', q: target.name });
  await page.getByTestId('coaches-search-input').fill(target.name);

  // ---------- Verify ----------

  expect((await searched).ok()).toBeTruthy();
  await expect(page.getByTestId(`coach-card-${target.id}`)).toBeVisible();
  const expected = await apiCoaches(page, { q: target.name });
  await expect(resultsCount(page)).toHaveAttribute('data-total', String(expected.pagination.total));

  // ---------- Final verification ----------

  // Clearing the search brings the whole directory back.
  const cleared = nextCoachesResponse(page, { page: '1', q: null });
  await page.getByTestId('coaches-search-input').fill('');
  expect((await cleared).ok()).toBeTruthy();
  await expect(resultsCount(page)).toHaveAttribute('data-total', String(all.pagination.total));

});

test('PUBLIC-COACH-003 Location filter offers every directory location and lists only that location', async ({ page }) => {

  // ---------- Setup ----------

  await page.goto('/coaches');
  await dismissCookieBanner(page);
  await expect(cardsOf(page).first()).toBeVisible();
  const all = await apiCoaches(page);
  expect(all.locations.length, 'directory has locations').toBeGreaterThan(0);
  // The least common location - most likely to be missing from page 1.
  const counts = await Promise.all(all.locations.map(async (loc) => [loc, (await apiCoaches(page, { location: loc })).pagination.total] as const));
  const [location, total] = [...counts].sort((a, b) => a[1] - b[1])[0];

  // ---------- Actions ----------

  await page.getByTestId('coaches-filters-open').click();
  await page.getByTestId('coaches-location-filter').click();
  // Every location in the directory is offered, not only page 1's.
  for (const loc of all.locations) await expect(page.getByRole('option', { name: loc, exact: true })).toBeVisible();
  const filtered = nextCoachesResponse(page, { page: '1', location });
  await page.getByRole('option', { name: location, exact: true }).click();
  await page.getByTestId('coaches-filters-show-results').click();

  // ---------- Verify ----------

  const body = (await (await filtered).json()) as CoachesApi;
  expect(body.pagination.total).toBe(total);
  expect(body.coaches.every((c) => c.location === location)).toBeTruthy();
  await expect(resultsCount(page)).toHaveAttribute('data-total', String(total));
  await expect(cardsOf(page)).toHaveCount(Math.min(16, total));
  for (const c of body.coaches) await expect(page.getByTestId(`coach-card-${c.id}`)).toContainText(location);

});

test('PUBLIC-COACH-004 A price shortcut filters the whole directory; pressing it again lists everyone', async ({ page }) => {

  // ---------- Setup ----------

  await page.goto('/coaches');
  await dismissCookieBanner(page);
  await expect(cardsOf(page).first()).toBeVisible();
  const all = await apiCoaches(page);
  const expected = await apiCoaches(page, { maxRate: '70', limit: '100' });

  // ---------- Actions ----------

  const filtered = nextCoachesResponse(page, { page: '1', maxRate: '70' });
  await page.getByTestId('coaches-shortcut-under-70').click();

  // ---------- Verify ----------

  const body = (await (await filtered).json()) as CoachesApi;
  expect(body.pagination.total).toBe(expected.pagination.total);
  for (const c of body.coaches) {
    const rate = Number(String(c.rate ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0]);
    expect(rate, `${c.name}: ${c.rate}`).toBeLessThanOrEqual(70);
  }
  await expect(resultsCount(page)).toHaveAttribute('data-total', String(expected.pagination.total));

  // ---------- Final verification ----------

  const unfiltered = nextCoachesResponse(page, { page: '1', maxRate: null });
  await page.getByTestId('coaches-shortcut-under-70').click();
  expect((await unfiltered).ok()).toBeTruthy();
  await expect(resultsCount(page)).toHaveAttribute('data-total', String(all.pagination.total));

});

test('PUBLIC-COACH-005 Changing a filter on page 2 goes back to page 1 of the filtered list', async ({ page }) => {

  // ---------- Setup ----------

  await page.goto('/coaches');
  await dismissCookieBanner(page);
  await expect(cardsOf(page).first()).toBeVisible();
  const all = await apiCoaches(page);
  test.skip(all.pagination.totalPages < 2, 'Needs more than 16 listed coaches on this environment (16 per page).');

  const page2 = nextCoachesResponse(page, { page: '2' });
  await page.getByTestId('pagination-next-button').click();
  expect((await page2).ok()).toBeTruthy();
  await expect(page.getByTestId('pagination-page-2')).toHaveAttribute('aria-current', 'page');

  // ---------- Actions ----------

  const filtered = nextCoachesResponse(page, { page: '1', maxRate: '100' });
  await page.getByTestId('coaches-shortcut-under-100').click();

  // ---------- Verify ----------

  expect((await filtered).ok()).toBeTruthy();
  const expected = await apiCoaches(page, { maxRate: '100' });
  await expect(resultsCount(page)).toHaveAttribute('data-total', String(expected.pagination.total));
  if (expected.pagination.totalPages > 1) {
    await expect(page.getByTestId('pagination-page-1')).toHaveAttribute('aria-current', 'page');
  }

});
