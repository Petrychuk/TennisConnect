import { test, expect } from '@playwright/test';

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
