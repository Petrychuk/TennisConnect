import { test, expect, type Browser, type Page } from '@playwright/test';
import { login, registerPlayer } from '../helpers/auth';
import { completePlayerProfile } from '../helpers/profile';
import { becomeOrganiser } from '../helpers/organiser';
import { TEST_USERS } from '../fixtures/test-users';

/*
  ORG-ONB-001..012 - Organiser Hub onboarding for people who are not organisers
  yet (P1 ticket): email verification lands on the person's own profile, and a
  signed-in player or coach who opens the Hub gets the "Ready to organise tennis
  with TennisConnect?" modal instead of an error page. Nothing here changes who
  is allowed to organise: the server decides, and every test that matters checks
  the API as well as the screen.

  Safety (docs/CLAUDE_PLAYWRIGHT_RULES.md): Staging / local only, never
  Production (not in the @prod-safe allowlist). Every account is run-owned
  (registerPlayer / becomeOrganiser; erased by the run-scoped teardown). The
  only writes are: registering run-owned players, their own organiser request,
  and - ORG-ONB-011 - the admin rejecting that run-owned request. The baseline
  admin and organiser accounts are only signed into, never changed.
  Phase: hub-msg-admin (ORG-ONB-008 is guest-only: auth-readonly).
*/

const COPY = {
  heading: 'Ready to organise tennis with TennisConnect?',
  body: 'Organiser Hub is an additional feature for people who want to create and manage tennis sessions, events and competitions.',
  benefits: ['Create and manage tennis sessions', 'Manage registrations and players', 'Track scores and results'],
  request: 'Request Organiser Access',
  back: 'Back to My Profile',
  note: "Organiser access is subject to approval. You can request access whenever you're ready.",
  pending: 'Your organiser request is under review',
  submitted: "Your request has been submitted. We'll review your request and let you know when there's an update.",
  rejected: 'Your last request was not approved.',
};

const modal = (page: Page) => page.getByTestId('organiser-onboarding-modal');

/** Registers a run-owned player (verified, signed in) and opens the Hub directly. */
async function openHubAsNewPlayer(page: Page) {
  const user = await registerPlayer(page);
  await page.goto('/organiser');
  await expect(modal(page)).toBeVisible({ timeout: 15000 });
  return user;
}

/** The page is at exactly this path (query and hash ignored). */
async function expectPath(page: Page, path: string, label = 'path') {
  await expect.poll(() => new URL(page.url()).pathname, { message: label, timeout: 15000 }).toBe(path);
}

async function myProfilePath(page: Page): Promise<string> {
  const me = await (await page.request.get('/api/auth/me')).json();
  return `/${me.role}/${me.slug}`;
}

/** The organiser-only API answers 403 for this signed-in, unapproved person. */
async function expectOrganiserApiRefused(page: Page, label: string) {
  const calls: [string, string, unknown?][] = [
    ['GET', '/api/organizer/seasons'],
    ['GET', '/api/organizer/reports'],
    ['POST', '/api/organizer/organizations', {}],
    ['POST', '/api/organizer/session-templates', {}],
  ];
  for (const [method, path, data] of calls) {
    const res = await page.request.fetch(path, { method, data, failOnStatusCode: false });
    expect(res.status(), `${label}: ${method} ${path}`).toBe(403);
  }
}

async function adminRejects(browser: Browser, requestId: string) {
  const context = await browser.newContext();
  const adminPage = await context.newPage();
  try {
    await login(adminPage, TEST_USERS.admin.email, TEST_USERS.admin.password);
    const res = await adminPage.request.post(`/api/organizer/requests/${requestId}/reject`, { data: {}, failOnStatusCode: false });
    expect(res.status(), 'admin rejects the request').toBe(200);
  } finally {
    await context.close();
  }
}

async function clickRequestAndWait(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/organizer/requests') && r.request().method() === 'POST'),
    page.getByTestId('organiser-onboarding-request').click(),
  ]);
  return response;
}

test.describe('Organiser onboarding', () => {
  test('ORG-ONB-001 A verified new player lands on their own profile, not the Organiser Hub', async ({ page }) => {
    test.slow();
    // registerPlayer(): register -> "check your email" -> the real /verify-email link
    // (token from the test hook) -> a session is created -> /complete-profile.
    await registerPlayer(page);
    expect(new URL(page.url()).pathname, 'verification must not default to /organiser').not.toMatch(/^\/organiser/);

    await completePlayerProfile(page);

    // Their own route, built from their account, as the server knows it.
    const expected = await myProfilePath(page);
    expect(expected).toMatch(/^\/player\/.+/);
    await expectPath(page, expected, 'own profile after completing it');
    await expect(page.getByTestId('profile-menu')).toBeVisible({ timeout: 15000 });
    await expect(modal(page)).toHaveCount(0);
  });

  test('ORG-ONB-002 A player who clicks Organiser Hub sees the friendly modal, with no Hub content behind it', async ({ page }) => {
    test.slow();
    await registerPlayer(page);
    await completePlayerProfile(page);
    const profile = await myProfilePath(page);

    // The way a player really gets there: profile menu -> Organiser Hub.
    await page.getByTestId('profile-menu').click();
    await page.getByTestId('navbar-organiser-hub-link').click();
    await expect(page).toHaveURL(/\/organiser$/);

    const dialog = modal(page);
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByRole('heading', { name: COPY.heading })).toBeVisible();
    await expect(dialog.getByText(COPY.body, { exact: true })).toBeVisible();
    for (const benefit of COPY.benefits) await expect(dialog.getByText(benefit, { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: COPY.request })).toBeVisible();
    await expect(dialog.getByRole('button', { name: COPY.back })).toBeVisible();
    await expect(dialog.getByText(COPY.note, { exact: true })).toBeVisible();
    await expect(page.getByText('Your TennisConnect player account is ready')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Organiser access required' })).toHaveCount(0);

    // Nothing from the Hub is rendered behind it.
    await expect(page.getByTestId('organiser-dashboard')).toHaveCount(0);
    await expect(page.getByTestId('organiser-sidebar-nav-home')).toHaveCount(0);

    // Accessible dialog: named by its heading, focus inside it, Tab stays inside.
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="organiser-onboarding-modal"]')), `Tab ${i + 1} stays in the dialog`).toBe(true);
    }

    // Escape, the X and "Back to My Profile" all return to their own profile.
    await page.keyboard.press('Escape');
    await expectPath(page, profile, 'own profile');
    await expect(dialog).toHaveCount(0);

    await page.goto('/organiser');
    await page.getByTestId('organiser-onboarding-close').click();
    await expectPath(page, profile, 'own profile');

    await page.goto('/organiser');
    await page.getByTestId('organiser-onboarding-back').click();
    await expectPath(page, profile, 'own profile');
  });

  test('ORG-ONB-003 Request Organiser Access uses the existing request workflow and grants nothing', async ({ page }) => {
    test.slow();
    await openHubAsNewPlayer(page);

    const response = await clickRequestAndWait(page);
    expect(response.status(), 'POST /api/organizer/requests').toBe(201);

    // The same request row the profile card and the admin queue use.
    const mine = await (await page.request.get('/api/organizer/requests/me')).json();
    expect(mine.isOrganizer).toBe(false);
    expect(mine.request?.status).toBe('pending');
    // Requesting is not approval.
    const me = await (await page.request.get('/api/auth/me')).json();
    expect(me.isOrganizer).toBeFalsy();
    await expectOrganiserApiRefused(page, 'after requesting');
  });

  test('ORG-ONB-004 A successful request shows the confirmation and turns the button off', async ({ page }) => {
    test.slow();
    await openHubAsNewPlayer(page);
    await clickRequestAndWait(page);

    await expect(page.getByTestId('organiser-onboarding-submitted')).toHaveText(COPY.submitted);
    await expect(page.getByTestId('organiser-onboarding-request')).toBeDisabled();
    await expect(page.getByTestId('organiser-onboarding-error')).toHaveCount(0);
  });

  test('ORG-ONB-005 A pending request shows "under review" and cannot be sent twice', async ({ page }) => {
    test.slow();
    await openHubAsNewPlayer(page);
    await clickRequestAndWait(page);
    const first = (await (await page.request.get('/api/organizer/requests/me')).json()).request;
    expect(first?.status).toBe('pending');

    // Back later: the status comes from the server, the button stays off.
    await page.reload();
    await expect(page.getByTestId('organiser-onboarding-pending')).toHaveText(COPY.pending);
    await expect(page.getByTestId('organiser-onboarding-request')).toBeDisabled();

    // And the server refuses a second one however it is sent.
    const again = await page.request.post('/api/organizer/requests', { data: {}, failOnStatusCode: false });
    expect(again.status()).toBe(400);
    const after = (await (await page.request.get('/api/organizer/requests/me')).json()).request;
    expect(after.id, 'still the same single request').toBe(first.id);
  });

  test('ORG-ONB-006 An approved organiser opens the Hub directly, without the modal', async ({ page }) => {
    test.slow();
    await becomeOrganiser(page);
    await page.goto('/organiser');
    await expect(page.getByTestId('organiser-dashboard')).toBeVisible({ timeout: 15000 });
    await expect(modal(page)).toHaveCount(0);
    await expect(page.getByTestId('organiser-sidebar-nav-home')).toBeVisible();
  });

  test('ORG-ONB-007 An admin opens the Hub directly, without the modal', async ({ page }) => {
    await login(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await page.goto('/organiser');
    await expect(page.getByTestId('organiser-sidebar-nav-home')).toBeVisible({ timeout: 15000 });
    await expect(modal(page)).toHaveCount(0);
    await expect(page.getByTestId('organiser-access-required')).toHaveCount(0);
  });

  test('ORG-ONB-008 A guest is sent to sign in, with the Hub as the return path, and sees no modal', async ({ page }) => {
    await page.goto('/organiser');
    await expect(page).toHaveURL(/\/auth\?returnTo=%2Forganiser$/, { timeout: 15000 });
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(modal(page)).toHaveCount(0);
    await expect(page.getByTestId('organiser-dashboard')).toHaveCount(0);
  });

  test('ORG-ONB-010 An unapproved player is refused by the organiser API, whatever the page shows', async ({ page }) => {
    test.slow();
    await openHubAsNewPlayer(page);
    await expectOrganiserApiRefused(page, 'before requesting');
  });

  test('ORG-ONB-011 A rejected request is shown as such and a new one is up to the server', async ({ page, browser }) => {
    test.slow();
    await openHubAsNewPlayer(page);
    await clickRequestAndWait(page);
    const requestId = (await (await page.request.get('/api/organizer/requests/me')).json()).request.id as string;

    await adminRejects(browser, requestId);

    await page.reload();
    await expect(page.getByTestId('organiser-onboarding-rejected')).toHaveText(COPY.rejected);
    await expectOrganiserApiRefused(page, 'after rejection');

    // The API currently lets a rejected person apply again (no cool-down), so the button is live
    // and the answer on screen follows the server's.
    const request = page.getByTestId('organiser-onboarding-request');
    await expect(request).toBeEnabled();
    const response = await clickRequestAndWait(page);
    expect(response.status(), 'POST /api/organizer/requests after a rejection').toBe(201);
    await expect(page.getByTestId('organiser-onboarding-submitted')).toHaveText(COPY.submitted);
    const latest = (await (await page.request.get('/api/organizer/requests/me')).json()).request;
    expect(latest.status).toBe('pending');
    expect(latest.id).not.toBe(requestId);
  });

  test('ORG-ONB-012a A sign-in deep link into the Hub still lands there for an approved organiser', async ({ page }) => {
    await page.goto('/organiser/sessions');
    await expect(page).toHaveURL(/\/auth\?returnTo=%2Forganiser%2Fsessions$/, { timeout: 15000 });

    await page.getByTestId('login-email').fill(TEST_USERS.organiser.email);
    await page.getByTestId('login-password').fill(TEST_USERS.organiser.password);
    await page.getByTestId('login-button').click();

    await expect(page).toHaveURL(/\/organiser\/sessions$/, { timeout: 15000 });
    await expect(page.getByTestId('organiser-sidebar-nav-sessions')).toBeVisible({ timeout: 15000 });
    await expect(modal(page)).toHaveCount(0);
  });

  test('ORG-ONB-012b A registration that started at the Hub comes back to it, and permissions are checked then', async ({ page }) => {
    test.slow();
    // Guest opens /organiser -> /auth?returnTo=%2Forganiser -> registers -> verifies the email.
    await registerPlayer(page, { startAt: '/organiser', landsOn: /\/organiser$/ });
    // Not approved, so the Hub itself answers with the request modal.
    await expect(modal(page)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('organiser-dashboard')).toHaveCount(0);
    await expectOrganiserApiRefused(page, 'after registering');
  });
});

/*
  ORG-ONB-009 - the modal at the six mandatory viewports (desktop 1440x900,
  1280x800; tablet 768x1024, 1024x768; mobile 390x844, 360x800): fits the
  screen, no horizontal overflow, 44 px targets, keyboard and touch both work,
  and phones get a bottom sheet without the photo. Needs touch events, so it
  runs in its own context options.
*/
test.describe('Organiser onboarding, responsive', () => {
  test.use({ hasTouch: true });

  const VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'tablet-portrait', width: 768, height: 1024 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small-mobile', width: 360, height: 800 },
  ] as const;

  test('ORG-ONB-009 The modal fits, has 44px controls and works by keyboard and touch at every viewport', async ({ page }, testInfo) => {
    test.slow();
    await openHubAsNewPlayer(page);
    const profile = await myProfilePath(page);

    for (const viewport of VIEWPORTS) {
      const label = `${viewport.name} ${viewport.width}x${viewport.height}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/organiser');
      const dialog = modal(page);
      await expect(dialog, label).toBeVisible({ timeout: 15000 });

      // No horizontal overflow, and the dialog sits inside the screen.
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll, `${label}: page ${sizes.scroll}px wide in ${sizes.client}px`).toBeLessThanOrEqual(sizes.client + 1);
      const box = (await dialog.boundingBox())!;
      expect(box.x, `${label}: left edge`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${label}: right edge`).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y, `${label}: top edge`).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height, `${label}: bottom edge`).toBeLessThanOrEqual(viewport.height + 1);

      // The photo is a desktop / tablet detail; phones get the sheet only.
      const photo = page.getByTestId('organiser-onboarding-photo');
      if (viewport.width < 640) {
        await expect(photo, `${label}: no photo on phones`).toBeHidden();
        expect(box.y + box.height, `${label}: bottom sheet sits on the bottom edge`).toBeGreaterThanOrEqual(viewport.height - 1);
      } else {
        await expect(photo, `${label}: photo`).toBeVisible();
      }

      // 44 px touch targets.
      for (const id of ['organiser-onboarding-close', 'organiser-onboarding-request', 'organiser-onboarding-back']) {
        const target = (await page.getByTestId(id).boundingBox())!;
        expect(target.width, `${label}: ${id} width`).toBeGreaterThanOrEqual(44);
        expect(target.height, `${label}: ${id} height`).toBeGreaterThanOrEqual(44);
      }
      await testInfo.attach(`onboarding-${viewport.name}`, { body: await page.screenshot(), contentType: 'image/png' });

      // Keyboard: Escape closes the dialog and returns to the profile.
      await page.keyboard.press('Escape');
      await expectPath(page, profile, `${label}: Escape`);

      // Touch: tap "Back to My Profile".
      await page.goto('/organiser');
      await expect(modal(page), label).toBeVisible({ timeout: 15000 });
      await page.getByTestId('organiser-onboarding-back').tap();
      await expectPath(page, profile, `${label}: tap on Back`);
    }
  });
});
