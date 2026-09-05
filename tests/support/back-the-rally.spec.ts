import { test, expect } from '@playwright/test';

/*
  BACK THE RALLY — STAGING ONLY (can create real Stripe Checkout
  sessions against whatever STRIPE_SECRET_KEY is configured for this
  environment - a test key on staging, per the project's own
  convention, never a live key). Do not add anything from this file
  to the @smoke suite.

  Doesn't attempt to complete an actual Stripe test payment (typing a
  test card number on Stripe's own hosted page) - that's explicitly
  out of scope per the brief ("do not attempt to automate real card
  processing outside Stripe's supported test environment"). Tests up
  to and including the redirect attempt, and separately confirms the
  post-redirect success/cancelled views render correctly by driving
  the same ?support= query param Stripe itself would return with.

  Entirely guest-accessible by design (a visitor can support
  TennisConnect without an account) - none of these tests log in.
*/

test('SUPPORT-001 Back The Rally Widget Is Visible In The Header', async ({ page }) => {

  await page.goto('/');

  await expect(page.getByTestId('button-back-the-rally')).toBeVisible();

});

test('SUPPORT-002 Back The Rally Is Visible In The Mobile Menu, After The Nav Links', async ({ page }) => {

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');

  await page.getByTestId('button-mobile-menu').click();

  const drawer = page.locator('[role="dialog"]').last();
  await expect(drawer.getByTestId('button-back-the-rally')).toBeVisible();

});

test('SUPPORT-003 Opening The Modal Shows The Tier Picker, Not Card Fields', async ({ page }) => {

  await page.goto('/');
  await page.getByTestId('button-back-the-rally').click();

  const modal = page.getByTestId('back-the-rally-modal');
  await expect(modal).toBeVisible();

  await expect(modal.getByText('Back the Rally', { exact: true })).toBeVisible();
  await expect(page.getByTestId('support-tier-first_serve')).toContainText('A$5');
  await expect(page.getByTestId('support-tier-keep_the_rally_going')).toContainText('A$10');
  await expect(page.getByTestId('support-tier-keep_the_rally_going')).toContainText(/most popular/i);
  await expect(page.getByTestId('support-tier-game_point')).toContainText('A$20');
  await expect(page.getByTestId('support-tier-game_changer')).toContainText('A$50');
  await expect(page.getByTestId('input-custom-amount')).toBeVisible();

  await expect(page.getByTestId('button-continue-to-payment')).toBeVisible();
  await expect(modal.getByText(/secure payment powered by stripe/i)).toBeVisible();

  // The modal itself never shows card-brand logos or claims Apple
  // Pay/Google Pay are available - Stripe Checkout is what actually
  // decides and displays what's available to this visitor, once they
  // get there.
  await expect(modal.getByText(/visa|mastercard|apple pay|google pay/i)).toHaveCount(0);

  // No embedded card-number/expiry/CVC fields either - those live on
  // Stripe's own hosted Checkout page, never in this app's own UI.
  await expect(page.locator('input[placeholder*="1234" i]')).toHaveCount(0);

});

test('SUPPORT-004 Modal Closes With Escape', async ({ page }) => {

  await page.goto('/');
  await page.getByTestId('button-back-the-rally').click();

  await expect(page.getByTestId('back-the-rally-modal')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByTestId('back-the-rally-modal')).toHaveCount(0);

});

test('SUPPORT-005 Selecting A Tier And Typing A Custom Amount Are Mutually Exclusive', async ({ page }) => {

  await page.goto('/');
  await page.getByTestId('button-back-the-rally').click();

  const tenDollarTier = page.getByTestId('support-tier-keep_the_rally_going');
  const twentyDollarTier = page.getByTestId('support-tier-game_point');
  const customInput = page.getByTestId('input-custom-amount');

  // A$10 is selected by default (see the brief's own "A$10 - Most
  // Popular") - not relying on colour alone, the selected tier gets
  // aria-checked=true and a checkmark icon.
  await expect(tenDollarTier).toHaveAttribute('aria-checked', 'true');

  await twentyDollarTier.click();
  await expect(twentyDollarTier).toHaveAttribute('aria-checked', 'true');
  await expect(tenDollarTier).toHaveAttribute('aria-checked', 'false');

  await customInput.fill('15');
  await expect(twentyDollarTier).toHaveAttribute('aria-checked', 'false');
  await expect(customInput).toHaveValue('15');

  await tenDollarTier.click();
  await expect(tenDollarTier).toHaveAttribute('aria-checked', 'true');
  await expect(customInput).toHaveValue('');

});

test('SUPPORT-006 Invalid Custom Amount Blocks Continue And Shows An Error', async ({ page }) => {

  await page.goto('/');
  await page.getByTestId('button-back-the-rally').click();

  await page.getByTestId('input-custom-amount').fill('1');

  await expect(page.getByTestId('custom-amount-error')).toBeVisible();
  await expect(page.getByTestId('button-continue-to-payment')).toBeDisabled();

  await page.getByTestId('input-custom-amount').fill('50');

  await expect(page.getByTestId('custom-amount-error')).toHaveCount(0);
  await expect(page.getByTestId('button-continue-to-payment')).toBeEnabled();

});

test('SUPPORT-007 Continue To Payment Calls The Checkout Endpoint (Guest, No Login)', async ({ page }) => {

  await page.goto('/');
  await page.getByTestId('button-back-the-rally').click();

  const [request] = await Promise.all([
    page.waitForRequest(
      r =>
        r.url().includes('/api/support/create-checkout-session') &&
        r.method() === 'POST'
    ),
    page.getByTestId('button-continue-to-payment').click(),
  ]);

  const body = request.postDataJSON();

  // A$10 is the default selection - the client sends the tier, never
  // a dollar amount, for a preset tier (the brief's own "frontend
  // must NOT be trusted to determine the final payment amount").
  expect(body.tier).toBe('keep_the_rally_going');
  expect(body.customAmountCents).toBeUndefined();

  // Whether Stripe is actually configured in this environment or not,
  // the client handles both outcomes: redirected to a real Stripe
  // Checkout URL, or a clear error toast if support payments aren't
  // set up yet here - never a silent failure either way.
  await Promise.race([
    page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 10_000 }),
    expect(page.getByText(/couldn't start payment/i)).toBeVisible({ timeout: 10_000 }),
  ]);

});

test('SUPPORT-008 Custom Amount Sends Cents, Not Dollars', async ({ page }) => {

  await page.goto('/');
  await page.getByTestId('button-back-the-rally').click();

  await page.getByTestId('input-custom-amount').fill('25.50');

  const [request] = await Promise.all([
    page.waitForRequest(
      r =>
        r.url().includes('/api/support/create-checkout-session') &&
        r.method() === 'POST'
    ),
    page.getByTestId('button-continue-to-payment').click(),
  ]);

  const body = request.postDataJSON();

  expect(body.tier).toBe('custom');
  expect(body.customAmountCents).toBe(2550);

});

test('SUPPORT-009 Returning From Checkout With ?support=success Shows The Success View', async ({ page }) => {

  await page.goto('/?support=success');

  await expect(page.getByTestId('support-success-view')).toBeVisible();
  await expect(page.getByText(/you backed the rally/i)).toBeVisible();

  // The query param is cleaned up immediately so a refresh doesn't
  // reopen the success view on its own.
  await expect(page).toHaveURL(/^(?!.*support=success).*$/);

  await page.getByTestId('button-back-to-tennisconnect').click();
  await expect(page.getByTestId('back-the-rally-modal')).toHaveCount(0);

});

test('SUPPORT-010 Returning From Checkout With ?support=cancelled Shows The Cancelled View', async ({ page }) => {

  await page.goto('/?support=cancelled');

  await expect(page.getByTestId('support-cancelled-view')).toBeVisible();
  await expect(page.getByText(/no worries/i)).toBeVisible();

});
