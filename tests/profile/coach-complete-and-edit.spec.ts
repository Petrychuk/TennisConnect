import { test, expect } from '@playwright/test';
import { registerCoach, login } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/test-users';

test('PROFILE-009 Complete Coach Profile - success with Country/Certified/Training Locations', async ({ page }) => {
  await registerCoach(page);

  await expect(page).toHaveURL(/complete-profile/);

  // ---------- Fill everything, including the fields onboarding didn't
  // used to collect at all (Country, Certified, Where I Coach) ----------
  await page.getByTestId('input-title').fill('Playwright Certified Coach');

  await page.getByTestId('switch-certified').click();
  await page.getByTestId('input-certification-details').fill('Tennis Australia Level 1');

  // Country is a searchable combobox (see complete-profile.tsx) - pick
  // something other than the "Australia" default to actually prove the
  // selection round-trips, not just that the default was left alone.
  await page.getByTestId('select-coach-country').click();
  await page.getByPlaceholder('Search country...').fill('Canada');
  await page.getByText('Canada', { exact: true }).click();

  await page.getByTestId('input-location').fill('Sydney, NSW');
  await page.getByTestId('input-training-locations').fill('Bondi Beach, Manly');

  await page.getByTestId('input-experience').fill('10+');
  await page.getByTestId('input-rate').fill('$80');

  await page.getByTestId('textarea-bio')
    .fill('Experienced tennis coach created by Playwright automation.');

  // ---------- Submit ----------
  const [request, response] = await Promise.all([
    page.waitForRequest(req =>
      req.url().includes('/api/me/coach-profile') && req.method() === 'PUT'
    ),
    page.waitForResponse(res =>
      res.url().includes('/api/me/coach-profile') && res.request().method() === 'PUT'
    ),
    page.getByTestId('button-save').click(),
  ]);

  expect(response.ok()).toBeTruthy();

  const body = JSON.parse(request.postData()!);
  expect(body.country).toBe('Canada');
  expect(body.isCertified).toBe(true);
  expect(body.certificationDetails).toBe('Tennis Australia Level 1');
  expect(body.locations).toEqual(['Bondi Beach', 'Manly']);

  // ---------- Redirected to the real profile, values visible there ----------
  await expect(page).toHaveURL(/\/coach\/.+/);

  await expect(page.getByTestId('coach-certified-badge')).toBeVisible();
  await expect(page.getByTestId('coach-certified-badge')).toContainText('Certified Coach');
  await expect(page.getByTestId('coach-country-display')).toContainText('Canada');
});

test('PROFILE-010 Complete Coach Profile - certification details field only shows once Certified is toggled on', async ({ page }) => {
  await registerCoach(page);

  await expect(page).toHaveURL(/complete-profile/);

  // Off by default - the details input isn't in the DOM at all yet.
  await expect(page.getByTestId('input-certification-details')).toHaveCount(0);

  await page.getByTestId('switch-certified').click();
  await expect(page.getByTestId('input-certification-details')).toBeVisible();

  await page.getByTestId('input-certification-details').fill('ATPCA Graduate Pro');
  await expect(page.getByTestId('input-certification-details')).toHaveValue('ATPCA Graduate Pro');

  // Toggling back off removes it again rather than just hiding it with
  // stale text still sitting in form state.
  await page.getByTestId('switch-certified').click();
  await expect(page.getByTestId('input-certification-details')).toHaveCount(0);
});

test('PROFILE-011 Complete Coach Profile - Save Profile is dimmed until the form is actually valid', async ({ page }) => {
  await registerCoach(page);

  await expect(page).toHaveURL(/complete-profile/);

  const saveButton = page.getByTestId('button-save');

  // Title/Location/Bio all start empty - dimmed, but never disabled
  // (still clickable at every point, per the "highlight, don't block"
  // requirement this was built to).
  await expect(saveButton).toHaveClass(/opacity-50/);
  await expect(saveButton).toBeEnabled();

  await page.getByTestId('input-title').fill('Playwright Tennis Coach');
  await page.getByTestId('input-location').fill('Sydney, NSW');
  await page.getByTestId('textarea-bio')
    .fill('Experienced tennis coach created by Playwright automation.');

  // Country already defaults to "Australia", so once the 3 fields above
  // are valid the whole form should be too.
  await expect(saveButton).not.toHaveClass(/opacity-50/);
  await expect(saveButton).toBeEnabled();
});

test('PROFILE-012 Edit Coach Profile - update Country and Certified after onboarding', async ({ page }) => {
  await login(page, TEST_USERS.coach.email, TEST_USERS.coach.password);

  await expect(page).toHaveURL(/\/coach\/.+/);

  const timestamp = Date.now();
  const certDetails = `Playwright Cert ${timestamp}`;

  await page.getByTestId('edit-coach').click();

  const saveButton = page.getByTestId('save-coach');
  await expect(saveButton).toBeVisible();

  // CoachInfo.tsx's edit-mode Country is a plain input (unlike
  // complete-profile.tsx's searchable combobox - this header has much
  // less room for it), and the certified toggle is a real checkbox.
  await page.getByTestId('coach-country').fill('New Zealand');

  const certifiedCheckbox = page.getByTestId('coach-is-certified');
  if (!(await certifiedCheckbox.isChecked())) {
    await certifiedCheckbox.check();
  }
  await page.getByTestId('coach-certification-details').fill(certDetails);

  const [request, response] = await Promise.all([
    page.waitForRequest(req =>
      req.url().includes('/api/me/coach-profile') && req.method() === 'PUT'
    ),
    page.waitForResponse(res =>
      res.url().includes('/api/me/coach-profile') && res.request().method() === 'PUT'
    ),
    saveButton.click(),
  ]);

  expect(response.ok()).toBeTruthy();

  const body = JSON.parse(request.postData()!);
  expect(body.country).toBe('New Zealand');
  expect(body.isCertified).toBe(true);
  expect(body.certificationDetails).toBe(certDetails);

  await page.reload({ waitUntil: 'networkidle' });

  await expect(page.getByTestId('coach-country-display')).toContainText('New Zealand');
  await expect(page.getByTestId('coach-certified-badge')).toBeVisible();
});

test('PROFILE-013 Coach Profile - Certified badge does not show without opting in', async ({ page }) => {
  await registerCoach(page);

  await expect(page).toHaveURL(/complete-profile/);

  // Deliberately leave the Certified toggle off - only fill what's
  // actually required.
  await page.getByTestId('input-title').fill('Playwright Uncertified Coach');
  await page.getByTestId('input-location').fill('Sydney, NSW');
  await page.getByTestId('textarea-bio')
    .fill('Coach profile created by Playwright automation, not certified.');

  await Promise.all([
    page.waitForResponse(res =>
      res.url().includes('/api/me/coach-profile') && res.request().method() === 'PUT'
    ),
    page.getByTestId('button-save').click(),
  ]);

  await expect(page).toHaveURL(/\/coach\/.+/);

  // The badge used to render unconditionally for every coach regardless
  // of any real data - this is the regression this test guards against.
  await expect(page.getByTestId('coach-certified-badge')).toHaveCount(0);
  await expect(page.getByText('Certified Coach')).toHaveCount(0);
});
