import { test, expect } from '@playwright/test';
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

const PAGES_USING_APP_PAGINATION = [
  { path: '/play', card: '[data-testid^="session-card"]', label: 'Games' },
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
