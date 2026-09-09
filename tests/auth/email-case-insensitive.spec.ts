import { test, expect, Page } from '@playwright/test';
import { dismissCookieBanner, logout, completeVerification } from '../helpers/auth';

// Alternates upper/lower on the local part only, domain left as-is -
// deliberately not just .toUpperCase()/.toLowerCase() on the whole
// string, so this also exercises a "fix" that only normalized part of
// the address (e.g. just the domain) rather than the whole thing.
function mixedCaseEmail(base: string) {
  const [local, domain] = base.split('@');
  const mixed = local
    .split('')
    .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c))
    .join('');
  return `${mixed}@${domain}`;
}

async function registerWithEmail(page: Page, name: string, email: string, password: string) {
  await page.getByTestId('register-tab').click();
  await page.getByTestId('reg-name').fill(name);
  await page.getByTestId('reg-email').fill(email);
  await page.getByTestId('reg-password').fill(password);
  await page.getByTestId('confirm-password').fill(password);
  await page.getByTestId('agree-to-terms').check();

  return Promise.all([
    page.waitForResponse((res) =>
      res.url().includes('/api/auth/register') && res.request().method() === 'POST'
    ),
    page.getByTestId('register-button').click(),
  ]);
}

test('AUTH-011 Register - a duplicate email is rejected regardless of casing', async ({ page }) => {
  const timestamp = Date.now();
  const email = `test_case_${timestamp}@tennisconnect.test`;
  const password = 'Test123456!';

  await page.goto('/auth');
  await dismissCookieBanner(page);

  // First registration - the "real" account, address typed as-is.
  // Registering no longer creates a session (server/routes.ts
  // /api/auth/register) - it stays on /auth showing the "check your
  // email" screen, which is exactly the state this test needs to
  // reach the register form again for the second attempt below anyway.
  await registerWithEmail(page, `Case Test ${timestamp}`, email, password);
  await expect(page.getByTestId('registration-pending-screen')).toBeVisible();

  // Second attempt, same address but different casing. A fresh
  // navigation resets the "check your email" screen back to the
  // regular form.
  await page.goto('/auth');
  const [response] = await registerWithEmail(
    page,
    `Case Test Dupe ${timestamp}`,
    mixedCaseEmail(email),
    password
  );

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.message).toMatch(/already exists/i);

  // Never made it past the register form into a second account.
  await expect(page).toHaveURL(/\/auth/);
});

test('AUTH-012 Login succeeds with a different email casing than used at registration', async ({ page }) => {
  const timestamp = Date.now();
  const email = mixedCaseEmail(`test_case_login_${timestamp}@tennisconnect.test`);
  const password = 'Test123456!';

  await page.goto('/auth');
  await dismissCookieBanner(page);

  await registerWithEmail(page, `Case Login Test ${timestamp}`, email, password);
  await expect(page.getByTestId('registration-pending-screen')).toBeVisible();

  // Registering only sends a verification email now - login below
  // would 403 EMAIL_NOT_VERIFIED without this, regardless of casing.
  await completeVerification(page, email);
  await expect(page).toHaveURL(/\/complete-profile/);

  await logout(page);

  // Log back in with the address in a DIFFERENT casing than what was
  // typed at registration.
  await page.goto('/auth');
  await page.getByTestId('login-email').fill(email.toLowerCase());
  await page.getByTestId('login-password').fill(password);

  await Promise.all([
    page.waitForResponse(res =>
      res.url().includes('/api/auth/login') && res.request().method() === 'POST'
    ),
    page.getByTestId('login-button').click(),
  ]);

  await expect(page).toHaveURL(/\/complete-profile|\/player\/.+|\/coach\/.+/);

  // This account never completes its profile (registered, then
  // logged straight out), so after the /complete-profile redirect fix
  // it correctly lands back there - which has no navbar/profile-menu
  // at all (see AUTH-014's own reasoning). Only expect the menu when
  // landing on an actual profile page.
  const url = page.url();
  if (/\/(player|coach)\//.test(url)) {
    await expect(page.getByTestId('profile-menu')).toBeVisible();
  } else {
    await expect(page).toHaveURL(/\/complete-profile/);
  }
});

test('AUTH-013 Registered email is stored lowercase regardless of the casing typed', async ({ page }) => {
  const timestamp = Date.now();
  const email = mixedCaseEmail(`test_case_storage_${timestamp}@tennisconnect.test`);
  const password = 'Test123456!';

  await page.goto('/auth');
  await dismissCookieBanner(page);

  await registerWithEmail(page, `Case Storage Test ${timestamp}`, email, password);
  await expect(page.getByTestId('registration-pending-screen')).toBeVisible();

  // /api/auth/me only returns a real user for an authenticated request
  // (see server/routes.ts - a guest now gets 200 { authenticated:
  // false, user: null } rather than 401), and there's no session until
  // the email is confirmed.
  await completeVerification(page, email);
  await expect(page).toHaveURL(/\/complete-profile/);

  // /api/auth/me returns exactly what's stored/session-serialized (see
  // server/routes.ts's `res.json({ ...req.user, ... })`) - this is the
  // direct check that the DB row itself got lowercased, not just that
  // later lookups happen to tolerate mixed case.
  const meResponse = await page.request.get('/api/auth/me');
  expect(meResponse.ok()).toBeTruthy();
  const me = await meResponse.json();

  expect(me.authenticated).toBe(true);
  expect(me.email).toBe(email.toLowerCase());
  // Guards against a no-op "fix" that only made lookups case-insensitive
  // without actually normalizing what gets stored - mixedCaseEmail()
  // always has at least one real uppercase letter, so this can only
  // pass if normalization genuinely happened.
  expect(me.email).not.toBe(email);
});
