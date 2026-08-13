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

  await page.getByTestId('register-button').click();

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

  await page.getByTestId('register-button').click();

  return user;
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