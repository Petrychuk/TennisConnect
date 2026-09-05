import { expect, Page } from '@playwright/test';
import { login, logout } from './auth';

// ---------- Send via profile "Contact" tab ----------

// Shared by MSG-001 (player -> coach), MSG-005 (player -> player),
// MSG-006 (coach -> player), MSG-007 (organizer -> player) - they all
// land on the same recipient profile page and the same Contact tab UI,
// only the logged-in sender's role differs.
export async function sendContactMessage(
  page: Page,
  profilePath: string,
  data: { subject: string; message: string; phone?: string }
) {
  await page.goto(`${profilePath}?tab=contact`);

  await page.getByTestId('contact-tab').click();

  await page.getByTestId('input-contact-subject').fill(data.subject);

  if (data.phone) {
    await page.getByTestId('input-contact-phone').fill(data.phone);
  }

  await page.getByTestId('textarea-contact-message').fill(data.message);

  const sendButton = page.getByTestId('button-send-contact-message');
  await expect(sendButton).toBeEnabled();

  const [response] = await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/messages') &&
        response.request().method() === 'POST'
    ),
    sendButton.click(),
  ]);

  return response;
}

// ---------- Service-message setup ----------

// The current session's own user id - needed wherever a test has to
// name itself as a message recipient (e.g. inviting "this user" to a
// community) without the test file reaching into fixture internals to
// get it.
export async function getMyUserId(page: Page): Promise<string> {
  const res = await page.request.get('/api/auth/me');
  const me = await res.json();
  return me.id;
}

// Same recipe as MSG-007 (admin grants organiser access via the admin
// panel), extracted here since the service-message tests need it more
// than once (organizer-approval message itself, plus every test that
// needs an organiser to send a community/session invite from). Logs
// the admin in, grants access, logs back out - the caller logs in as
// whoever they need next.
export async function grantOrganizerAccess(
  page: Page,
  adminEmail: string,
  adminPassword: string,
  organiserEmail: string
) {
  await login(page, adminEmail, adminPassword);
  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  const row = page.locator('tr', {
    has: page.getByText(organiserEmail, { exact: true }),
  });

  await row.getByTitle('Grant Organiser Access').click();

  await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/.+\/grant-organizer$/.test(response.url()) &&
        response.request().method() === 'PATCH'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  await logout(page);
}

// The public players/coaches listings require isApproved (on top of
// profileCompleted - see storage.getAllPlayers), unlike a profile page
// reached directly by slug, which only needs profileCompleted. A
// fresh test account isn't approved by default, so anything that
// needs its target to actually show up on a listing (not just be
// reachable by URL) needs this first.
export async function approveUser(
  page: Page,
  adminEmail: string,
  adminPassword: string,
  userId: string
) {
  await login(page, adminEmail, adminPassword);
  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  await page.getByTestId(`approve-user-${userId}`).click();

  await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/.+\/approve$/.test(response.url()) &&
        response.request().method() === 'PATCH'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);

  await logout(page);
}
