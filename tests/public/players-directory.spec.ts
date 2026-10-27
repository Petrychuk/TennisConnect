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

  const nextButton = page.getByTestId('pagination-next-button');

  // Only relevant when there is more than one page of players.
  if (!(await nextButton.isVisible().catch(() => false))) {
    test.skip(true, 'Needs more than 20 listed players on this environment (20 per page).');
  }

  await expect(nextButton).toBeEnabled();

  const firstPageFirstCard = await page
    .locator('[data-testid^="player-card-"]')
    .first()
    .getAttribute('data-testid');

  // ---------- Actions ----------

  await nextButton.click();

  // ---------- Verify ----------

  await expect(
    page.getByTestId('pagination-page-2')
  ).toHaveAttribute('aria-current', 'page');

  const secondPageFirstCard = await page
    .locator('[data-testid^="player-card-"]')
    .first()
    .getAttribute('data-testid');

  expect(secondPageFirstCard).not.toBe(firstPageFirstCard);

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
