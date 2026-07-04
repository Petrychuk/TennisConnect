import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/test-users';

test('PROFILE-004 Edit Coach Profile', async ({ page }) => {
  // ---------- Login ----------
  await login(
    page,
    TEST_USERS.coach.email,
    TEST_USERS.coach.password
  );

  // ---------- Verify login ----------
  await expect(page).toHaveURL(/\/coach\/.+/);

  await expect(page.getByTestId('profile-menu')).toBeVisible();
  await expect(page.getByTestId('edit-coach')).toBeVisible();

  // ---------- Test data ----------
  const timestamp = Date.now();

  const profile = {
    name: `Coach ${timestamp}`,
    title: `The best price from best coach in Sydney-${timestamp}`,
    location: `Wolli Creek_${timestamp}`,
  };

  // ---------- Open edit mode ----------
  await page.getByTestId('edit-coach').click();

  // Edit disappeared
  await expect(page.getByTestId('edit-coach')).toHaveCount(0);

  // Save appeared
  const saveButton = page.getByTestId('save-coach');

  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();

  // ---------- Update fields ----------
  await page.getByTestId('coach-name').fill(profile.name);
  await page.getByTestId('coach-title').fill(profile.title);
  await page.getByTestId('coach-location').fill(profile.location);
  // ---------- Verify entered values ----------
  await expect(page.getByTestId('coach-name'))
    .toHaveValue(profile.name);

  await expect(page.getByTestId('coach-title'))
    .toHaveValue(profile.title);

  await expect(page.getByTestId('coach-location'))
    .toHaveValue(profile.location);

    // ---------- Save ----------
    const [request, response] = await Promise.all([
        page.waitForRequest(req =>
        req.url().includes('/api/me/coach-profile') &&
        req.method() === 'PUT'
        ),
    
        page.waitForResponse(res =>
        res.url().includes('/api/me/coach-profile') &&
        res.request().method() === 'PUT'
        ),
    
        saveButton.click(),
    ]);

  expect(response.ok()).toBeTruthy();
 
  // ---------- Verify request payload ----------
  const body = JSON.parse(request.postData()!);

  expect(body.name).toBe(profile.name);
  expect(body.title).toBe(profile.title);
  expect(body.location).toBe(profile.location);

  // ---------- Debug ----------
  console.log('PUT payload:', request.postData());
  console.log('Response:', await response.text());

  // ---------- Edit mode closed ----------
  await expect(page.getByTestId('save-coach')).toHaveCount(0);
  await expect(page.getByTestId('edit-coach')).toBeVisible();

  // ---------- Reload ----------
  await page.reload({
    waitUntil: 'networkidle',
  });

  await expect(page.getByTestId('edit-coach')).toBeVisible();

  // ---------- Verify saved values ----------
  await expect(page.getByTestId('coach-name-display'))
  .toContainText(profile.name);

  await expect(page.getByTestId('coach-title-display'))
    .toContainText(profile.title);

  await expect(page.getByTestId('coach-location-display'))
  .toContainText(profile.location);

});