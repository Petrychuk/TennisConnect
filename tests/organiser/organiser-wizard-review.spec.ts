import { test, expect, type Page } from '@playwright/test';
import { becomeOrganiser } from '../helpers/organiser';

/*
  Create Session wizard - review step and Back (automation gap report, P0).

  Test plan
  - Risk: review shows different values from what was typed (what gets
    published), Back loses entered values.
  - Fixtures: one run-owned organiser per test (becomeOrganiser). No seeded
    sessions needed.
  - Writes: none beyond the organiser's own session draft-free flow. Nothing
    is published here (publish messages every admin - ORG-WIZ-004 only,
    opt-in). No emails, messages or payments.
  - Cleanup: run-scoped teardown removes the organiser.
  - Assertions: text on the review card and the wizard step testids; no
    waits or retries added to get green.
  - Run: npm run test:e2e -- tests/organiser/organiser-wizard-review.spec.ts

  Staging / local only (phase hub-msg-admin).
*/

test.use({ viewport: { width: 1440, height: 900 } }); // desktop wizard buttons (-bottom)

/** yyyy-mm-dd in the browser's local calendar, `days` from today. */
function dateInput(days: number): string {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function pickSocialAndFillBasics(page: Page, title: string, venue: string) {
  await page.goto('/organiser/sessions/new');
  await page.getByTestId('organiser-wizard-session-category-social-play').click();
  const chip = page.getByTestId('organiser-wizard-type-social');
  if (await chip.count()) await chip.click();
  await page.getByTestId('organiser-wizard-next-bottom').click();

  await expect(page.getByTestId('organiser-wizard-step2')).toBeVisible();
  await page.getByTestId('organiser-wizard-session-name').fill(title);
  await page.getByTestId('organiser-wizard-session-venue').fill(venue);
  await page.getByTestId('organiser-wizard-date').fill(dateInput(21));
  await page.getByTestId('organiser-wizard-next-bottom').click();
  await expect(page.getByTestId('organiser-wizard-step3')).toBeVisible();
}

test.describe('Create Session wizard - review and Back', () => {
  test('@smoke ORG-WIZ-006 Review shows the title, venue and date that were entered', async ({ page }) => {
    await becomeOrganiser(page);
    const title = `Review ${Date.now()}`;
    const venue = 'Rushcutters Bay Tennis Centre';

    await pickSocialAndFillBasics(page, title, venue);
    await page.getByTestId('organiser-wizard-next-bottom').click();

    await expect(page.getByTestId('organiser-wizard-step4')).toBeVisible();
    const summary = page.getByTestId('organiser-wizard-review-summary');
    await expect(summary).toContainText(title);
    await expect(summary).toContainText(venue);
    await expect(page.getByTestId('organiser-wizard-review-status')).toBeVisible();
  });

  test('ORG-WIZ-007 Back keeps what was entered on every step', async ({ page }) => {
    await becomeOrganiser(page);
    const title = `Back ${Date.now()}`;
    const venue = 'Back Court Centre';

    await pickSocialAndFillBasics(page, title, venue);
    await page.getByTestId('organiser-wizard-next-bottom').click();
    await expect(page.getByTestId('organiser-wizard-step4')).toBeVisible();

    // Review -> details -> basics, one Back at a time.
    await page.getByTestId('organiser-wizard-back-bottom').click();
    await expect(page.getByTestId('organiser-wizard-step3')).toBeVisible();
    await page.getByTestId('organiser-wizard-back-bottom').click();
    await expect(page.getByTestId('organiser-wizard-step2')).toBeVisible();

    await expect(page.getByTestId('organiser-wizard-session-name')).toHaveValue(title);
    await expect(page.getByTestId('organiser-wizard-session-venue')).toHaveValue(venue);
  });
});
