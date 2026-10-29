import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { generateTestUser } from '../fixtures/test-users';
import { postTestHook } from './test-hooks';
import { baselineIdentity, classifyEmail, BASELINE_IDENTITIES, type BaselineRole } from '../../server/seeds/e2e/identities';
import { baselineSessionState, forgetBaselineSession, sessionCookies } from './e2e-auth';

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

// Stands in for "open the verification email and click the link".
// /api/test-hooks/issue-verification-token (server/routes/testHooks.ts)
// is a 404 outside development/staging (checked against DB_ENV, not
// NODE_ENV - see that file's own comment for why), requires
// E2E_TEST_HOOK_SECRET (sent by postTestHook, never via the browser),
// and only issues tokens for isTestUser accounts - i.e. accounts
// registered on the reserved @tennisconnect.test domain, which the
// server flags as test users on development/staging only.
// Everything past this point - hitting /verify-email, the backend
// verifying the token and creating the session, the redirect - is the
// same real flow a person clicking the emailed link goes through.
export async function completeVerification(page: Page, email: string) {
  const { token } = await postTestHook<{ token: string }>('issue-verification-token', { email });

  // Waits for the actual GET /api/auth/verify-email response, not just
  // for page.goto() to resolve - that only guarantees the initial HTML/
  // JS loaded, not that verify-email.tsx's own fetch (which is what
  // sets the session cookie) has completed yet. Callers that
  // immediately make an authenticated request right after this
  // (page.request.get('/api/auth/me'), for instance) would otherwise
  // race it.
  await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/auth/verify-email') &&
        response.request().method() === 'GET'
    ),
    page.goto(`/verify-email?token=${token}`),
  ]);
}

// Contexts whose session came from the worker's cached baseline login -
// logout() clears their cookies instead of ending the shared server session.
const cachedSessionContexts = new WeakSet<BrowserContext>();

export interface LoginOptions {
  /**
   * Type the password into the login form even for a permanent Stage 2
   * account. Only for tests of the login form itself - each one counts
   * against the 10-per-15-minutes login limit.
   */
  ui?: boolean;
}

function baselineRoleFor(email: string): BaselineRole | undefined {
  if (classifyEmail(email).kind !== 'baseline') return undefined;
  const normalised = email.trim().toLowerCase();
  return BASELINE_IDENTITIES.find(identity => identity.email === normalised)?.role;
}

/**
 * Signs in as a permanent Stage 2 account by reusing this worker's cached
 * API session (tests/helpers/e2e-auth.ts) - no password typed, no extra
 * login request per test. Re-logs in once if the server ended the session.
 */
async function loginWithCachedSession(page: Page, role: BaselineRole) {
  const info = test.info();
  const identity = baselineIdentity(role);
  for (let attempt = 0; attempt < 2; attempt++) {
    const statePath = await baselineSessionState(role, info);
    // Switching accounts: drop the previous account's session cookie first.
    // Adding the cached cookie on top of a browser-set one (e.g. right after
    // registerPlayer()) can leave two session cookies with different
    // attributes; the API check below then saw the admin while the page's
    // own requests still sent the player's, and /admin showed "Admin Access
    // Required" (ADMIN-001/005/007 in the 28 Oct Staging run).
    // Leave the previous account's page first. Its polling (unread counts,
    // messages) keeps sending requests, and every authenticated response
    // re-sets that account's session cookie (server/auth.ts updates
    // lastActivity, so express-session rewrites the cookie). One response
    // landing after the switch put the player's cookie back over the
    // admin's - /admin then said "You don't have admin privileges"
    // (ADMIN-001/007, MSG-116 in both Staging rounds).
    await page.goto('about:blank');
    await page.context().clearCookies();
    await page.context().addCookies(sessionCookies(statePath));
    const me = await page.request.get('/api/auth/me', { failOnStatusCode: false });
    const body = me.ok() ? await me.json().catch(() => null) : null;
    if (body?.authenticated && String(body.email).toLowerCase() === identity.email) {
      cachedSessionContexts.add(page.context());
      // Where the real login redirects: the account's own profile.
      await page.goto(`/${identity.userRole}/${identity.slug}`);
      await dismissCookieBanner(page);
      await expect(page.getByTestId('profile-menu')).toBeVisible({ timeout: 15000 });
      return;
    }
    forgetBaselineSession(role, info.parallelIndex);
  }
  throw new Error(`[e2e-auth] could not restore a session for ${identity.email}. Has the Staging seed been run?`);
}

export async function login(
  page: Page,
  email: string,
  password: string,
  options: LoginOptions = {}
) {
  const role = baselineRoleFor(email);
  if (role && !options.ui) {
    await loginWithCachedSession(page, role);
    return;
  }

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

  // Wait for the post-login redirect. An account that never finished its
  // profile is sent to /complete-profile instead of its own profile page
  // (that's AUTH-014's whole point) - accounts made by registerPlayer()
  // without completePlayerProfile() are exactly that, so both are a
  // successful login here (MSG-002 used to time out on this).
  await expect(page).toHaveURL(/\/player\/.+|\/coach\/.+|\/complete-profile/, {
    timeout: 15000,
  });

  if (/\/complete-profile/.test(new URL(page.url()).pathname)) {
    await expect(page.getByTestId('complete-profile-logout')).toBeVisible({ timeout: 15000 });
    return;
  }

  // дождаться появления меню пользователя
  await expect(
    page.getByTestId('profile-menu')
  ).toBeVisible({
    timeout: 15000,
  });
}

export async function logout(page: Page) {
  // A cached Stage 2 session is shared by the worker's other tests: sign
  // this context out locally instead of ending the session on the server.
  if (cachedSessionContexts.has(page.context())) {
    cachedSessionContexts.delete(page.context());
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page).toHaveURL('/');
    return;
  }

  // /complete-profile (where registerPlayer()/registerCoach() leave a new
  // account) has no site header, so there is no profile menu to open -
  // it has its own Sign out button instead. Waiting on whichever of the
  // two appears, rather than only the profile menu, is what used to time
  // out after 60 s in MSG-016/115/116, AUTH-012 and AUTH-014.
  const profileMenu = page.getByTestId('profile-menu');
  const completeProfileLogout = page.getByTestId('complete-profile-logout');
  await expect(profileMenu.or(completeProfileLogout).first()).toBeVisible({ timeout: 15000 });

  if (await completeProfileLogout.isVisible()) {
    await completeProfileLogout.click();
  } else {
    await profileMenu.click();
    await page.getByTestId('logout-btn').click();
  }

  await expect(page).toHaveURL('/');
}