import { test, expect, type Page } from '@playwright/test';
import { dismissCookieBanner } from '../helpers/auth';

/**
 * PAG-001  AppPagination — unique, ascending page numbers (no duplicates)
 *
 * Regression for TC-217: duplicate page numbers after page 5.
 * Root cause: React key collision between ellipsis items (key={index})
 * and page number buttons (key={page}) in AppPagination.
 *
 * Checks every page that uses AppPagination when enough data exists
 * to trigger the >7-page ellipsis logic.
 */

// Games is covered deterministically below (PAG-001-Games-*): it pages 6 at a
// time, so a real environment rarely has enough sessions to reach page 5.
const PAGES_USING_APP_PAGINATION = [
  { path: '/partners', card: '[data-testid^="player-card-"]', label: 'Players' },
  { path: '/coaches', card: '[data-testid^="coach-card-"]', label: 'Coaches' },
  { path: '/clubs', card: '[data-testid^="club-card-"]', label: 'Clubs' },
];

for (const { path, card, label } of PAGES_USING_APP_PAGINATION) {

  test(`PAG-001-${label} ${label} pagination renders unique ascending page numbers`, async ({ page }) => {
    await page.goto(path);
    await dismissCookieBanner(page);

    // Wait for content to load
    const cards = page.locator(card);
    const firstCard = cards.first();

    // If no content at all, skip
    if (!(await firstCard.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, `No ${label} data on this environment.`);
    }

    const paginationNumbers = page.getByTestId('pagination-page-numbers');

    // Need pagination to exist (more than 1 page)
    if (!(await paginationNumbers.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, `${label} has only one page on this environment.`);
    }

    // ---- Verify unique, ascending page numbers on page 1 ----

    const getPageNumbers = async () => {
      const buttons = paginationNumbers.locator('button');
      const count = await buttons.count();
      const numbers: number[] = [];
      for (let i = 0; i < count; i++) {
        const text = await buttons.nth(i).textContent();
        const num = parseInt(text?.trim() ?? '', 10);
        if (!isNaN(num)) numbers.push(num);
      }
      return numbers;
    };

    const page1Numbers = await getPageNumbers();
    expect(page1Numbers.length).toBeGreaterThan(0);

    // No duplicates
    const unique1 = Array.from(new Set(page1Numbers));
    expect(page1Numbers).toEqual(unique1);

    // Ascending order
    for (let i = 1; i < page1Numbers.length; i++) {
      expect(page1Numbers[i]).toBeGreaterThan(page1Numbers[i - 1]);
    }

    // Page 1 is active
    await expect(page.getByTestId('pagination-page-1')).toHaveAttribute('aria-current', 'page');

    // ---- Navigate to page 2 and verify ----

    const nextBtn = page.getByTestId('pagination-next-button');
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();

      await expect(page.getByTestId('pagination-page-2')).toHaveAttribute('aria-current', 'page');

      const page2Numbers = await getPageNumbers();
      const unique2 = Array.from(new Set(page2Numbers));
      expect(page2Numbers).toEqual(unique2);

      for (let i = 1; i < page2Numbers.length; i++) {
        expect(page2Numbers[i]).toBeGreaterThan(page2Numbers[i - 1]);
      }
    }

    // ---- Navigate to page 5+ (the ellipsis scenario) if available ----

    const totalPagesText = await page.getByTestId('pagination-current-page-mobile').textContent().catch(() => null);
    // Mobile element shows "2 / N", extract N
    const totalMatch = totalPagesText?.match(/\/\s*(\d+)/);
    const totalPages = totalMatch ? parseInt(totalMatch[1], 10) : 0;

    if (totalPages >= 8) {
      // Click page 5 directly
      await page.getByTestId('pagination-page-5').click();
      await expect(page.getByTestId('pagination-page-5')).toHaveAttribute('aria-current', 'page');

      const page5Numbers = await getPageNumbers();
      const unique5 = Array.from(new Set(page5Numbers));
      expect(page5Numbers).toEqual(unique5);

      for (let i = 1; i < page5Numbers.length; i++) {
        expect(page5Numbers[i]).toBeGreaterThan(page5Numbers[i - 1]);
      }

      // Exactly one active page button
      const activeButtons = paginationNumbers.locator('button[aria-current="page"]');
      await expect(activeButtons).toHaveCount(1);

      // Ellipsis elements should exist on both sides
      const dots = paginationNumbers.locator('span:has-text("...")');
      expect(await dots.count()).toBe(2);
    }
  });

}

/* ---------------------------------------------------------------------------
   PAG-001-Games: deterministic, read-only.

   /play pages its list in the browser, 6 sessions per page, from a single
   GET /api/play/sessions. That one response is answered here with 120
   synthetic sessions (20 pages), so the >5-page ellipsis layout is always
   exercised and nothing is read from or written to the environment. The
   visitor is a guest: no login, no data created.
--------------------------------------------------------------------------- */

const MOCK_TOTAL = 120;
const MOCK_PAGE_SIZE = 6; // PAGE_SIZE in client/src/pages/play.tsx
const MOCK_PAGES = MOCK_TOTAL / MOCK_PAGE_SIZE;

const mockId = (n: number) => `pagmock${String(n).padStart(3, '0')}`;
const mockTitle = (n: number) => `Pagination mock session ${String(n).padStart(3, '0')}`;

function mockSessions() {
  return Array.from({ length: MOCK_TOTAL }, (_, i) => {
    const n = i + 1;
    return {
      id: mockId(n),
      title: mockTitle(n),
      type: 'social',
      playStatus: 'open',
      startAt: new Date(Date.now() + n * 24 * 3600 * 1000).toISOString(),
      endAt: null,
      timeZone: 'Australia/Sydney',
      location: 'Mock Tennis Centre',
      latitude: null,
      longitude: null,
      skillLevel: null,
      courtsCount: 2,
      maxParticipants: 8,
      registeredCount: 2,
      coverImage: null,
      organizationId: 'pagmock-org',
      organizationName: 'Pagination Mock Club',
      organizationSlug: 'pagination-mock-club',
      organizationLogo: null,
      sourceType: 'TENNISCONNECT',
    };
  });
}

async function openMockedGames(page: Page) {
  const sessions = mockSessions();
  // Only the list: /api/play/sessions/<id> (a single session) is not matched.
  await page.route(
    (url) => url.pathname === '/api/play/sessions',
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions }) })
        : route.continue(),
  );
  await page.goto('/play');
  await dismissCookieBanner(page);
  await expect(cardOf(page, 1)).toBeVisible();
}

// The card's own element (its children share the testid prefix).
const cardOf = (page: Page, n: number) => page.getByTestId(`play-session-card-${mockId(n)}`);

async function visibleCardTitles(page: Page): Promise<string[]> {
  const cards = page.locator('div[role="button"][data-testid^="play-session-card-pagmock"]');
  const titles: string[] = [];
  for (let i = 0; i < (await cards.count()); i++) {
    titles.push(((await cards.nth(i).locator('h3').textContent()) ?? '').trim());
  }
  return titles;
}

async function pageNumbers(page: Page): Promise<number[]> {
  const buttons = page.getByTestId('pagination-page-numbers').locator('button');
  const out: number[] = [];
  for (let i = 0; i < (await buttons.count()); i++) {
    out.push(parseInt(((await buttons.nth(i).textContent()) ?? '').trim(), 10));
  }
  return out;
}

// The page the list shows, the pager and the numbers all agree on `current`.
async function expectPagerAt(page: Page, current: number, expected: { numbers: number[]; gaps: number }) {
  const numbers = page.getByTestId('pagination-page-numbers');

  // Exactly the intended numbers, once each, ascending.
  await expect(numbers.locator('button')).toHaveCount(expected.numbers.length);
  const shown = await pageNumbers(page);
  expect(shown).toEqual(expected.numbers);
  expect(new Set(shown).size).toBe(shown.length);
  expect(shown).toEqual([...shown].sort((a, b) => a - b));

  // One ellipsis per omitted range, never a number.
  await expect(numbers.locator('span', { hasText: '...' })).toHaveCount(expected.gaps);

  // One active page, and it is the current one.
  await expect(numbers.locator('button[aria-current="page"]')).toHaveCount(1);
  await expect(page.getByTestId(`pagination-page-${current}`)).toHaveAttribute('aria-current', 'page');

  // The list underneath is that page's slice.
  const first = (current - 1) * MOCK_PAGE_SIZE + 1;
  const titles = Array.from({ length: MOCK_PAGE_SIZE }, (_, i) => mockTitle(first + i));
  await expect(page.locator('div[role="button"][data-testid^="play-session-card-pagmock"]')).toHaveCount(MOCK_PAGE_SIZE);
  expect(await visibleCardTitles(page)).toEqual(titles);
}

test('PAG-001-Games-desktop Games pagination: unique ascending numbers, one active page, pages 5-7, Previous/Next', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMockedGames(page);

  const prev = page.getByTestId('pagination-prev-button');
  const next = page.getByTestId('pagination-next-button');

  // ---------- First page ----------
  await expectPagerAt(page, 1, { numbers: [1, 2, MOCK_PAGES], gaps: 1 });
  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();

  // ---------- Walk forward with Next to page 7 (past the page-5 boundary) ----------
  // What each page must show: the first, the current page and its neighbours,
  // the last - once each - with an ellipsis only for an omitted range.
  const walk: Record<number, { numbers: number[]; gaps: number }> = {
    2: { numbers: [1, 2, 3, MOCK_PAGES], gaps: 1 },
    3: { numbers: [1, 2, 3, 4, MOCK_PAGES], gaps: 1 },
    4: { numbers: [1, 3, 4, 5, MOCK_PAGES], gaps: 2 },
    5: { numbers: [1, 4, 5, 6, MOCK_PAGES], gaps: 2 },
    6: { numbers: [1, 5, 6, 7, MOCK_PAGES], gaps: 2 },
    7: { numbers: [1, 6, 7, 8, MOCK_PAGES], gaps: 2 },
  };
  for (let n = 2; n <= 7; n++) {
    await next.click();
    await expectPagerAt(page, n, walk[n]);
    await expect(prev).toBeEnabled();
  }

  // ---------- Pages 5, 6 and 7 by number (each target is on screen in the previous state) ----------
  for (const n of [6, 5, 6, 7, 6, 5]) {
    await page.getByTestId(`pagination-page-${n}`).click();
    await expectPagerAt(page, n, walk[n]);
  }

  // ---------- Previous ----------
  await prev.click();
  await expectPagerAt(page, 4, walk[4]);

  // ---------- Last page ----------
  await page.getByTestId(`pagination-page-${MOCK_PAGES}`).click();
  await expectPagerAt(page, MOCK_PAGES, { numbers: [1, MOCK_PAGES - 1, MOCK_PAGES], gaps: 1 });
  await expect(next).toBeDisabled();
  await expect(prev).toBeEnabled();

  // ---------- Back to the first page ----------
  await page.getByTestId('pagination-page-1').click();
  await expectPagerAt(page, 1, { numbers: [1, 2, MOCK_PAGES], gaps: 1 });
  await expect(prev).toBeDisabled();
});

test('PAG-001-Games-mobile Games pagination on a phone: compact "n / N" pager steps through pages 5-7 without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMockedGames(page);

  const prev = page.getByTestId('pagination-prev-button-mobile');
  const next = page.getByTestId('pagination-next-button-mobile');
  const position = page.getByTestId('pagination-current-page-mobile');

  // The phone pager replaces the row of page numbers.
  await expect(page.getByTestId('pagination-page-numbers')).toBeHidden();
  await expect(position).toHaveText(`1 / ${MOCK_PAGES}`);
  await expect(prev).toBeDisabled();

  for (let n = 2; n <= 7; n++) {
    await next.click();
    await expect(position).toHaveText(`${n} / ${MOCK_PAGES}`);
    if (n >= 5) {
      const first = (n - 1) * MOCK_PAGE_SIZE + 1;
      expect(await visibleCardTitles(page)).toEqual(
        Array.from({ length: MOCK_PAGE_SIZE }, (_, i) => mockTitle(first + i)),
      );
    }
  }

  await prev.click();
  await expect(position).toHaveText(`6 / ${MOCK_PAGES}`);

  // 20 pages must not widen the page (SEARCH-050 was exactly this overflow).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
