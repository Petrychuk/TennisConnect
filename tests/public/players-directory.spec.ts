import { test, expect } from '@playwright/test';

test('PUBLIC-005 Players directory lists players', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/players');

  // ---------- Verify ----------

  const firstCard = page.locator('[data-testid^="player-card-"]').first();

  await expect(firstCard).toBeVisible();

});

test('PUBLIC-006 Players directory search filters results', async ({ page }) => {

  // The list is fetched after the page renders (GET /api/players) and the
  // grid starts empty, so wait for the cards before counting - counting
  // straight away read 0 and made the "no results" check meaningless.

  // ---------- Open page ----------

  await page.goto('/players');

  const searchInput = page.getByTestId('players-search-input');
  const cards = page.locator('[data-testid^="player-card-"]');
  const noResults = page.getByRole('heading', { name: 'No partners found' });

  await expect(searchInput).toBeVisible();
  await expect(cards.first()).toBeVisible();

  const initialCount = await cards.count();
  expect(initialCount).toBeGreaterThan(0);

  // ---------- Actions ----------

  await searchInput.fill('zzz-no-such-player-zzz');

  // ---------- Verify ----------

  await expect(cards).toHaveCount(0);
  await expect(noResults).toBeVisible();

  await searchInput.fill('');

  await expect(cards).toHaveCount(initialCount);
  await expect(noResults).toBeHidden();

});

test('PUBLIC-007 Players directory pagination navigates to next page', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/players');

  const cards = page.locator('[data-testid^="player-card-"]');
  // The pager only renders once the first page has loaded - without this
  // wait the skip check below could run before the list exists.
  await expect(cards.first()).toBeVisible();

  const nextButton = page.getByTestId('pagination-next-button');

  // Only relevant when there is more than one page of players.
  if (!(await nextButton.isVisible().catch(() => false))) {
    test.skip(true, 'Needs more than 20 listed players on this environment (20 per page).');
  }

  await expect(nextButton).toBeEnabled();

  const firstPageFirstCard = await cards.first().getAttribute('data-testid');
  expect(firstPageFirstCard).toBeTruthy();

  // ---------- Actions ----------

  const page2Response = page.waitForResponse(
    (r) => r.request().method() === 'GET' && r.url().includes('/api/players') && /[?&]page=2\b/.test(r.url()),
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
  // first card really is a different player - it still fails if page 2 never
  // shows different results.
  await expect(cards.first()).not.toHaveAttribute('data-testid', firstPageFirstCard!);

});

test('PUBLIC-008 Player card opens player profile', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/players');

  const firstCard = page.locator('[data-testid^="player-card-"]').first();
  await expect(firstCard).toBeVisible();

  // ---------- Actions ----------

  await firstCard.getByRole('link', { name: /profile/i }).click();

  // ---------- Verify ----------

  await expect(page).toHaveURL(/\/(player|auth)\/?.*/);

});
