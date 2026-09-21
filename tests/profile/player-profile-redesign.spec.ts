import { test, expect } from '@playwright/test';
import { registerPlayer } from '../helpers/auth';
import { completePlayerProfile } from '../helpers/profile';

test.describe('Player profile redesign', () => {
  test('@smoke PROFILE-RD-001 Owner can edit About Me, Looking For and Playing Preferences, and it persists on reload', async ({ page }) => {
    await registerPlayer(page);
    await completePlayerProfile(page);

    const meRes = await page.request.get('/api/auth/me');
    const me = await meRes.json();
    await page.goto(`/player/${me.slug}`);

    // About Me
    await page.getByTestId('edit-about-me').click();
    await page.getByTestId('input-about-me').fill('I love social doubles on weekends.');
    await page.getByTestId('save-about-me').click();
    await expect(page.getByTestId('about-me-card')).toContainText('I love social doubles on weekends.');

    // Looking For
    await page.getByTestId('edit-looking-for').click();
    await page.getByTestId('looking-for-option-hitting-partner').click();
    await page.getByTestId('save-looking-for').click();
    await expect(page.getByTestId('looking-for-card')).toContainText('Hitting Partner');

    // Playing Preferences - including the relocated real skillLevel/
    // preferredCourts fields (previously a separate Overview card).
    await page.getByTestId('edit-playing-preferences').click();
    await page.getByTestId('input-preferred-areas').fill('Bondi Beach, Manly');
    await page.getByTestId('save-playing-preferences').click();
    await expect(page.getByTestId('playing-preferences-card')).toContainText('Bondi Beach');

    // Reload - everything above must be real, persisted data, not
    // component-local state that resets on refresh.
    await page.reload();
    await expect(page.getByTestId('about-me-card')).toContainText('I love social doubles on weekends.');
    await expect(page.getByTestId('looking-for-card')).toContainText('Hitting Partner');
    await expect(page.getByTestId('playing-preferences-card')).toContainText('Bondi Beach');
  });

  test('@smoke PROFILE-RD-002 Owner can upload a real photo to their gallery', async ({ page }) => {
    await registerPlayer(page);
    await completePlayerProfile(page);

    const meRes = await page.request.get('/api/auth/me');
    const me = await meRes.json();
    await page.goto(`/player/${me.slug}`);

    // A tiny valid PNG (1x1) - real bytes, not just a declared mimetype,
    // matching this app's own magic-byte upload validation.
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );

    const uploadPromise = page.waitForResponse(
      (res) => res.url().includes('/api/me/player-profile/photos') && res.request().method() === 'POST'
    );
    await page.getByTestId('add-photo-button').setInputFiles({
      name: 'court.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });
    const uploadRes = await uploadPromise;
    expect(uploadRes.ok()).toBeTruthy();

    await expect(page.getByTestId('photo-thumb-0')).toBeVisible();
  });

  test('PROFILE-RD-003 A visitor cannot see Edit controls, sees Good Match + Bottom CTA, and never sees the Results tab', async ({ page, browser }) => {
    await registerPlayer(page);
    await completePlayerProfile(page);
    const meRes = await page.request.get('/api/auth/me');
    const me = await meRes.json();

    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    try {
      await registerPlayer(visitorPage);
      await completePlayerProfile(visitorPage);

      await visitorPage.goto(`/player/${me.slug}`);

      await expect(visitorPage.getByTestId('edit-about-me')).toHaveCount(0);
      await expect(visitorPage.getByTestId('edit-looking-for')).toHaveCount(0);
      await expect(visitorPage.getByTestId('edit-playing-preferences')).toHaveCount(0);

      await expect(visitorPage.getByTestId('good-match-card')).toBeVisible();
      await expect(visitorPage.getByTestId('player-bottom-cta')).toBeVisible();

      // Results is owner-only now - a visitor should never see the tab
      // trigger at all, regardless of whether the owner has results.
      await expect(visitorPage.getByTestId('my-results-tab')).toHaveCount(0);
    } finally {
      await visitorContext.close();
    }
  });

  test('PROFILE-RD-004 The owner sees the Results tab and never sees Good Match or the Bottom CTA on their own profile', async ({ page }) => {
    await registerPlayer(page);
    await completePlayerProfile(page);
    const meRes = await page.request.get('/api/auth/me');
    const me = await meRes.json();

    await page.goto(`/player/${me.slug}`);

    await expect(page.getByTestId('my-results-tab')).toBeVisible();
    await expect(page.getByTestId('good-match-card')).toHaveCount(0);
    await expect(page.getByTestId('player-bottom-cta')).toHaveCount(0);
  });
});
