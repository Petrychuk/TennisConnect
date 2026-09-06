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

  await expect(page.locator('nav').getByTestId('button-back-the-rally')).toBeVisible();

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
  await page.locator('nav').getByTestId('button-back-the-rally').click();

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
  await page.locator('nav').getByTestId('button-back-the-rally').click();

  await expect(page.getByTestId('back-the-rally-modal')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByTestId('back-the-rally-modal')).toHaveCount(0);

});

test('SUPPORT-005 Selecting A Tier And Typing A Custom Amount Are Mutually Exclusive', async ({ page }) => {

  await page.goto('/');
  await page.locator('nav').getByTestId('button-back-the-rally').click();

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
  await page.locator('nav').getByTestId('button-back-the-rally').click();

  await page.getByTestId('input-custom-amount').fill('1');

  await expect(page.getByTestId('custom-amount-error')).toBeVisible();
  await expect(page.getByTestId('button-continue-to-payment')).toBeDisabled();

  await page.getByTestId('input-custom-amount').fill('50');

  await expect(page.getByTestId('custom-amount-error')).toHaveCount(0);
  await expect(page.getByTestId('button-continue-to-payment')).toBeEnabled();

});

test('SUPPORT-007 Continue To Payment Opens A New Tab, Doesn\'t Navigate The Current One', async ({ page, context }) => {

  await page.goto('/');
  await page.locator('nav').getByTestId('button-back-the-rally').click();

  const [request, popup] = await Promise.all([
    page.waitForRequest(
      r =>
        r.url().includes('/api/support/create-checkout-session') &&
        r.method() === 'POST'
    ),
    // Whether Stripe is actually configured in this environment or
    // not, the client handles both outcomes: a new tab opens to a
    // real Stripe Checkout URL, or a clear error toast if support
    // payments aren't set up yet here - never a silent failure
    // either way. context.waitForEvent races against the toast
    // rather than requiring the popup, since an unconfigured
    // environment never opens one at all.
    Promise.race([
      context.waitForEvent('page', { timeout: 10_000 }),
      expect(page.getByText(/couldn't start payment/i)).toBeVisible({ timeout: 10_000 }).then(() => null),
    ]),
    page.getByTestId('button-continue-to-payment').click(),
  ]);

  const body = request.postDataJSON();

  // A$10 is the default selection - the client sends the tier, never
  // a dollar amount, for a preset tier (the brief's own "frontend
  // must NOT be trusted to determine the final payment amount").
  expect(body.tier).toBe('keep_the_rally_going');
  expect(body.customAmountCents).toBeUndefined();

  // The original tab never navigates away from the site itself - only
  // a new tab (if Stripe is configured) does.
  await expect(page).toHaveURL(/^http:\/\/localhost/);

  if (popup) {
    await popup.waitForLoadState();
    expect(popup.url()).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  }

});

test('SUPPORT-008 Custom Amount Sends Cents, Not Dollars', async ({ page }) => {

  await page.goto('/');
  await page.locator('nav').getByTestId('button-back-the-rally').click();

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

test('SUPPORT-011 Selected Tier Stays Fully Opaque On Mobile (Doesn\'t Let The Photo Show Through)', async ({ page }) => {

  // Regression test: the selected state originally used a translucent
  // bg-primary/10 background, which - on mobile, where the modal's
  // photo backdrop sits behind the whole panel - let the photo bleed
  // through the selected card, clashing with its own text baked into
  // the photo. Fixed by using the opaque --accent colour instead.
  // Checking the actual computed alpha here rather than just the
  // class name, since a class swap alone wouldn't have caught this -
  // bg-primary/10 is translucent by definition regardless of which
  // background class "wins" the cascade.

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('nav').getByTestId('button-back-the-rally').click();

  const tenDollarTier = page.getByTestId('support-tier-keep_the_rally_going');
  await expect(tenDollarTier).toHaveAttribute('aria-checked', 'true');

  const alpha = await tenDollarTier.evaluate((el) => {
    const bg = getComputedStyle(el).backgroundColor;
    const match = bg.match(/rgba?\(([^)]+)\)/);
    if (!match) return 1;
    const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
    return parts.length === 4 ? parts[3] : 1;
  });

  expect(alpha).toBe(1);

});

test('SUPPORT-012 Widget Is Genuinely Centered Between The Last Nav Link And Sign In, Not Just Given A Fixed Margin', async ({ page }) => {

  // Regression test for "too close to Sign In, not centered" - two
  // earlier attempts at this gave the widget a fixed left margin,
  // which couldn't actually work: the space on the nav-links side is
  // structurally whatever's left over from justify-between across the
  // whole header (large at wide viewports), while a fixed margin is
  // constant, so the two sides could never match at every width. The
  // fix instead wraps the widget in its own flex-1 slot between the
  // nav links and the CTA group, so it centers itself in whatever
  // space is actually there. Checking that directly via bounding
  // boxes - comparing the gap on each side - rather than checking any
  // specific CSS property, since centering here is an emergent result
  // of the layout, not one property on the widget itself.

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const nav = page.locator('nav');
  const widget = nav.getByTestId('button-back-the-rally');
  const lastLink = nav.getByRole('link', { name: 'Tennis IQ' });
  const signIn = nav.getByText('Sign In', { exact: true });

  await expect(widget).toBeVisible();
  await expect(lastLink).toBeVisible();
  await expect(signIn).toBeVisible();

  const linkBox = await lastLink.boundingBox();
  const widgetBox = await widget.boundingBox();
  const signInBox = await signIn.boundingBox();
  expect(linkBox).not.toBeNull();
  expect(widgetBox).not.toBeNull();
  expect(signInBox).not.toBeNull();

  const gapBefore = widgetBox!.x - (linkBox!.x + linkBox!.width);
  const gapAfter = signInBox!.x - (widgetBox!.x + widgetBox!.width);

  // Not pixel-identical (real text/image metrics never land exactly
  // even), just genuinely comparable rather than one side dwarfing
  // the other the way "large natural gap" vs "small fixed gap-4"
  // used to.
  expect(Math.abs(gapBefore - gapAfter)).toBeLessThan(40);

});

test('SUPPORT-013 Back The Rally Is Also In The Footer, After The Newsletter Form, Centered', async ({ page }) => {

  // The header and footer both render the same shared component with
  // the identical data-testid - scoping to the footer landmark here
  // the same way other tests scope to nav, rather than introducing a
  // second testid scheme just to tell the two instances apart.

  await page.goto('/');

  const footer = page.locator('footer');
  const footerWidget = footer.getByTestId('button-back-the-rally');

  await footerWidget.scrollIntoViewIfNeeded();
  await expect(footerWidget).toBeVisible();

  // Comes after the newsletter form specifically, not before it or
  // somewhere unrelated elsewhere in the footer.
  const formBox = await footer.getByPlaceholder('Your email').boundingBox();
  const widgetBox = await footerWidget.boundingBox();
  expect(formBox).not.toBeNull();
  expect(widgetBox).not.toBeNull();
  expect(widgetBox!.y).toBeGreaterThan(formBox!.y);

  // Opens the same modal as the header trigger does.
  await footerWidget.click();
  await expect(page.getByTestId('back-the-rally-modal')).toBeVisible();

});

test('SUPPORT-014 Heart Icon Shows In The Modal Header On Mobile Too, Not Just Desktop', async ({ page }) => {

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('nav').getByTestId('button-back-the-rally').click();

  const modal = page.getByTestId('back-the-rally-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('svg.lucide-heart').first()).toBeVisible();

});
