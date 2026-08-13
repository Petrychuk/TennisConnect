import { test, expect } from '@playwright/test';
import { registerPlayer, login, logout } from '../helpers/auth';
import { completePlayerProfile } from '../helpers/profile';
import { sendContactMessage } from '../helpers/messages';
import { TEST_USERS } from '../fixtures/test-users';

/*
  MESSAGING SUITE — staging only (creates real conversations/messages).
  Do not add anything from this file to the @smoke suite - see
  tests/smoke/smoke.spec.ts for the read-only subset that's safe on prod.
*/

test('MSG-001 Send Message Player → Coach', async ({ page }) => {

  // ---------- Test data ----------

  const subject = `Lesson enquiry ${Date.now()}`;
  const content = `Hi coach, I'd like to book a lesson. ${Date.now()}`;

  // ---------- Login ----------

  const player = await registerPlayer(page);

  // ---------- Open page ----------
  // ---------- Actions ----------
  // ---------- Save ----------
  // ---------- Verify request ----------

  const response = await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject, message: content }
  );

  expect(response.ok()).toBeTruthy();

  // ---------- Final verification ----------

  await expect(
    page.getByText(/message sent/i)
  ).toBeVisible();

});

test('MSG-002 Reply Message', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Original message ${Date.now()}`;
  const replyContent = `Thanks for reaching out! ${Date.now()}`;

  // ---------- Login ----------

  const player = await registerPlayer(page);

  // ---------- Actions (player sends first message) ----------

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Lesson enquiry', message: content }
  );

  await logout(page);

  // ---------- Login (coach replies) ----------

  await login(page, TEST_USERS.coach.email, TEST_USERS.coach.password);

  await page.goto('/messages');

  const conversationItem = page.locator('[data-testid^="message-item-"]', {
    hasText: content,
  }).first();

  await conversationItem.click();

  await page.getByTestId('button-reply').click();
  await page.getByTestId('textarea-reply').fill(replyContent);

  const [replyResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/messages/reply') &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('button-send-reply').click(),
  ]);

  expect(replyResponse.ok()).toBeTruthy();

  await logout(page);

  // ---------- Final verification (player sees reply) ----------

  await login(page, player.email, player.password);

  await page.goto('/messages');

  await expect(
    page.getByText(replyContent)
  ).toBeVisible();

});

test('MSG-003 Unread Counter', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Unread counter check ${Date.now()}`;

  // ---------- Actions (player sends a fresh message to coach) ----------

  const player = await registerPlayer(page);

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Unread test', message: content }
  );

  await logout(page);

  // ---------- Login (coach checks inbox) ----------

  await login(page, TEST_USERS.coach.email, TEST_USERS.coach.password);

  await page.goto('/messages');

  // ---------- Verify ----------

  const badge = page.getByTestId('unread-badge');
  await expect(badge).toBeVisible();

  const countBefore = parseInt(
    (await badge.textContent()) || '0',
    10
  );
  expect(countBefore).toBeGreaterThan(0);

  // ---------- Actions (open the new conversation) ----------

  await page
    .locator('[data-testid^="message-item-"]', { hasText: content })
    .first()
    .click();

  // ---------- Final verification (counter drops) ----------

  await page.reload();

  const badgeAfter = page.getByTestId('unread-badge');
  const countAfter = (await badgeAfter.isVisible().catch(() => false))
    ? parseInt((await badgeAfter.textContent()) || '0', 10)
    : 0;

  expect(countAfter).toBeLessThan(countBefore);

});

test('MSG-004 Mark Conversation as Read', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Mark as read check ${Date.now()}`;

  const player = await registerPlayer(page);

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Read test', message: content }
  );

  await logout(page);

  await login(page, TEST_USERS.coach.email, TEST_USERS.coach.password);

  await page.goto('/messages');

  const conversationItem = page.locator('[data-testid^="message-item-"]', {
    hasText: content,
  }).first();

  // ---------- Actions ----------

  const [readResponse] = await Promise.all([
    page.waitForResponse(
      response =>
        /\/api\/messages\/conversation\/.+\/read$/.test(response.url()) &&
        response.request().method() === 'PUT'
    ),
    conversationItem.click(),
  ]);

  // ---------- Verify request ----------

  expect(readResponse.ok()).toBeTruthy();

  // ---------- Reload ----------

  await page.reload();

  // ---------- Final verification ----------

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: content })
  ).not.toHaveClass(/bg-muted hover:bg-muted\/80/);

});

test('MSG-005 Player → Player Message', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Want to play a match? ${Date.now()}`;

  // ---------- Login ----------

  await registerPlayer(page);

  // ---------- Actions / Save / Verify request ----------

  const response = await sendContactMessage(
    page,
    `/player/${TEST_USERS.player.slug}`,
    { subject: "Let's play", message: content }
  );

  // ---------- Final verification ----------

  expect(response.ok()).toBeTruthy();

  await expect(
    page.getByText(/message sent/i)
  ).toBeVisible();

});

test('MSG-006 Coach → Player Message', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Great session today! ${Date.now()}`;

  // ---------- Login ----------

  await login(page, TEST_USERS.coach.email, TEST_USERS.coach.password);

  // ---------- Actions / Verify request ----------

  const response = await sendContactMessage(
    page,
    `/player/${TEST_USERS.player.slug}`,
    { subject: 'Session follow-up', message: content }
  );

  // ---------- Final verification ----------

  expect(response.ok()).toBeTruthy();

  await expect(
    page.getByText(/message sent/i)
  ).toBeVisible();

});

test('MSG-007 Organizer → Player Message', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Reminder about your upcoming session. ${Date.now()}`;

  // ---------- Test data (a fresh player, promoted to organiser) ----------

  const organiser = await registerPlayer(page);
  await completePlayerProfile(page);
  await logout(page);

  // ---------- Login (admin grants organiser access) ----------

  await login(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  await page.goto('/admin');
  await page.getByTestId('admin-tab-users').click();

  const row = page.locator('tr', {
    has: page.getByText(organiser.email, { exact: true }),
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

  // ---------- Login (organiser sends the message) ----------

  await login(page, organiser.email, organiser.password);

  const response = await sendContactMessage(
    page,
    `/player/${TEST_USERS.player.slug}`,
    { subject: 'Session reminder', message: content }
  );

  // ---------- Final verification ----------

  expect(response.ok()).toBeTruthy();

  await expect(
    page.getByText(/message sent/i)
  ).toBeVisible();

});

test('MSG-008 Conversation Ordering (Latest Message First)', async ({ browser }) => {

  // ---------- Test data ----------

  const olderContent = `Older message ${Date.now()}`;

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await registerPlayer(pageA);
  await sendContactMessage(
    pageA,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'First', message: olderContent }
  );
  await contextA.close();

  const newerContent = `Newer message ${Date.now()}`;

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await registerPlayer(pageB);
  await sendContactMessage(
    pageB,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Second', message: newerContent }
  );
  await contextB.close();

  // ---------- Login (coach checks ordering) ----------

  const contextC = await browser.newContext();
  const pageC = await contextC.newPage();

  await login(pageC, TEST_USERS.coach.email, TEST_USERS.coach.password);
  await pageC.goto('/messages');

  // ---------- Verify ----------

  const firstItem = pageC.locator('[data-testid^="message-item-"]').first();
  await expect(firstItem).toContainText(newerContent);

  await contextC.close();

});

test('MSG-009 Message Timestamp Display', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Timestamp check ${Date.now()}`;

  const player = await registerPlayer(page);

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Timestamp test', message: content }
  );

  await logout(page);

  await login(page, TEST_USERS.coach.email, TEST_USERS.coach.password);
  await page.goto('/messages');

  await page
    .locator('[data-testid^="message-item-"]', { hasText: content })
    .first()
    .click();

  // ---------- Verify ----------

  await expect(
    page.getByText(/[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} (AM|PM)/).first()
  ).toBeVisible();

});

test('MSG-010 Empty Conversation State', async ({ page }) => {

  // ---------- Login (brand-new player, no messages ever) ----------

  await registerPlayer(page);

  // ---------- Open page ----------

  await page.goto('/messages');

  // ---------- Verify ----------

  await expect(
    page.getByTestId('messages-empty-state')
  ).toBeVisible();

  await expect(
    page.getByText(/no messages yet/i)
  ).toBeVisible();

});

test('MSG-011 Empty Message Validation', async ({ page }) => {

  // ---------- Login ----------

  await registerPlayer(page);

  // ---------- Open page ----------

  await page.goto(`/coach/${TEST_USERS.coach.slug}?tab=contact`);
  await page.getByTestId('contact-tab').click();

  const sendButton = page.getByTestId('button-send-contact-message');

  // ---------- Verify (fully empty -> button disabled) ----------

  await expect(sendButton).toBeDisabled();

  // ---------- Actions (subject filled, message too short) ----------

  await page.getByTestId('input-contact-subject').fill('Hi');
  await page.getByTestId('textarea-contact-message').fill('hi');

  // ---------- Verify (still enforced server/schema-side) ----------

  await sendButton.click();

  await expect(
    page.getByText(/at least 5 characters|validation error/i)
  ).toBeVisible();

});

test('MSG-012 Unauthorized User Redirect', async ({ page }) => {

  // ---------- Open page (guest views a coach's Contact tab) ----------

  await page.goto(`/coach/${TEST_USERS.coach.slug}?tab=contact`);
  await page.getByTestId('contact-tab').click();

  // ---------- Verify ----------

  const signInCard = page.getByTestId('coach-contact-signed-out');
  await expect(signInCard).toBeVisible();

  // ---------- Actions ----------

  await page.getByTestId('coach-contact-sign-in').click();

  // ---------- Final verification ----------

  await expect(page).toHaveURL(/\/auth/);

});

test('MSG-013 Guest Cannot Access Messages', async ({ page }) => {

  // ---------- Open page ----------

  await page.goto('/messages');

  // ---------- Verify ----------

  await expect(
    page.getByText(/sign in to view messages/i)
  ).toBeVisible();

  await expect(
    page.locator('[data-testid^="message-item-"]')
  ).toHaveCount(0);

});

test('MSG-014 Message Persists After Page Refresh', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Persistence check ${Date.now()}`;

  // ---------- Actions (player sends to coach) ----------

  await registerPlayer(page);

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Persistence test', message: content }
  );

  await logout(page);

  // ---------- Login (coach receives it) ----------

  await login(page, TEST_USERS.coach.email, TEST_USERS.coach.password);
  await page.goto('/messages');

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: content })
  ).toBeVisible();

  // ---------- Reload ----------

  await page.reload();

  // ---------- Final verification ----------

  await expect(
    page.locator('[data-testid^="message-item-"]', { hasText: content })
  ).toBeVisible();

});

test('MSG-015 Toast Notifications', async ({ page }) => {

  // ---------- Test data ----------

  const content = `Toast check ${Date.now()}`;

  // ---------- Login ----------

  await registerPlayer(page);

  // ---------- Verify: success toast ----------

  await sendContactMessage(
    page,
    `/coach/${TEST_USERS.coach.slug}`,
    { subject: 'Toast test', message: content }
  );

  await expect(
    page.getByText(/message sent/i)
  ).toBeVisible();

  // ---------- Verify: validation-error toast ----------

  await page.goto(`/coach/${TEST_USERS.coach.slug}?tab=contact`);
  await page.getByTestId('contact-tab').click();
  await page.getByTestId('input-contact-subject').fill('Hi');
  await page.getByTestId('textarea-contact-message').fill('hi');
  await page.getByTestId('button-send-contact-message').click();

  await expect(
    page.getByText(/validation error/i)
  ).toBeVisible();

});
