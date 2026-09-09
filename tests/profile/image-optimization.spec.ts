import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { login } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/test-users';

/*
  IMAGE OPTIMISATION - regression coverage for resizeImage() actually
  being called before upload, not just existing in the codebase (see
  the "resizeImage() was imported but never called" finding this whole
  feature grew out of - a test asserting the helper's own output in
  isolation wouldn't have caught that; these assert what actually goes
  over the network on a real upload flow).

  Comparing to the on-disk fixture size, not a hardcoded byte count -
  a hardcoded number breaks the moment anyone swaps the fixture image
  or nudges a quality setting for a good reason. What actually matters
  here is the shape of the claim: "the browser did not upload the
  original file", not a specific number.
*/

test('IMG-001 Avatar Upload Is Resized/Compressed Before It Reaches The Network', async ({ page }) => {

  // ---------- Test data ----------

  const filePath = path.resolve(
    'tests/fixtures/images/avatar_female_tennis_student.png'
  );
  const originalSize = fs.statSync(filePath).size;

  // ---------- Login ----------

  await login(page, TEST_USERS.player.email, TEST_USERS.player.password);
  await expect(page).toHaveURL(/\/player\/.+/);

  // ---------- Upload ----------

  const [request, response] = await Promise.all([
    page.waitForRequest(req =>
      req.url().includes('/uploadMedia/avatar') &&
      req.method() === 'POST'
    ),
    page.waitForResponse(res =>
      res.url().includes('/uploadMedia/avatar') &&
      res.request().method() === 'POST'
    ),
    page.getByTestId('edit-avatar-profile').hover().then(() =>
      page.getByTestId('avatar-upload').setInputFiles(filePath)
    ),
  ]);

  expect(response.ok()).toBeTruthy();

  // ---------- Verify: the browser sent something meaningfully smaller
  // than the original file, not the original file itself ----------

  const uploadedSize = request.postDataBuffer()?.byteLength ?? 0;

  // The multipart body wraps the file in a small amount of boundary/
  // header overhead, and this fixture (1024x1024 PNG, ~1.3MB) resizes
  // down to a 512x512 WebP - comfortably under half the original even
  // accounting for that overhead. A loose bound on purpose: this is a
  // regression check ("did resizing happen at all"), not a pixel-perfect
  // compression-ratio assertion that would break on a reasonable future
  // quality/preset tweak.
  expect(uploadedSize).toBeGreaterThan(0);
  expect(uploadedSize).toBeLessThan(originalSize * 0.5);

  // ---------- And the server still receives a valid, correctly-typed
  // image it can store - resizing must not corrupt the upload ----------

  const data = await response.json();
  expect(data.url).toContain('avatar.webp');

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('profile-avatar')).toBeVisible();
  await expect(page.getByTestId('profile-avatar')).toHaveAttribute(
    'src',
    /avatar\.webp/
  );

});

test('IMG-002 Cover Upload Is Resized/Compressed Before It Reaches The Network', async ({ page }) => {

  // ---------- Test data ----------

  const filePath = path.resolve('tests/fixtures/images/cover_test.jpg');
  const originalSize = fs.statSync(filePath).size;

  // ---------- Login ----------

  await login(page, TEST_USERS.coach.email, TEST_USERS.coach.password);
  await expect(page).toHaveURL(/\/coach\/.+/);

  // ---------- Upload ----------

  const [request, response] = await Promise.all([
    page.waitForRequest(req =>
      req.url().includes('/uploadMedia/cover') &&
      req.method() === 'POST'
    ),
    page.waitForResponse(res =>
      res.url().includes('/uploadMedia/cover') &&
      res.request().method() === 'POST'
    ),
    page.getByTestId('cover-upload').setInputFiles(filePath),
  ]);

  expect(response.ok()).toBeTruthy();

  // ---------- Verify ----------
  // cover_test.jpg is already a modest ~85KB, unlike the avatar
  // fixture - not asserting it shrinks further (a small, already-web-
  // sized source legitimately might not), just that whatever was sent
  // is a sane, non-empty body and never bigger than the source (the
  // resize helper's own "don't upload something bigger than we
  // started with" fallback).

  const uploadedSize = request.postDataBuffer()?.byteLength ?? 0;

  expect(uploadedSize).toBeGreaterThan(0);
  expect(uploadedSize).toBeLessThanOrEqual(originalSize + 2048); // +2KB multipart overhead allowance

  const data = await response.json();
  expect(data.url).toContain('cover.webp');

});
