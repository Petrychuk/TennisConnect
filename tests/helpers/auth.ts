import { expect, Page } from '@playwright/test';
import { generateTestUser } from '../fixtures/test-users';

// ---------- Cookie consent ----------

// The cookie consent banner is fixed to the bottom of the viewport and
// intercepts pointer events on any control it overlaps (e.g. "Agree to
// terms", "Login"). It only appears once per browser context (first
// navigation, before consent is stored), so every helper that starts a
// flow with page.goto() must dismiss it before interacting with the page.
export async function dismissCookieBanner(page: Page) {
  const acceptButton = page.getByTestId('cookie-banner-accept-button');

  try {
    await acceptButton.waitFor({ state: 'visible', timeout: 5000 });

    await acceptButton.click();

    await expect(
      page.getByTestId('cookie-consent-banner')
    ).toBeHidden();
  } catch {
    // Banner did not appear (e.g. consent already stored in this context) - nothing to do.
  }
}

export async function registerPlayer(page: Page) {
  const user = generateTestUser('player');

  await page.goto('/auth');
  await dismissCookieBanner(page);

  await page.getByTestId('register-tab').click();
  //await page.getByTestId('player-card').click();

  await page.getByTestId('reg-name').fill(user.name);
  await page.getByTestId('reg-email').fill(user.email);
  await page.getByTestId('reg-password').fill(user.password);
  await page.getByTestId('confirm-password').fill(user.password);

  await page.getByTestId('agree-to-terms').check();

  // Registering no longer creates a session by itself - it only sends
  // a verification email (see server/routes.ts /api/auth/register).
  // The "check your email" screen confirms the request went through;
  // completeVerification() below stands in for actually clicking the
  // emailed link, since there's no real inbox to read it from here.
  await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/auth/register') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('register-button').click(),
  ]);

  await expect(page.getByTestId('registration-pending-screen')).toBeVisible({
    timeout: 15000,
  });

  await completeVerification(page, user.email);

  await expect(page).toHaveURL(/\/complete-profile/, {
    timeout: 15000,
  });

  return user;
}

export async function registerCoach(page: Page) {
  const user = generateTestUser('coach');

  await page.goto('/auth');
  await dismissCookieBanner(page);

  await page.getByTestId('register-tab').click();
  await page.getByTestId('coach-card').click();

  await page.getByTestId('reg-name').fill(user.name);
  await page.getByTestId('reg-email').fill(user.email);
  await page.getByTestId('reg-password').fill(user.password);
  await page.getByTestId('confirm-password').fill(user.password);

  await page.getByTestId('agree-to-terms').check();

  await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/auth/register') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('register-button').click(),
  ]);

  await expect(page.getByTestId('registration-pending-screen')).toBeVisible({
    timeout: 15000,
  });

  await completeVerification(page, user.email);

  await expect(page).toHaveURL(/\/complete-profile/, {
    timeout: 15000,
  });

  return user;
}

// Stands in for "open the verification email and click the link, then
// click Confirm Email Address". /api/test-hooks/issue-verification-token
// (server/routes/testHooks.ts) is a 404 outside development/staging
// (checked against DB_ENV, not NODE_ENV - see that file's own comment
// for why), so this only ever works against the environments this suite
// is meant to run in at all (tests/global-setup.ts already refuses a
// real-prod run outright). Everything past this point - landing on
// /verify-email, clicking through, the backend verifying the token and
// creating the session, the redirect - is the same real flow a person
// clicking the emailed link goes through.
export async function completeVerification(page: Page, email: string) {
  const response = await page.request.post('/api/test-hooks/issue-verification-token', {
    data: { email },
  });

  if (!response.ok()) {
    throw new Error(
      `completeVerification(): test hook returned ${response.status()} for ${email} - ` +
      `is the server running with NODE_ENV=development, or DB_ENV=staging?`
    );
  }

  const { token } = await response.json();

  await page.goto(`/verify-email?token=${token}`);

  // verify-email.tsx no longer fires the verification request the
  // moment the page loads - a real click on "Confirm Email Address" is
  // required (defends against mail clients that pre-fetch links to scan
  // them, which would otherwise burn this single-use token before a
  // human ever sees the page). Waits for the actual GET
  // /api/auth/verify-email response, not just the click resolving - that
  // only guarantees the request was sent, not that the session cookie
  // it sets has arrived yet. Callers that immediately make an
  // authenticated request right after this
  // (page.request.get('/api/auth/me'), for instance) would otherwise
  // race it.
  await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/auth/verify-email') &&
        response.request().method() === 'GET'
    ),
    page.getByTestId('confirm-email-button').click(),
  ]);
}

export async function login(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/auth');
  await dismissCookieBanner(page);

  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);

  await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/auth/login') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('login-button').click(),
  ]);

  // дождаться окончания редиректа
  await expect(page).toHaveURL(/\/player\/.+|\/coach\/.+/, {
    timeout: 15000,
  });

  // дождаться появления меню пользователя
  await expect(
    page.getByTestId('profile-menu')
  ).toBeVisible({
    timeout: 15000,
  });
}

export async function logout(page: Page) {
  await page.getByTestId('profile-menu').click();

  await page.getByTestId('logout-btn').click();

  await expect(page).toHaveURL('/');
}