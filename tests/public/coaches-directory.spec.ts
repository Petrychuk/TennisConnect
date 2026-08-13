import { test, expect } from '@playwright/test';

test('PUBLIC-001 Coaches directory lists coaches', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/coaches');

  // ---------- Verify ----------

  const firstCard = page.locator('[data-testid^="coach-card-"]').first();

  await expect(firstCard).toBeVisible();

});

test('PUBLIC-002 Coaches directory search filters results', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/coaches');

  const searchInput = page.getByTestId('coaches-search-input');
  await expect(searchInput).toBeVisible();

  const initialCount = await page
    .locator('[data-testid^="coach-card-"]')
    .count();

  // ---------- Actions ----------

  await searchInput.fill('zzz-no-such-coach-zzz');

  // ---------- Verify ----------

  await expect(
    page.locator('[data-testid^="coach-card-"]')
  ).toHaveCount(0);

  await searchInput.fill('');

  await expect(
    page.locator('[data-testid^="coach-card-"]')
  ).toHaveCount(initialCount);

});

test('PUBLIC-003 Coaches directory pagination navigates to next page', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/coaches');

  const nextButton = page.getByTestId('pagination-next-button');

  // Only relevant when there is more than one page of coaches.
  if (!(await nextButton.isVisible().catch(() => false))) {
    test.skip();
  }

  await expect(nextButton).toBeEnabled();

  const firstPageFirstCard = await page
    .locator('[data-testid^="coach-card-"]')
    .first()
    .getAttribute('data-testid');

  // ---------- Actions ----------

  await nextButton.click();

  // ---------- Verify ----------

  await expect(
    page.getByTestId('pagination-page-2')
  ).toHaveAttribute('aria-current', 'page');

  const secondPageFirstCard = await page
    .locator('[data-testid^="coach-card-"]')
    .first()
    .getAttribute('data-testid');

  expect(secondPageFirstCard).not.toBe(firstPageFirstCard);

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
