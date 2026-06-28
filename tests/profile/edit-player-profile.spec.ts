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

  await expect(
    page.getByTestId('profile-menu')
  ).toBeVisible();

  await expect(
    page.getByTestId('edit-profile')
  ).toBeVisible();

  // ---------- Test data ----------
  const timestamp = Date.now();

  const profile = {
    name: `Player ${timestamp}`,
    country: 'Australia',
    age: '35',
    bio: `Updated bio ${timestamp}`,
  };

  // ---------- Open edit mode ----------
  await page.getByTestId('edit-profile').click();

  await expect(
    page.getByTestId('save-profile')
  ).toBeVisible();

  // ---------- Fill fields ----------
  await page.getByTestId('player-name').clear();
  await page.getByTestId('player-name').fill(profile.name);

  await page.getByTestId('player-country').clear();
  await page.getByTestId('player-country').fill(profile.country);

  await page.getByTestId('player-age').clear();
  await page.getByTestId('player-age').fill(profile.age);

  await page.getByTestId('player-bio').clear();
  await page.getByTestId('player-bio').fill(profile.bio);

  // ---------- Verify entered values ----------
  await expect(
    page.getByTestId('player-name')
  ).toHaveValue(profile.name);

  await expect(
    page.getByTestId('player-country')
  ).toHaveValue(profile.country);

  await expect(
    page.getByTestId('player-age')
  ).toHaveValue(profile.age);

  await expect(
    page.getByTestId('player-bio')
  ).toHaveValue(profile.bio);

  // ---------- Wait for request & response ----------
  const requestPromise = page.waitForRequest(req =>
    req.url().includes('/api/me/player-profile') &&
    req.method() === 'PUT'
  );

  const responsePromise = page.waitForResponse(res =>
    res.url().includes('/api/me/player-profile') &&
    res.request().method() === 'PUT'
  );

  // ---------- Save ----------
  await page.getByTestId('save-profile').click();

  const request = await requestPromise;
  const response = await responsePromise;

  expect(response.ok()).toBeTruthy();

  console.log('PUT payload:');
  console.log(request.postData());

  console.log('Response:');
  console.log(await response.text());

  // ---------- Wait until edit mode closes ----------
  await expect(
    page.getByTestId('edit-profile')
  ).toBeVisible();

  // ---------- Reload ----------
  await page.reload({
    waitUntil: 'networkidle',
  });

  // ---------- Verify updated profile ----------
  const profileCard = page.getByTestId('player-header');

  await expect(profileCard).toContainText(profile.name);
  await expect(profileCard).toContainText(profile.country);
  await expect(profileCard).toContainText(`${profile.age} years old`);
  await expect(profileCard).toContainText(profile.bio);
});