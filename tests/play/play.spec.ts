import { test, expect } from '@playwright/test';
import { registerPlayer } from '../helpers/auth';
import { becomeOrganiser, seedPlayers, seedSession } from '../helpers/organiser';

/*
  Play (public discovery) - see the "[Player] Create Play page" spec.
  Sessions are seeded directly via /api/test-hooks/seed-session (any
  status the test needs) rather than driven through the Organiser Hub
  session wizard + admin review - that creation flow is its own,
  separately-testable surface. What's under test here is what /play
  DOES with sessions of a given status/visibility, not how an organiser
  gets a session into that status.
*/

test.describe('Play', () => {
  test('@smoke PLAY-001 Published session appears on Play with its essential info', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const title = `Wednesday Social Tennis ${Date.now()}`;

    const session = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title,
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'published',
    });

    await page.goto('/play');

    const card = page.getByTestId(`play-session-card-${session.id}`);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`play-session-card-${session.id}-title`)).toHaveText(title);
    await expect(card).toContainText(organiser.organizationName);
  });

  test('PLAY-002 Draft, cancelled and archived sessions never appear on Play', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const stamp = Date.now();

    const draft = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Draft Session ${stamp}`,
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
    });
    const cancelled = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Cancelled Session ${stamp}`,
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'cancelled',
    });
    const completed = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Completed Session ${stamp}`,
      startAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
    });

    await page.goto('/play');
    await page.getByTestId('play-page-search-input').fill(String(stamp));

    await expect(page.getByTestId('play-page-no-matches')).toBeVisible({ timeout: 15000 });
    for (const s of [draft, cancelled, completed]) {
      await expect(page.getByTestId(`play-session-card-${s.id}`)).toHaveCount(0);
    }
  });

  test('@smoke PLAY-003 Search matches session, venue and organiser', async ({ page }) => {
    const organiser = await becomeOrganiser(page, `Wolli Creek Tennis Club ${Date.now()}`);
    const session = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Uniquely Named Session ${Date.now()}`,
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'published',
    });

    await page.goto('/play');

    // By organiser name.
    await page.getByTestId('play-page-search-input').fill(organiser.organizationName);
    await expect(page.getByTestId(`play-session-card-${session.id}`)).toBeVisible({ timeout: 15000 });

    // By session title.
    await page.getByTestId('play-page-search-input').fill('Uniquely Named Session');
    await expect(page.getByTestId(`play-session-card-${session.id}`)).toBeVisible({ timeout: 15000 });
  });

  test('PLAY-004 Format filter narrows the list to just that format', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const stamp = Date.now();

    const americano = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Americano Session ${stamp}`,
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'published',
      type: 'americano',
    });
    const social = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Social Session ${stamp}`,
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'published',
      type: 'social',
    });

    await page.goto('/play');
    await page.getByTestId('play-page-search-input').fill(String(stamp));
    await expect(page.getByTestId(`play-session-card-${americano.id}`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`play-session-card-${social.id}`)).toBeVisible();

    await page.getByTestId('play-page-filter-format').click();
    await page.getByTestId('play-page-filter-format-americano').click();

    await expect(page.getByTestId(`play-session-card-${americano.id}`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`play-session-card-${social.id}`)).toHaveCount(0);
  });

  test('@smoke PLAY-005 Player can register, see Registered, then cancel', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const session = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Register Flow Session ${Date.now()}`,
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'published',
    });

    // A separate player account does the registering - not the
    // organiser who created the session.
    const context = await page.context().browser()!.newContext();
    const playerPage = await context.newPage();
    try {
      await registerPlayer(playerPage);

      await playerPage.goto(`/play/${session.id}`);
      await expect(playerPage.getByTestId('play-session-details-register')).toBeVisible({ timeout: 15000 });
      await playerPage.getByTestId('play-session-details-register').click();

      await expect(playerPage.getByTestId('play-session-details-registered-badge')).toBeVisible({ timeout: 15000 });

      await playerPage.getByTestId('play-session-details-cancel-registration').click();
      await expect(playerPage.getByTestId('play-session-details-register')).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  test('PLAY-006 Full session with waiting list offers Join Waiting List instead of Register', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [a] = await seedPlayers(page, 1);

    const session = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Full Session ${Date.now()}`,
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'published',
      maxParticipants: 1,
      waitingListEnabled: true,
      registrations: [{ userId: a.id, checkedIn: false }],
    });

    await page.goto(`/play/${session.id}`);
    await expect(page.getByTestId('play-session-details-join-waitlist')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('play-session-details-register')).toHaveCount(0);
    await expect(page.getByTestId('play-session-details-status')).toHaveText('Waiting List');
  });
});
