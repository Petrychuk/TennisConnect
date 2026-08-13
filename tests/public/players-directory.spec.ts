import { test, expect } from '@playwright/test';

test('PUBLIC-005 Players directory lists players', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/partners');

  // ---------- Verify ----------

  const firstCard = page.locator('[data-testid^="player-card-"]').first();

  await expect(firstCard).toBeVisible();

});

test('PUBLIC-006 Players directory search filters results', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/partners');

  const searchInput = page.getByTestId('players-search-input');
  await expect(searchInput).toBeVisible();

  const initialCount = await page
    .locator('[data-testid^="player-card-"]')
    .count();

  // ---------- Actions ----------

  await searchInput.fill('zzz-no-such-player-zzz');

  // ---------- Verify ----------

  await expect(
    page.locator('[data-testid^="player-card-"]')
  ).toHaveCount(0);

  await searchInput.fill('');

  await expect(
    page.locator('[data-testid^="player-card-"]')
  ).toHaveCount(initialCount);

});

test('PUBLIC-007 Players directory pagination navigates to next page', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/partners');

  const nextButton = page.getByTestId('pagination-next-button');

  // Only relevant when there is more than one page of players.
  if (!(await nextButton.isVisible().catch(() => false))) {
    test.skip();
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

  await page.goto('/partners');

  const firstCard = page.locator('[data-testid^="player-card-"]').first();
  await expect(firstCard).toBeVisible();

  // ---------- Actions ----------

  await firstCard.getByRole('link', { name: /profile/i }).click();

  // ---------- Verify ----------

  await expect(page).toHaveURL(/\/(player|auth)\/?.*/);

});
