import { test, expect } from '@playwright/test';
import { signInAsNewPlayer } from '../helpers/accounts';
import { skipUnlessUploadsAllowed } from '../helpers/staging-gates';
import path from 'path';

test('PROFILE-005 Upload Player Cover', async ({ page }) => {
  // ---------- Login ----------
  skipUnlessUploadsAllowed();
  // Own run-owned account: the shared Stage 2 player must never be modified.
  await signInAsNewPlayer(page);

  // ---------- Verify login ----------
  await expect(page).toHaveURL(/\/player\/.+/);

  // ---------- Cover ----------
  const cover = page.getByTestId('profile-cover');

  await expect(cover).toBeVisible();

  const oldSrc = await cover.getAttribute('src');

  // ---------- Hover ----------
  await page
    .getByTestId('edit-cover-profile')
    .hover();

  // ---------- Upload ----------
  const filePath = path.resolve(
    'tests/fixtures/images/cover_test.jpg'
  );

  const [response] = await Promise.all([
    page.waitForResponse(res =>
      res.url().includes('/uploadMedia/cover') &&
      res.request().method() === 'POST'
    ),

    page
      .getByTestId('cover-upload')
      .setInputFiles(filePath),
  ]);

  expect(response.ok()).toBeTruthy();

  const data = await response.json();

  expect(data.type).toBe('cover');
  expect(data.url).toContain('cover.webp');

  // ---------- Reload ----------
  await page.reload({
    waitUntil: 'networkidle',
  });

  // ---------- Verify Cover ----------
  const newCover = page.getByTestId('profile-cover');

  await expect(newCover).toBeVisible();

  const newSrc = await newCover.getAttribute('src');

  expect(newSrc).not.toBe(oldSrc);

  await expect(newCover).toHaveAttribute(
    'src',
    /cover\.webp/
  );
});

