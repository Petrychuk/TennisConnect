import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../helpers/auth';
import { becomeOrganiser } from '../helpers/organiser';
import { inDays, seedHubSession } from '../helpers/organiser-hub';

/*
  What players see of an organiser's session (Organiser Hub Phase 2):
  category and format, rules & policies, the organiser's public page, and
  Event Quick View. PLAY-001..006 (play.spec.ts) cover listing and
  registration.

  Staging / local only (phase hub-msg-admin). A run-owned organiser and
  seeded sessions; the player views are read-only.
*/

test.describe('Play: session details', () => {
  test('PLAY-007 Session page shows category, format, policies and links to the organiser\'s public page', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const session = await seedHubSession(
      page,
      organiser,
      { title: `Club Champs ${Date.now()}`, startAt: inDays(6), status: 'published', type: 'club-championship' },
      { location: 'Lyne Park', rulesText: 'Best of three tiebreak sets', refundPolicy: 'Refunds until entries close' },
    );

    await page.goto(`/play/${session.id}`);
    await dismissCookieBanner(page);
    await expect(page.getByTestId('play-session-details-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('play-session-details-category')).toHaveText('Competition');
    await expect(page.getByTestId('play-session-details-format')).toHaveText('Club Championship');
    await expect(page.getByTestId('play-session-details-policies-rules')).toContainText('Best of three tiebreak sets');
    await expect(page.getByTestId('play-session-details-policies-refund')).toContainText('Refunds until entries close');
    await expect(page.getByTestId('play-session-details-policies-lateArrival')).toHaveCount(0);

    await page.getByTestId('play-session-details-organizer-page').click();
    await expect(page).toHaveURL(/\/organisations\/[^/]+$/);
    await expect(page.getByTestId('organization-name')).toHaveText(organiser.organizationName, { timeout: 15_000 });
  });

  test('PLAY-008 Event Quick View shows the format, policies and organiser', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const title = `Quick view cardio ${Date.now()}`;
    const session = await seedHubSession(
      page,
      organiser,
      { title, startAt: inDays(3), status: 'published', type: 'cardio-tennis' },
      { cancellationPolicy: 'Cancel from My Sessions before noon' },
    );

    await page.goto('/play');
    await dismissCookieBanner(page);
    await page.getByTestId('play-page-search-input').fill(title);
    const card = page.getByTestId('play-page-results').getByTestId(`play-session-card-${session.id}`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const modal = page.getByTestId('event-quick-view-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('event-modal-title')).toHaveText(title);
    await expect(modal.getByTestId('event-modal-format')).toContainText('Cardio Tennis');
    await expect(modal.getByTestId('event-modal-policies-section')).toContainText('Cancel from My Sessions before noon');
    await expect(modal.getByTestId('event-modal-organiser')).toContainText(organiser.organizationName);
  });

  test('PLAY-009 A draft has no public page', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const draft = await seedHubSession(page, organiser, { title: `Private draft ${Date.now()}`, startAt: inDays(3), status: 'draft' });

    const api = await page.request.get(`/api/play/sessions/${draft.id}`, { failOnStatusCode: false });
    expect(api.status()).toBe(404);
    await page.goto(`/play/${draft.id}`);
    await dismissCookieBanner(page);
    await expect(page.getByTestId('play-session-details-not-found')).toBeVisible({ timeout: 15_000 });
  });
});
