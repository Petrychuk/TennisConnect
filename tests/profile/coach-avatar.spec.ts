import { test, expect } from '@playwright/test';
import path from 'path';
import { login } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/test-users';

test('PROFILE-008 Upload Coach Avatar', async ({ page }) => {
  // ---------- Login ----------
  await login(
    page,
    TEST_USERS.coach.email,
    TEST_USERS.coach.password
  );

  // ---------- Verify login ----------
  await expect(page).toHaveURL(/\/coach\/.+/);

  // ---------- Avatar ----------
  const avatar = page.getByTestId('profile-avatar');

  await expect(avatar).toBeVisible();

  const oldSrc = await avatar.getAttribute('src');

  // ---------- Hover ----------
  await page
    .getByTestId('edit-avatar-profile')
    .hover();

  // ---------- Upload ----------
  const filePath = path.resolve(
    'tests/fixtures/images/avatar_female_tennis_student.png'
  );

  const [response] = await Promise.all([
    page.waitForResponse(res =>
      res.url().includes('/uploadMedia/avatar') &&
      res.request().method() === 'POST'
    ),

    page
      .getByTestId('avatar-upload')
      .setInputFiles(filePath),
  ]);

  expect(response.ok()).toBeTruthy();

  const data = await response.json();

  expect(data.type).toBe('avatar');
  expect(data.url).toContain('avatar.webp');
  expect(data.user.avatar).toContain('avatar.webp');

  // ---------- Reload ----------
  await page.reload({
    waitUntil: 'networkidle',
  });

  // ---------- Verify Avatar ----------
  const newAvatar = page.getByTestId('profile-avatar');

  await expect(newAvatar).toBeVisible();

  const newSrc = await newAvatar.getAttribute('src');

  expect(newSrc).not.toBe(oldSrc);

  await expect(newAvatar).toHaveAttribute(
    'src',
    /avatar\.webp/
  );
});