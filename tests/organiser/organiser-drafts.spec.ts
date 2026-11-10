import { test, expect, Page } from '@playwright/test';
import { becomeOrganiser } from '../helpers/organiser';
import { login, logout } from '../helpers/auth';
import { getSession, mySessions } from '../helpers/organiser-hub';

/*
  Save as Draft across the Session Wizard (ORG-DRAFT-*).

  A draft is ONE session row: the first save creates it (status "draft"), every
  later save updates that same row, and it stays visible and editable in
  My Sessions until it is published. Nothing here sends mail or messages:
  saving a draft notifies nobody. Publishing is opt-in (ORG-DRAFT-007,
  E2E_ALLOW_PUBLISH_REVIEW=1) because an organiser's Publish messages every
  admin - same reason as ORG-WIZ-004.

  Every test registers its own organiser, so all rows are run-owned.
*/

test.use({ viewport: { width: 1440, height: 900 } });

const SAVED = 'Session saved as draft';

function dateInput(days: number): string {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function saveDraft(page: Page) {
  await page.getByTestId('organiser-wizard-save-draft-bottom').click();
  await expect(page.getByText(SAVED).first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/organiser\/sessions\/new\?draft=/);
}

const draftIdOf = (page: Page) => new URL(page.url()).searchParams.get('draft')!;

async function toStep2(page: Page) {
  await page.getByTestId('organiser-wizard-session-category-social-play').click();
  const chip = page.getByTestId('organiser-wizard-type-social');
  if (await chip.count()) await chip.click();
  await page.getByTestId('organiser-wizard-next-bottom').click();
  await expect(page.getByTestId('organiser-wizard-step2')).toBeVisible();
}

async function fillBasics(page: Page, title: string) {
  await page.getByTestId('organiser-wizard-session-name').fill(title);
  await page.getByTestId('organiser-wizard-session-venue').fill('Rushcutters Bay Tennis Centre');
  await page.getByTestId('organiser-wizard-date').fill(dateInput(21));
}

async function next(page: Page, step: number) {
  await page.getByTestId('organiser-wizard-next-bottom').click();
  await expect(page.getByTestId(`organiser-wizard-step${step}`)).toBeVisible();
}

test.describe('Session drafts', () => {
  test('ORG-DRAFT-001 Save as Draft works from every wizard step; the first save creates exactly one draft and later saves update it', async ({ page }) => {
    // ---------- Test data ----------
    await becomeOrganiser(page);
    const title = `Draft ${Date.now()}`;

    // ---------- Step 1: nothing chosen yet ----------
    await page.goto('/organiser/sessions/new');
    await expect(page.getByTestId('organiser-wizard-step1')).toBeVisible();
    await saveDraft(page);
    const id = draftIdOf(page);
    let mine = await mySessions(page);
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(id);
    expect(mine[0].status).toBe('draft');

    // ---------- Step 2: incomplete (name only) ----------
    await toStep2(page);
    await page.getByTestId('organiser-wizard-session-name').fill(title);
    await saveDraft(page);
    expect(draftIdOf(page)).toBe(id);
    expect((await getSession(page, id)).title).toBe(title);

    // ---------- Step 2: completed ----------
    await fillBasics(page, title);
    await saveDraft(page);

    // ---------- Step 3 ----------
    await next(page, 3);
    await page.getByTestId('organiser-wizard-rules-policies-expand').click();
    await page.getByTestId('organiser-wizard-rules-text').fill('Bring water');
    await saveDraft(page);
    expect((await getSession(page, id)).rulesText).toBe('Bring water');

    // ---------- Step 4 (review) ----------
    await next(page, 4);
    await saveDraft(page);

    // ---------- Final verification: still ONE session, same id, still a draft ----------
    mine = await mySessions(page);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id, status: 'draft', title });
  });

  test('ORG-DRAFT-002 A draft shows in My Sessions under All and Drafts, and survives a refresh with incomplete fields intact', async ({ page }) => {
    await becomeOrganiser(page);
    const title = `Visible ${Date.now()}`;

    await page.goto('/organiser/sessions/new');
    await toStep2(page);
    await page.getByTestId('organiser-wizard-session-name').fill(title); // venue + date left empty
    await saveDraft(page);
    const id = draftIdOf(page);

    // ---------- Refresh: same wizard, same values ----------
    await page.reload();
    await expect(page.getByTestId('organiser-wizard-step2')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('organiser-wizard-session-name')).toHaveValue(title);
    await expect(page.getByTestId('organiser-wizard-session-venue')).toHaveValue('');

    // ---------- My Sessions: All and Drafts ----------
    await page.goto('/organiser/sessions');
    await expect(page.getByTestId(`organiser-session-card-${id}-primary`)).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('organiser-sessions-status-tab-draft').click();
    await expect(page.getByTestId(`organiser-session-card-${id}-primary`)).toBeVisible();
    await expect(page.getByTestId(`organiser-session-card-${id}-primary`)).toContainText(/continue/i);
  });

  test('ORG-DRAFT-003 A draft can be reopened after logout and login, edited, and saved again without duplicates or data loss', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const title = `Relogin ${Date.now()}`;

    await page.goto('/organiser/sessions/new');
    await toStep2(page);
    await fillBasics(page, title);
    await next(page, 3);
    await page.getByTestId('organiser-wizard-rules-policies-expand').click();
    await page.getByTestId('organiser-wizard-rules-text').fill('Rules from day one');
    await saveDraft(page);
    const id = draftIdOf(page);

    // ---------- Logout / login ----------
    await logout(page);
    await login(page, organiser.email, organiser.password);

    // ---------- Reopen from the Drafts tab ----------
    await page.goto('/organiser/sessions');
    await page.getByTestId('organiser-sessions-status-tab-draft').click();
    await page.getByTestId(`organiser-session-card-${id}-primary`).click();
    await expect(page).toHaveURL(new RegExp(`/organiser/sessions/new\\?draft=${id}`));
    await expect(page.getByTestId('organiser-wizard-session-name')).toHaveValue(title, { timeout: 15_000 });

    // ---------- Edit on another step and save again ----------
    await next(page, 3);
    await page.getByTestId('organiser-wizard-rules-policies-expand').click();
    await expect(page.getByTestId('organiser-wizard-rules-text')).toHaveValue('Rules from day one');
    await page.getByTestId('organiser-wizard-refund-policy').fill('No refunds');
    await saveDraft(page);

    // ---------- Nothing lost, nothing duplicated ----------
    const mine = await mySessions(page);
    expect(mine).toHaveLength(1);
    const saved = await getSession(page, id);
    expect(saved).toMatchObject({ title, status: 'draft', rulesText: 'Rules from day one', refundPolicy: 'No refunds' });
  });

  test('ORG-DRAFT-004 A failed save shows an error, never the success message, and a retry then succeeds on the same draft', async ({ page }) => {
    await becomeOrganiser(page);
    const title = `Failing ${Date.now()}`;

    await page.goto('/organiser/sessions/new');
    await toStep2(page);
    await page.getByTestId('organiser-wizard-session-name').fill(title);

    // ---------- First save fails ----------
    const failing = async (route: import('@playwright/test').Route) => {
      if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) });
      } else await route.continue();
    };
    await page.route('**/api/organizer/sessions', failing);
    await page.getByTestId('organiser-wizard-save-draft-bottom').click();
    await expect(page.getByText(/couldn't save draft/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(SAVED)).toHaveCount(0);
    await expect(page).not.toHaveURL(/draft=/);
    expect(await mySessions(page)).toHaveLength(0);

    // ---------- Retry works ----------
    await page.unroute('**/api/organizer/sessions', failing);
    await saveDraft(page);
    const id = draftIdOf(page);

    // ---------- A failed UPDATE keeps the last good state ----------
    const failingPut = async (route: import('@playwright/test').Route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) });
      } else await route.continue();
    };
    await page.route(`**/api/organizer/sessions/${id}`, failingPut);
    await page.getByTestId('organiser-wizard-session-venue').fill('Never saved');
    await page.getByTestId('organiser-wizard-save-draft-bottom').click();
    await expect(page.getByText(/couldn't save draft/i).first()).toBeVisible({ timeout: 15_000 });
    await page.unroute(`**/api/organizer/sessions/${id}`, failingPut);
    expect((await getSession(page, id)).title).toBe(title);
    expect(await mySessions(page)).toHaveLength(1);
  });

  test('ORG-DRAFT-005 Saving over a newer version is refused with a conflict instead of silently overwriting it', async ({ page }) => {
    await becomeOrganiser(page);
    const title = `Stale ${Date.now()}`;

    await page.goto('/organiser/sessions/new');
    await toStep2(page);
    await page.getByTestId('organiser-wizard-session-name').fill(title);
    await saveDraft(page);
    const id = draftIdOf(page);

    // ---------- Another device saves the same draft ----------
    const res = await page.request.put(`/api/organizer/sessions/${id}`, { data: { location: 'Saved elsewhere' } });
    expect(res.ok()).toBeTruthy();

    // ---------- This tab still has the older version ----------
    await page.getByTestId('organiser-wizard-session-venue').fill('Stale tab edit');
    await page.getByTestId('organiser-wizard-save-draft-bottom').click();
    await expect(page.getByTestId('organiser-wizard-conflict')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(SAVED)).toHaveCount(0);
    expect(((await getSession(page, id)) as unknown as { location?: string | null }).location ?? '').not.toBe('Stale tab edit');
  });

  test('ORG-DRAFT-006 Publishing an incomplete draft is refused and the draft stays a draft', async ({ page }) => {
    await becomeOrganiser(page);
    await page.goto('/organiser/sessions/new');
    await toStep2(page);
    await page.getByTestId('organiser-wizard-session-name').fill(`Incomplete ${Date.now()}`);
    await saveDraft(page);
    const id = draftIdOf(page);

    // ---------- Server rule (does not message anyone: it refuses first) ----------
    const res = await page.request.post(`/api/organizer/sessions/${id}/publish`);
    expect(res.status()).toBe(400);
    expect((await res.json()).code).toBe('incomplete');
    expect((await getSession(page, id)).status).toBe('draft');
    expect(await mySessions(page)).toHaveLength(1);
  });

  test('ORG-DRAFT-007 Publishing a saved draft updates the same session (opt-in: messages every admin)', async ({ page }) => {
    test.skip(process.env.E2E_ALLOW_PUBLISH_REVIEW !== '1', 'Publish messages every admin; run cleanup refuses messages to admins outside the run. Opt in with E2E_ALLOW_PUBLISH_REVIEW=1.');
    await becomeOrganiser(page);
    const title = `Publish draft ${Date.now()}`;

    await page.goto('/organiser/sessions/new');
    await toStep2(page);
    await fillBasics(page, title);
    await saveDraft(page);
    const id = draftIdOf(page);

    await next(page, 3);
    await next(page, 4);
    await page.getByTestId('organiser-wizard-publish-bottom').click();
    await expect(page.getByTestId('organiser-wizard-pending-approval-dialog')).toBeVisible({ timeout: 15_000 });

    // ---------- Same row, no duplicate, no longer a draft ----------
    const mine = await mySessions(page);
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(id);
    expect(mine[0].status).toBe('pending_review');

    await page.goto('/organiser/sessions');
    await page.getByTestId('organiser-sessions-status-tab-draft').click();
    await expect(page.getByTestId(`organiser-session-card-${id}-primary`)).toHaveCount(0);
  });
});
