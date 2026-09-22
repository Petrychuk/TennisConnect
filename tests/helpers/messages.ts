import { expect, Page } from '@playwright/test';
import { login, logout } from './auth';

// ---------- Send via the profile's "Message" quick-message modal
// (player-profile.tsx's redesign - Contact tab was removed for player
// profiles specifically; coach-profile.tsx is untouched and still uses
// sendContactMessage above) ----------

// Shared by MSG-005 (player -> player), MSG-006 (coach -> player),
// MSG-007 (organizer -> player) - all land on a player's profile page.
// The new modal has no separate subject field, so `subject` (when
// given) is folded into the message body instead of dropped silently.
export async function sendPlayerProfileMessage(
  page: Page,
  profilePath: string,
  data: { subject?: string; message: string }
) {
  await page.goto(profilePath);

  await page.getByTestId('bottom-cta-message').click();

  const fullMessage = data.subject ? `${data.subject}: ${data.message}` : data.message;
  await page.getByTestId('input-quick-message').fill(fullMessage);

  const sendButton = page.getByTestId('button-send-quick-message');
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

// Shared by MSG-001 (player -> coach) and any other coach-target
// scenario - coach-profile.tsx's Contact tab is unchanged. Player-
// target scenarios (MSG-005/006/007) now use sendPlayerProfileMessage
// above instead.
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
  await page.getByTestId('organiser-sidebar-nav-admin-users').click();

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

// Admin Hide/Restore Profile - the "real sender" version of a service
// message (see systemMessages.ts: sendMessageBetween puts the acting
// admin's own id in senderUserId, unlike sendSystemMessage's
// senderUserId: null). Deliberately does NOT log out afterwards - the
// caller needs to stay on the admin session to check the admin's own
// inbox for this conversation.
export async function hideUserAsAdmin(
  page: Page,
  adminEmail: string,
  adminPassword: string,
  userId: string
) {
  await login(page, adminEmail, adminPassword);
  await page.goto('/admin');
  await page.getByTestId('organiser-sidebar-nav-admin-users').click();

  await page.getByTestId(`hide-user-${userId}`).click();

  await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/admin\/users\/.+\/hide$/.test(response.url()) &&
        response.request().method() === 'PATCH'
    ),
    page.getByTestId('user-action-confirm').click(),
  ]);
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
  await page.getByTestId('organiser-sidebar-nav-admin-users').click();

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
