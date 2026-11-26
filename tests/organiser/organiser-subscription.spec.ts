import { test, expect, type Page } from '@playwright/test';
import { login, registerPlayer } from '../helpers/auth';
import { becomeOrganiser, grantTestSubscription, registerApprovedOrganiser, subscriptionsEnabled } from '../helpers/organiser';
import { skipUnlessStripeEnabled } from '../helpers/staging-gates';
import { TEST_USERS } from '../fixtures/test-users';

/*
  ORG-SUB-002..011 - Organiser Hub paid subscription (A$40/month, 7-day trial),
  the full Staging regression for the feature. The server's switch is
  ORGANISER_SUBSCRIPTION_ENABLED (default off): every test reads the mode from
  GET /api/organizer/billing/status and skips itself when it is the other one,
  so the same suite is valid whichever way Staging is configured. Run it twice
  (flag off, then on) for full coverage - docs/testing/organiser-subscription.md.

  What the rules are (server/lib/organiserSubscription.ts):
    flag off  organiser access = admin approval alone, no pricing, no billing
    flag on   organiser access = admin approval AND an active/trialing
              subscription (or a grandfathered account); admins exempt;
              approval and payment never grant each other.

  Safety (docs/CLAUDE_PLAYWRIGHT_RULES.md): Staging / local only, never Production
  (not in the @prod-safe allowlist - PROD-SAFE-034 is the Production check).
  Every account is run-owned (registerPlayer / registerApprovedOrganiser; erased
  by the run-scoped teardown). Subscription states are set through the test hook
  on run-owned users only (tests/helpers/organiser.ts grantTestSubscription) - no
  card is ever entered and no real charge is possible: ORG-SUB-011 only checks
  that Checkout is created (Stripe TEST mode, opt-in E2E_ENABLE_STRIPE_TESTS=1)
  and stops before leaving for Stripe. The baseline admin/organiser accounts are
  only signed into, never changed.
  Phases: hub-msg-admin (002..010), stripe (011).
*/

interface Billing {
  enabled: boolean;
  stage?: string;
  entitled: boolean;
  status?: string;
  price?: { amountCents: number; currency: string; interval: string; trialDays: number };
}

const COPY = {
  title: 'Organiser Hub — A$40/month',
  trial: 'Start with a 7-day free trial.',
  terms:
    'Try Organiser Hub free for 7 days. After your trial ends, your subscription will automatically renew at A$40 per month until you cancel.',
  cancel: 'Cancel anytime before your trial ends to avoid being charged.',
  request: 'Request Organiser Access',
};

const modal = (page: Page) => page.getByTestId('organiser-onboarding-modal');
const subscribeModal = (page: Page) => page.getByTestId('organiser-subscribe-modal');

async function billing(page: Page): Promise<Billing> {
  const res = await page.request.get('/api/organizer/billing/status', { failOnStatusCode: false });
  expect(res.status(), 'GET /api/organizer/billing/status').toBe(200);
  return (await res.json()) as Billing;
}

/** The endpoint every Organiser Hub page needs (requireOrganizer). */
async function hubApiStatus(page: Page): Promise<{ status: number; code?: string }> {
  const res = await page.request.get('/api/organizer/session-templates', { failOnStatusCode: false });
  const body = await res.json().catch(() => null);
  return { status: res.status(), code: body?.code };
}

async function openRequestModal(page: Page) {
  await page.goto('/organiser');
  await expect(modal(page)).toBeVisible({ timeout: 15000 });
}

async function expectPricing(page: Page, prefix: 'organiser-onboarding' | 'organiser-subscribe') {
  await expect(page.getByTestId(`${prefix}-pricing-title`)).toHaveText(COPY.title);
  await expect(page.getByTestId(`${prefix}-pricing-trial`)).toHaveText(COPY.trial);
  await expect(page.getByTestId(`${prefix}-pricing-terms`)).toHaveText(COPY.terms);
  await expect(page.getByTestId(`${prefix}-pricing-cancel`)).toHaveText(COPY.cancel);
}

test.describe('Organiser subscription', () => {
  test('ORG-SUB-002 Subscriptions off: no pricing anywhere, billing inert, the request flow unchanged', async ({ page }) => {
    test.slow();
    await registerPlayer(page);
    const mode = await billing(page);
    test.skip(mode.enabled, 'Subscriptions are ON on this server (ORG-SUB-003.. cover that mode)');

    expect(mode, 'flag off says nothing about price or trial').toEqual({ enabled: false, stage: 'disabled', entitled: false });

    await openRequestModal(page);
    await expect(page.getByTestId('organiser-onboarding-pricing')).toHaveCount(0);
    await expect(page.getByTestId('organiser-onboarding-after-approval')).toHaveCount(0);
    const text = (await modal(page).innerText()) ?? '';
    expect(text, 'no billing claim while billing is off').not.toMatch(/A\$|free trial|per month|\/month|subscription/i);
    await expect(page.getByTestId('organiser-onboarding-request')).toHaveText(COPY.request);
    await expect(page.getByTestId('organiser-onboarding-request')).toBeEnabled({ timeout: 15000 });

    // Billing endpoints do nothing: no Stripe call, no customer, no session.
    for (const path of ['/api/organizer/billing/checkout', '/api/organizer/billing/portal']) {
      const res = await page.request.post(path, { data: {}, failOnStatusCode: false });
      expect(res.status(), `POST ${path}`).toBe(404);
    }
  });

  test('ORG-SUB-003 Subscriptions on: the request modal shows the exact pricing and trial terms beside the request button', async ({ page }) => {
    test.slow();
    await registerPlayer(page);
    const mode = await billing(page);
    test.skip(!mode.enabled, 'Subscriptions are OFF on this server (ORG-SUB-002 covers that mode)');
    expect(mode.stage).toBe('not_approved');
    expect(mode.price, 'the price comes from the server').toEqual({ amountCents: 4000, currency: 'aud', interval: 'month', trialDays: 7 });

    await openRequestModal(page);
    await expectPricing(page, 'organiser-onboarding');

    // All terms are visible together - nothing hidden in a tooltip or collapsed.
    for (const part of ['title', 'trial', 'terms', 'cancel']) {
      await expect(page.getByTestId(`organiser-onboarding-pricing-${part}`)).toBeVisible();
    }
    await expect(page.locator('[role="tooltip"]')).toHaveCount(0);

    // The primary action is unchanged and the approval-first order is stated.
    const cta = page.getByTestId('organiser-onboarding-request');
    await expect(cta).toHaveText(COPY.request);
    await expect(cta).toBeEnabled();
    await expect(page.getByTestId('organiser-onboarding-after-approval')).toBeVisible();
    await expect(page.getByTestId('organiser-onboarding-note')).toContainText('subject to approval');
  });

  for (const viewport of [
    { label: 'desktop', width: 1280, height: 900 },
    { label: 'tablet', width: 768, height: 1024 },
    { label: 'phone', width: 390, height: 844 },
  ]) {
    test(`ORG-SUB-004 Subscriptions on: pricing sits above the request button without overflow (${viewport.label})`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await registerPlayer(page);
      const mode = await billing(page);
      test.skip(!mode.enabled, 'Subscriptions are OFF on this server');

      await openRequestModal(page);
      const pricing = page.getByTestId('organiser-onboarding-pricing');
      const cta = page.getByTestId('organiser-onboarding-request');
      await pricing.scrollIntoViewIfNeeded();
      await expect(pricing).toBeVisible();
      await cta.scrollIntoViewIfNeeded();
      await expect(cta).toBeVisible();

      const [p, c, m] = await Promise.all([pricing.boundingBox(), cta.boundingBox(), modal(page).boundingBox()]);
      expect(p && c && m, 'boxes').toBeTruthy();
      expect(p!.y, 'pricing is above the request button').toBeLessThan(c!.y);
      expect(p!.x, 'pricing inside the dialog (left)').toBeGreaterThanOrEqual(m!.x - 1);
      expect(p!.x + p!.width, 'pricing inside the dialog (right)').toBeLessThanOrEqual(m!.x + m!.width + 1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(1);
    });
  }

  test('ORG-SUB-005 Subscriptions on: someone who is not approved cannot start checkout, and asking for access does not subscribe them', async ({ page }) => {
    test.slow();
    await registerPlayer(page);
    const mode = await billing(page);
    test.skip(!mode.enabled, 'Subscriptions are OFF on this server');

    const checkout = await page.request.post('/api/organizer/billing/checkout', { data: {}, failOnStatusCode: false });
    expect(checkout.status(), 'checkout before approval').toBe(409);
    expect((await checkout.json()).message).toMatch(/approved/i);

    await openRequestModal(page);
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/organizer/requests') && r.request().method() === 'POST'),
      page.getByTestId('organiser-onboarding-request').click(),
    ]);
    await expect(page.getByTestId('organiser-onboarding-submitted')).toBeVisible();
    await expectPricing(page, 'organiser-onboarding');

    const after = await billing(page);
    expect(after.stage, 'a request is not an approval').toBe('not_approved');
    expect(after.entitled).toBe(false);
    expect((await hubApiStatus(page)).status).toBe(403);
  });

  test('ORG-SUB-006 Subscriptions on: an approved organiser without a subscription sees the subscribe screen, and the API says 402', async ({ page }) => {
    test.slow();
    const { organiser } = await registerApprovedOrganiser(page);
    test.skip(!(await subscriptionsEnabled(page)), 'Subscriptions are OFF on this server');

    const mode = await billing(page);
    expect(mode.stage).toBe('subscribe_required');
    expect(mode.entitled).toBe(false);
    expect(await hubApiStatus(page)).toEqual({ status: 402, code: 'SUBSCRIPTION_REQUIRED' });

    await page.goto('/organiser');
    await expect(subscribeModal(page)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('organiser-dashboard')).toHaveCount(0);
    await expectPricing(page, 'organiser-subscribe');
    await expect(page.getByTestId('organiser-subscribe-cta')).toBeEnabled();

    // Leaving goes to their own profile; nothing of the Hub was rendered.
    await page.getByTestId('organiser-subscribe-back').click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toMatch(/^\/(player|coach)\//);
    expect(organiser.email).toBeTruthy();
  });

  test('ORG-SUB-007 Subscriptions on: a subscription opens the Hub and ending it closes it again - approval is untouched throughout', async ({ page }) => {
    test.slow();
    const { organiser } = await registerApprovedOrganiser(page);
    test.skip(!(await subscriptionsEnabled(page)), 'Subscriptions are OFF on this server');

    await grantTestSubscription(organiser.email, 'trialing');
    expect((await billing(page)).stage).toBe('subscribed');
    expect((await hubApiStatus(page)).status).toBe(200);
    // The Hub dashboard needs an organisation (what becomeOrganiser sets up).
    const org = await page.request.post('/api/organizer/organizations', { data: { name: `Playwright Club ${Date.now()}` }, failOnStatusCode: false });
    expect(org.status(), 'create organisation once subscribed').toBeLessThan(300);
    await page.goto('/organiser');
    await expect(page.getByTestId('organiser-dashboard')).toBeVisible({ timeout: 15000 });
    await expect(subscribeModal(page)).toHaveCount(0);

    await grantTestSubscription(organiser.email, 'canceled');
    expect((await hubApiStatus(page))).toEqual({ status: 402, code: 'SUBSCRIPTION_REQUIRED' });
    await page.reload();
    await expect(subscribeModal(page)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('organiser-dashboard')).toHaveCount(0);

    // Re-subscribing brings access back; the account was an approved organiser the whole time.
    await grantTestSubscription(organiser.email, 'active');
    expect((await hubApiStatus(page)).status).toBe(200);
    const me = await (await page.request.get('/api/auth/me')).json();
    expect(me.isOrganizer, 'approval is separate from payment').toBe(true);
  });

  test('ORG-SUB-008 Subscriptions on: payment alone never makes someone an organiser', async ({ page }) => {
    test.slow();
    const user = await registerPlayer(page);
    const mode = await billing(page);
    test.skip(!mode.enabled, 'Subscriptions are OFF on this server');

    await grantTestSubscription(user.email, 'active'); // paid, never approved
    expect((await hubApiStatus(page)).status).toBe(403);
    const me = await (await page.request.get('/api/auth/me')).json();
    expect(me.isOrganizer).toBe(false);
    await openRequestModal(page); // the request-access modal, not the Hub and not the subscribe screen
    await expect(subscribeModal(page)).toHaveCount(0);
    await expect(page.getByTestId('organiser-dashboard')).toHaveCount(0);
  });

  test('ORG-SUB-009 Subscriptions on: admins and grandfathered organisers keep their access without a subscription', async ({ browser }) => {
    test.slow();
    const probe = await browser.newContext();
    const probePage = await probe.newPage();
    let enabled = false;
    try {
      await login(probePage, TEST_USERS.admin.email, TEST_USERS.admin.password);
      enabled = (await billing(probePage)).enabled;
      test.skip(!enabled, 'Subscriptions are OFF on this server');
      expect((await billing(probePage)).stage).toBe('admin');
      await probePage.goto('/organiser');
      await expect(probePage.getByTestId('organiser-dashboard')).toBeVisible({ timeout: 15000 });
      await expect(probePage.getByTestId('organiser-subscribe-modal')).toHaveCount(0);
    } finally {
      await probe.close();
    }

    // The permanent organiser account existed before the flag, so the
    // migration's backfill grandfathered it (migrations/0037). If this fails,
    // re-run that INSERT on this database before switching the flag on.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, TEST_USERS.organiser.email, TEST_USERS.organiser.password);
      const mode = await billing(page);
      expect(mode.stage, 'baseline organiser is grandfathered (re-run the 0037 backfill)').toBe('grandfathered');
      expect(mode.entitled).toBe(true);
      await page.goto('/organiser');
      await expect(page.getByTestId('organiser-dashboard')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('organiser-subscribe-modal')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('ORG-SUB-010 Subscriptions off: an approved organiser works exactly as before, with no subscribe screen', async ({ page }) => {
    test.slow();
    const organiser = await becomeOrganiser(page);
    test.skip(await subscriptionsEnabled(page), 'Subscriptions are ON on this server (ORG-SUB-006/007 cover that mode)');

    expect((await billing(page)).entitled).toBe(true);
    expect((await hubApiStatus(page)).status).toBe(200);
    await page.goto('/organiser');
    await expect(page.getByTestId('organiser-dashboard')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('organiser-subscribe-modal')).toHaveCount(0);
    await expect(page.getByTestId('organiser-subscription-row')).toHaveCount(0);

    // Their own profile card has no billing controls either.
    await page.goto(`/player/${organiser.slug}`);
    await expect(page.getByTestId('organiser-subscription-manage')).toHaveCount(0);
  });

  test('ORG-SUB-011 Subscriptions on: Subscribe creates a Stripe Checkout subscription (test mode) and never sends a price from the browser', async ({ page }) => {
    test.slow();
    // Creates a Stripe Checkout session: off unless E2E_ENABLE_STRIPE_TESTS=1.
    skipUnlessStripeEnabled();
    await registerApprovedOrganiser(page);
    test.skip(!(await subscriptionsEnabled(page)), 'Subscriptions are OFF on this server');

    // Stop before leaving for Stripe: only the session creation is under test.
    await page.route(/^https:\/\/checkout\.stripe\.com\//, (route) => route.abort());
    await page.goto('/organiser');
    await expect(subscribeModal(page)).toBeVisible({ timeout: 15000 });

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/organizer/billing/checkout') && r.request().method() === 'POST', { timeout: 30000 }),
      page.getByTestId('organiser-subscribe-cta').click(),
    ]);
    expect(response.status()).toBe(200);
    const { url } = await response.json();
    expect(new URL(url).hostname, 'a hosted Stripe Checkout page').toBe('checkout.stripe.com');
    expect(response.request().postData() ?? '{}', 'the browser sends no price or amount').not.toMatch(/amount|price|trial/i);
  });
});
