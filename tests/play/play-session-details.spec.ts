import { test, expect } from '@playwright/test';
import { dismissCookieBanner, registerPlayer } from '../helpers/auth';
import { becomeOrganiser } from '../helpers/organiser';
import { getSession, inDays, seedHubSession, updateSession } from '../helpers/organiser-hub';

/*
  What players see of an organiser's session (Organiser Hub Phase 2):
  category and format, rules & policies, the organiser's public page. A
  TennisConnect session is viewed on its own page (/play/:id) - Play's cards
  lead there; Event Quick View is only for events on other sites.
  PLAY-001..006 (play.spec.ts) cover listing and registration.

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

    // The organiser's page lists the session and leads back to its own page.
    await page.getByTestId(`session-card-${session.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/play/${session.id}$`));
    await expect(page.getByTestId('play-session-details-title')).toBeVisible({ timeout: 15_000 });
  });

  test('PLAY-008 A TennisConnect session opens its own page from Play, not Quick View', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const title = `Own page cardio ${Date.now()}`;
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

    await expect(page).toHaveURL(new RegExp(`/play/${session.id}$`));
    await expect(page.getByTestId('event-quick-view-modal')).toHaveCount(0);
    await expect(page.getByTestId('play-session-details-title')).toHaveText(title, { timeout: 15_000 });
    await expect(page.getByTestId('play-session-details-format')).toHaveText('Cardio Tennis');
    await expect(page.getByTestId('play-session-details-policies-cancellation')).toContainText('Cancel from My Sessions before noon');
    await expect(page.getByTestId('play-session-details-organiser')).toContainText(organiser.organizationName);
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

  test('PLAY-010 A session with rules needs "I agree" before Join; the player then registers', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const session = await seedHubSession(
      page,
      organiser,
      { title: `Rules first ${Date.now()}`, startAt: inDays(4), status: 'published', type: 'social' },
      { rulesText: 'Arrive 15 minutes early' },
    );

    const context = await page.context().browser()!.newContext();
    const playerPage = await context.newPage();
    try {
      await registerPlayer(playerPage);
      await playerPage.goto(`/play/${session.id}`);
      await dismissCookieBanner(playerPage);

      const join = playerPage.getByTestId('play-session-details-register');
      await expect(join).toBeDisabled({ timeout: 15_000 });
      // The API refuses a join without the agreement too, not only the button.
      const refused = await playerPage.request.post(`/api/organizer/sessions/${session.id}/join`, { data: {}, failOnStatusCode: false });
      expect(refused.status()).toBe(400);

      await playerPage.getByTestId('play-session-details-agree-checkbox').click();
      await expect(join).toBeEnabled();
      await join.click();
      await expect(playerPage.getByTestId('play-session-details-registered-badge')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test('PLAY-011 A guest is asked to sign in or create an account - no Join', async ({ page, browser }) => {
    const organiser = await becomeOrganiser(page);
    const session = await seedHubSession(page, organiser, { title: `Guest view ${Date.now()}`, startAt: inDays(5), status: 'published', type: 'social' });

    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    try {
      await guestPage.goto(`/play/${session.id}`);
      await dismissCookieBanner(guestPage);
      await expect(guestPage.getByTestId('play-session-details-signin-to-register')).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByTestId('play-session-details-register')).toHaveCount(0);
      await guestPage.getByTestId('play-session-details-create-account').click();
      await expect(guestPage).toHaveURL(new RegExp(`/auth\\?tab=register&returnTo=%2Fplay%2F${session.id}`));
    } finally {
      await guest.close();
    }
  });

  test('PLAY-012 Once its start time has come a session is archived for players: off Play, "Archived", nobody can join', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const title = `Started social ${Date.now()}`;
    const session = await seedHubSession(page, organiser, { title, startAt: inDays(-2), status: 'published', type: 'social' });

    await page.goto('/play');
    await dismissCookieBanner(page);
    await page.getByTestId('play-page-search-input').fill(title);
    await expect(page.getByTestId('play-page-no-matches')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`play-session-card-${session.id}`)).toHaveCount(0);

    // A direct link still opens it - as Archived, with nothing to press.
    await page.goto(`/play/${session.id}`);
    await expect(page.getByTestId('play-session-details-status')).toHaveText('Archived', { timeout: 15_000 });
    await expect(page.getByTestId('play-session-details-archived')).toBeDisabled();
    await expect(page.getByTestId('play-session-details-register')).toHaveCount(0);
    await expect(page.getByTestId('play-session-details-signin-to-register')).toHaveCount(0);

    const refused = await page.request.post(`/api/organizer/sessions/${session.id}/join`, { data: { acceptedPolicies: true }, failOnStatusCode: false });
    expect(refused.status()).toBe(400);
  });

  test('PLAY-013 Registration closes early: off Play, "Registration Closed", no join - and still the organiser\'s upcoming session', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const title = `Closed early ${Date.now()}`;
    const session = await seedHubSession(page, organiser, { title, startAt: inDays(3), status: 'published', type: 'social' });
    await updateSession(page, session.id, { registrationOpensAt: inDays(-2), registrationClosesAt: inDays(-0.01) });

    await page.goto('/play');
    await dismissCookieBanner(page);
    await page.getByTestId('play-page-search-input').fill(title);
    await expect(page.getByTestId('play-page-no-matches')).toBeVisible({ timeout: 15_000 });

    await page.goto(`/play/${session.id}`);
    await expect(page.getByTestId('play-session-details-status')).toHaveText('Registration Closed', { timeout: 15_000 });
    await expect(page.getByTestId('play-session-details-closed')).toBeDisabled();
    const refused = await page.request.post(`/api/organizer/sessions/${session.id}/join`, { data: { acceptedPolicies: true }, failOnStatusCode: false });
    expect(refused.status()).toBe(400);

    // Not completed, not archived: the organiser still runs it.
    expect((await getSession(page, session.id)).status).toBe('published');
  });
});
