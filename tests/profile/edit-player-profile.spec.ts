import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/test-users';

test('PROFILE-003 Edit Player Profile', async ({ page }) => {
  // ---------- Login ----------
  await login(
    page,
    TEST_USERS.player.email,
    TEST_USERS.player.password
  );

  // ---------- Verify login ----------
  await expect(page).toHaveURL(/\/player\/.+/);

  await expect(page.getByTestId('profile-menu')).toBeVisible();
  await expect(page.getByTestId('edit-profile')).toBeVisible();

  // ---------- Test data ----------
  const timestamp = Date.now();

  const profile = {
    name: `Player ${timestamp}`,
    country: `Ukraine_${timestamp}`,
    location: `Rockdale_${timestamp}`,
  };

  // ---------- Open edit mode ----------
  await page.getByTestId('edit-profile').click();

  // Edit disappeared
  await expect(page.getByTestId('edit-profile')).toHaveCount(0);

  // Save appeared
  const saveButton = page.getByTestId('save-profile');

  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();

  // ---------- Update fields ----------
  console.log('============== PROFILE ==============');
  console.log('PROFILE:', profile);
  await page.getByTestId('player-name').fill(profile.name);
  await page.getByTestId('player-country').fill(profile.country);
  await page.getByTestId('player-location').fill(profile.location);
  // ---------- Verify entered values ----------
  await expect(page.getByTestId('player-name'))
    .toHaveValue(profile.name);

  await expect(page.getByTestId('player-country'))
    .toHaveValue(profile.country);

  await expect(page.getByTestId('player-location'))
    .toHaveValue(profile.location);

  // ---------- Save ----------
  const [request, response] = await Promise.all([
    page.waitForRequest(req =>
      req.url().includes('/api/me/player-profile') &&
      req.method() === 'PUT'
    ),

    page.waitForResponse(res =>
      res.url().includes('/api/me/player-profile') &&
      res.request().method() === 'PUT'
    ),

    saveButton.click(),
  ]);

  expect(response.ok()).toBeTruthy();
 
  // ---------- Verify request payload ----------
  const body = JSON.parse(request.postData()!);
  console.log('========== REQUEST BODY ==========');
  console.log(body);

  console.log('========== EXPECTED ==========');
  console.log(profile);

  expect(body.name).toBe(profile.name);
  expect(body.country).toBe(profile.country);
  expect(body.location).toBe(profile.location);

  // ---------- Debug ----------
  console.log('PUT payload:', request.postData());
  console.log('Response:', await response.text());

  // ---------- Edit mode closed ----------
  await expect(page.getByTestId('save-profile')).toHaveCount(0);
  await expect(page.getByTestId('edit-profile')).toBeVisible();

  // ---------- Reload ----------
  await page.reload({
    waitUntil: 'networkidle',
  });

  await expect(page.getByTestId('edit-profile')).toBeVisible();

  // ---------- Verify saved values ----------
  await expect(page.getByTestId('player-name-display'))
  .toContainText(profile.name);

  await expect(page.getByTestId('player-country-display'))
    .toContainText(profile.country);

  await expect(page.getByTestId('player-location-display'))
  .toContainText(profile.location);

});