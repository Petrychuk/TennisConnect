import { test, expect } from '@playwright/test';
import { registerPlayer, login, logout } from '../helpers/auth';
import { completePlayerProfile } from '../helpers/profile';
import {
  sendContactMessage,
  getMyUserId,
  grantOrganizerAccess,
} from '../helpers/messages';
import { TEST_USERS } from '../fixtures/test-users';

/*
  MESSAGING FLOWS - STAGING ONLY (creates real conversations/messages).
  Do not add anything from this file to the @smoke suite.

  Two groups:
  - Private messages (MSG-101 to MSG-107): regression coverage for the
    "everything merged into one tab" / "delete brings it back" bugfix -
    each test targets one specific bug from that fix, not general
    messaging behaviour already covered by tests/messages/messages.spec.ts.
  - Service messages (MSG-108 to MSG-112): the automatic "Welcome to
    TennisConnect" message, the real-sender organiser-approval message,
    and the actionable community-invite (accept/decline). Session
    invites use the identical messageType/actionStatus code path as
    community invites - the two aren't duplicated here, and
    session-invite specifically isn't covered since it needs a full
    session/tournament created first.
*/

test('MSG-101 Two Different Conversations Show As Two Separate Tabs', async ({ page }) => {

  // ---------- Test data ----------

  const contentToCoach = `Hi coach, two-tabs check ${Date.now()}`;
  const contentToPlayer = `Hi partner, two-tabs check ${Date.now()}`;

  // ---------- Login ----------

  await registerPlayer(page);

  // ---------- Actions (message two different people) ----------

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Hi', message: contentToCoach }
  );

  await sendContactMessage(
    page,
    `/player/${TEST_USERS.player.slug}`,
    { subject: 'Hi', message: contentToPlayer }
  );

  await page.goto('/messages');

  // ---------- Verify (both show up as their own list row) ----------

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: contentToCoach })
  ).toBeVisible();

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: contentToPlayer })
  ).toBeVisible();

});

test('MSG-102 A Second Message To The Same Person Joins The Same Conversation', async ({ page }) => {

  // ---------- Test data ----------

  const firstContent = `First hello, same-thread check ${Date.now()}`;
  const secondContent = `Second hello, same-thread check ${Date.now()}`;

  // ---------- Login ----------

  await registerPlayer(page);

  // ---------- Actions (message the same coach twice) ----------

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Hi', message: firstContent }
  );

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Hi again', message: secondContent }
  );

  await page.goto('/messages');

  // ---------- Verify (one row, showing only the latest content) ----------

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: secondContent })
  ).toBeVisible();

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: firstContent })
  ).toHaveCount(0);

  // ---------- Actions (open it) ----------

  await page
    .locator('[data-testid^="message-item-"]', { hasText: secondContent })
    .click();

  // ---------- Final verification (both messages, one thread) ----------

  await expect(page.getByText(firstContent)).toBeVisible();
  await expect(page.getByText(secondContent)).toBeVisible();

});

test('MSG-103 Deleting A Conversation Removes The Whole Thread, Not Just The Latest Message', async ({ page }) => {

  // ---------- Test data ----------

  const firstContent = `Delete test first message ${Date.now()}`;
  const secondContent = `Delete test second message ${Date.now()}`;

  // ---------- Login ----------

  await registerPlayer(page);

  // ---------- Actions (a two-message thread) ----------

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Delete test', message: firstContent }
  );

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Delete test', message: secondContent }
  );

  await page.goto('/messages');

  await page
    .locator('[data-testid^="message-item-"]', { hasText: secondContent })
    .click();

  // ---------- Actions (delete it) ----------

  const [deleteResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/messages\/[^/]+$/.test(response.url()) &&
        response.request().method() === 'DELETE'
    ),
    page.getByTestId('button-delete-message').click(),
  ]);

  // ---------- Verify request ----------

  expect(deleteResponse.ok()).toBeTruthy();

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: secondContent })
  ).toHaveCount(0);

  // ---------- Final verification ----------
  // The actual regression: previously only the latest message
  // (secondContent) was deleted from the DB, so the still-present
  // earlier message (firstContent) would resurface as the new list
  // representative the next time the inbox re-fetches - reload
  // simulates exactly that re-fetch.

  await page.reload();

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: secondContent })
  ).toHaveCount(0);

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: firstContent })
  ).toHaveCount(0);

});

test('MSG-104 A Conversation You Started Shows In Your Own Inbox Before Any Reply', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Starting fresh, own-inbox check ${Date.now()}`;

  // ---------- Login ----------

  const me = await registerPlayer(page);

  // ---------- Actions (message someone who hasn't replied yet) ----------

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'New chat', message: content }
  );

  await page.goto('/messages');

  // ---------- Verify ----------
  // Previously this conversation simply wasn't queried at all (the
  // inbox only looked up messages where you're the recipient), so it
  // never appeared until the coach replied.

  const conversationItem = page.locator('[data-testid^="message-item-"]', { hasText: content });
  await expect(conversationItem).toBeVisible();

  // And when it does appear, it must show the coach's identity, not
  // the current viewer's own - the list row used to fall back to
  // senderName/senderAvatar, which for a message you sent yourself is
  // your own name.
  await expect(conversationItem).not.toContainText(me.name);

});

test('MSG-105 Replying To Your Own Just-Sent Message Reaches The Recipient, Not Yourself', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Original from me, reply-direction check ${Date.now()}`;
  const followUp = `Quick follow-up, reply-direction check ${Date.now()}`;

  // ---------- Login ----------

  await registerPlayer(page);

  // ---------- Actions (message someone, then reply to your own thread before they've said anything back) ----------

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Follow-up test', message: content }
  );

  const me = await getMyUserId(page);

  await page.goto('/messages');
  await page
    .locator('[data-testid^="message-item-"]', { hasText: content })
    .click();

  await page.getByTestId('button-reply').click();
  await page.getByTestId('textarea-reply').fill(followUp);

  const [replyResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/messages/reply') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('button-send-reply').click(),
  ]);

  // ---------- Verify request ----------
  // The regression: this used to set the reply's recipient back to
  // originalMessage.senderUserId - which, for a message you sent
  // yourself, is you. The "reply" would silently address itself back
  // to the person who just sent it: you.

  expect(replyResponse.ok()).toBeTruthy();
  const reply = await replyResponse.json();
  expect(reply.recipientId).not.toBe(me);

  await logout(page);

  // ---------- Final verification (the coach actually received both) ----------

  await login(page, TEST_USERS.coach.email, TEST_USERS.coach.password);
  await page.goto('/messages');

  await page
    .locator('[data-testid^="message-item-"]', { hasText: followUp })
    .click();

  await expect(page.getByText(content)).toBeVisible();
  await expect(page.getByText(followUp)).toBeVisible();

});

test('MSG-106 Only A Participant Can Delete A Conversation', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Private thread, delete-auth check ${Date.now()}`;

  // ---------- Login (sender) ----------

  await registerPlayer(page);

  const sendResponse = await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Private', message: content }
  );
  const sentMessage = await sendResponse.json();

  await logout(page);

  // ---------- Login (an unrelated bystander) ----------

  await registerPlayer(page);

  // ---------- Actions ----------

  const deleteResponse = await page.request.delete(`/api/messages/${sentMessage.id}`);

  // ---------- Final verification ----------

  expect(deleteResponse.status()).toBe(403);

});

test('MSG-107 Only A Participant Can Reply To A Conversation', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Private thread, reply-auth check ${Date.now()}`;

  // ---------- Login (sender) ----------

  await registerPlayer(page);

  const sendResponse = await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Private', message: content }
  );
  const sentMessage = await sendResponse.json();

  await logout(page);

  // ---------- Login (an unrelated bystander) ----------

  await registerPlayer(page);

  // ---------- Actions ----------

  const replyResponse = await page.request.post('/api/messages/reply', {
    data: {
      originalMessageId: sentMessage.id,
      content: 'sneaky reply',
    },
  });

  // ---------- Final verification ----------

  expect(replyResponse.status()).toBe(403);

});

// ========================================================================
// Service messages
// ========================================================================

test('MSG-108 Welcome System Message Appears On Registration', async ({ page }) => {

  // ---------- Login ----------

  await registerPlayer(page);

  // ---------- Open page ----------

  await page.goto('/messages');

  // ---------- Verify ----------

  const welcomeItem = page.locator(
    '[data-testid^="message-item-"]',
    { hasText: /welcome to tennisconnect/i }
  );

  await expect(welcomeItem).toBeVisible();
  await expect(welcomeItem).toContainText('Tennis Connect');

});

test('MSG-109 Cannot Reply To A System Message With No Real Sender', async ({ page }) => {

  // ---------- Login ----------

  await registerPlayer(page);

  // ---------- Open page ----------

  await page.goto('/messages');

  await page
    .locator('[data-testid^="message-item-"]', { hasText: /welcome to tennisconnect/i })
    .click();

  // ---------- Actions ----------

  await page.getByTestId('button-reply').click();
  await page.getByTestId('textarea-reply').fill('Is anyone there?');

  const [replyResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/messages/reply') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('button-send-reply').click(),
  ]);

  // ---------- Final verification ----------

  expect(replyResponse.ok()).toBeFalsy();
  await expect(page.getByText(/failed to send reply/i)).toBeVisible();

});

test('MSG-110 Organiser-Approval Message Has A Real Sender And Can Be Replied To', async ({ page }) => {

  // ---------- Test data (a fresh player, promoted to organiser) ----------

  const organiser = await registerPlayer(page);
  await completePlayerProfile(page);
  await logout(page);

  // ---------- Actions (admin grants organiser access) ----------

  await grantOrganizerAccess(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password,
    organiser.email
  );

  // ---------- Login (organiser checks their inbox) ----------

  await login(page, organiser.email, organiser.password);
  await page.goto('/messages');

  const approvalItem = page.locator(
    '[data-testid^="message-item-"]',
    { hasText: /approved as an organiser/i }
  );
  await expect(approvalItem).toBeVisible();
  await approvalItem.click();

  // ---------- Actions (reply to it) ----------

  await page.getByTestId('button-reply').click();
  await page.getByTestId('textarea-reply').fill('Thank you!');

  const [replyResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/messages/reply') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('button-send-reply').click(),
  ]);

  // ---------- Final verification ----------
  // Unlike the welcome message (MSG-109), this one has a real admin
  // behind it, so replying should actually work.

  expect(replyResponse.ok()).toBeTruthy();

});

test('MSG-111 Community Invite - Accept', async ({ page }) => {

  // ---------- Test data (organiser with their own organisation) ----------

  const organiser = await registerPlayer(page);
  await completePlayerProfile(page);
  await logout(page);

  await grantOrganizerAccess(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password,
    organiser.email
  );

  await login(page, organiser.email, organiser.password);

  const orgResponse = await page.request.post('/api/organizer/organizations', {
    data: { name: `Playwright Club ${Date.now()}` },
  });
  expect(orgResponse.ok()).toBeTruthy();

  await logout(page);

  // ---------- Test data (the invitee) ----------

  const invitee = await registerPlayer(page);
  const inviteeId = await getMyUserId(page);
  await logout(page);

  // ---------- Actions (organiser sends the invite) ----------

  await login(page, organiser.email, organiser.password);

  const inviteResponse = await page.request.post('/api/organizer/players/invite', {
    data: { userId: inviteeId },
  });
  expect(inviteResponse.ok()).toBeTruthy();

  await logout(page);

  // ---------- Login (invitee checks their inbox) ----------

  await login(page, invitee.email, invitee.password);
  await page.goto('/messages');

  const inviteItem = page.locator(
    '[data-testid^="message-item-"]',
    { hasText: /invited you to join/i }
  );
  await expect(inviteItem).toBeVisible();
  await inviteItem.click();

  const acceptButton = page.locator('[data-testid^="invitation-accept-"]');
  await expect(acceptButton).toBeVisible();

  // ---------- Actions (accept) ----------

  const [acceptResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/messages\/.+\/accept$/.test(response.url()) &&
        response.request().method() === 'POST'
    ),
    acceptButton.click(),
  ]);

  // ---------- Final verification ----------

  expect(acceptResponse.ok()).toBeTruthy();

  await expect(
    page.locator('[data-testid^="invitation-status-"]')
  ).toContainText(/invitation accepted/i);

});

test('MSG-112 Community Invite - Decline', async ({ page }) => {

  // ---------- Test data (organiser with their own organisation) ----------

  const organiser = await registerPlayer(page);
  await completePlayerProfile(page);
  await logout(page);

  await grantOrganizerAccess(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password,
    organiser.email
  );

  await login(page, organiser.email, organiser.password);

  const orgResponse = await page.request.post('/api/organizer/organizations', {
    data: { name: `Playwright Club ${Date.now()}` },
  });
  expect(orgResponse.ok()).toBeTruthy();

  await logout(page);

  // ---------- Test data (the invitee) ----------

  const invitee = await registerPlayer(page);
  const inviteeId = await getMyUserId(page);
  await logout(page);

  // ---------- Actions (organiser sends the invite) ----------

  await login(page, organiser.email, organiser.password);

  const inviteResponse = await page.request.post('/api/organizer/players/invite', {
    data: { userId: inviteeId },
  });
  expect(inviteResponse.ok()).toBeTruthy();

  await logout(page);

  // ---------- Login (invitee checks their inbox) ----------

  await login(page, invitee.email, invitee.password);
  await page.goto('/messages');

  const inviteItem = page.locator(
    '[data-testid^="message-item-"]',
    { hasText: /invited you to join/i }
  );
  await expect(inviteItem).toBeVisible();
  await inviteItem.click();

  const declineButton = page.locator('[data-testid^="invitation-decline-"]');
  await expect(declineButton).toBeVisible();

  // ---------- Actions (decline) ----------

  const [declineResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/messages\/.+\/decline$/.test(response.url()) &&
        response.request().method() === 'POST'
    ),
    declineButton.click(),
  ]);

  // ---------- Final verification ----------

  expect(declineResponse.ok()).toBeTruthy();

  await expect(
    page.locator('[data-testid^="invitation-status-"]')
  ).toContainText(/invitation declined/i);

});
