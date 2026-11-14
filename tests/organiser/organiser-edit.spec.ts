import { test, expect, type Page } from '@playwright/test';
import { becomeOrganiser } from '../helpers/organiser';
import { getSession, inDays, seedHubSession } from '../helpers/organiser-hub';

/*
  Edit Session page body (ORG-EDIT-*): three compact sections - Session
  Details, Registration, Session Information - with Rules & policies collapsed.

  Staging / local only (phase hub-msg-admin). One run-owned organiser and one
  seeded session per test. Editing a published session sends nothing to anyone
  while the time and date are unchanged (reschedule notices go to registered
  players only, and a fresh session has none). Values are read back from the
  API, not from the form.
*/

test.use({ viewport: { width: 1440, height: 900 } });

type Row = Record<string, unknown>;
const field = (page: Page, id: string) => page.getByTestId(`organiser-session-edit-${id}`);
const save = (page: Page) => field(page, 'save').click();

async function seeded(page: Page, extra: Row = {}) {
  const organiser = await becomeOrganiser(page);
  const title = `Edit page ${Date.now()}`;
  const session = await seedHubSession(
    page,
    organiser,
    { title, startAt: inDays(10), status: 'published', type: 'social' },
    { location: 'Cahill Tennis Park', courtsCount: 2, maxParticipants: 8, price: 80, waitingListEnabled: true, ...extra },
  );
  await page.goto(`/organiser/sessions/${session.id}/edit`);
  await expect(field(page, 'title')).toHaveValue(title, { timeout: 15_000 });
  return { id: session.id, title };
}

const apiRow = async (page: Page, id: string) => (await getSession(page, id)) as unknown as Row;

test.describe('Edit Session', () => {
  test('ORG-EDIT-001 Existing values are prefilled in three compact sections; venue/timezone and date/time/courts share a row on desktop', async ({ page }) => {
    // ---------- Test data + open ----------
    const { title } = await seeded(page);

    // ---------- Prefill ----------
    await expect(field(page, 'venue')).toHaveValue('Cahill Tennis Park');
    await expect(field(page, 'courts')).toHaveValue('2');
    await expect(field(page, 'max-players')).toHaveValue('8');
    await expect(field(page, 'price')).toHaveValue('80');
    await expect(field(page, 'waiting-list')).toBeChecked();
    await expect(page.getByRole('heading', { name: 'Edit Session' })).toBeVisible();
    await expect(page.getByTestId('organiser-session-edit-back')).toContainText(`Back to ${title}`);

    // ---------- Three sections, one row each where there is room ----------
    for (const s of ['details', 'registration', 'information']) await expect(page.getByTestId(`organiser-session-edit-section-${s}`)).toBeVisible();
    const top = async (id: string) => Math.round((await field(page, id).boundingBox())!.y);
    expect(await top('venue')).toBe(await top('timezone'));
    const row = await Promise.all(['date', 'start-time', 'end-time', 'courts'].map(top));
    expect(new Set(row).size).toBe(1);
    expect(await top('registration-closes')).toBe(await top('max-players'));

    // ---------- Readable width, not stretched across the viewport ----------
    const box = (await page.getByTestId('organiser-session-edit-section-details').boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(840);
    expect(box.width).toBeGreaterThanOrEqual(700);
  });

  test('ORG-EDIT-002 Edited details persist after reload; the Back link and Cancel leave nothing changed', async ({ page }) => {
    const { id, title } = await seeded(page);

    // ---------- Cancel after editing saves nothing ----------
    await field(page, 'title').fill('Never saved');
    await field(page, 'cancel').click();
    await expect(page).toHaveURL(new RegExp(`/organiser/sessions/${id}$`), { timeout: 15_000 });
    expect((await apiRow(page, id)).title).toBe(title);

    // ---------- Edit and save ----------
    await page.goto(`/organiser/sessions/${id}/edit`);
    await field(page, 'title').fill(`${title} v2`);
    await field(page, 'venue').fill('Rushcutters Bay Tennis Centre');
    await field(page, 'courts').fill('3');
    await field(page, 'max-players').fill('12');
    await save(page);
    await expect(page).toHaveURL(new RegExp(`/organiser/sessions/${id}$`), { timeout: 15_000 });

    // ---------- Reload: API and form agree ----------
    const saved = await apiRow(page, id);
    expect(saved).toMatchObject({ title: `${title} v2`, location: 'Rushcutters Bay Tennis Centre', courtsCount: 3, maxParticipants: 12 });
    await page.goto(`/organiser/sessions/${id}/edit`);
    await expect(field(page, 'venue')).toHaveValue('Rushcutters Bay Tennis Centre', { timeout: 15_000 });
  });

  test('ORG-EDIT-003 Price shows only for Paid: Paid to Free hides it and saves a free session; Free to Paid needs a price', async ({ page }) => {
    const { id } = await seeded(page);

    // ---------- Paid -> Free ----------
    await expect(field(page, 'price')).toBeVisible();
    await field(page, 'pricing-free').click();
    await expect(field(page, 'price')).toHaveCount(0);
    await save(page);
    await expect(page).toHaveURL(new RegExp(`/organiser/sessions/${id}$`), { timeout: 15_000 });
    expect(Number((await apiRow(page, id)).price ?? 0)).toBe(0);

    // ---------- Free -> Paid: no price, no save ----------
    await page.goto(`/organiser/sessions/${id}/edit`);
    await expect(field(page, 'title')).not.toHaveValue('', { timeout: 15_000 });
    await expect(field(page, 'price')).toHaveCount(0);
    await field(page, 'pricing-paid').click();
    await expect(field(page, 'price')).toBeVisible();
    await field(page, 'price').fill('0');
    await save(page);
    await expect(page.getByText('Enter a price above $0, or choose Free.')).toBeVisible();
    await expect(page).toHaveURL(/\/edit$/);
    expect(Number((await apiRow(page, id)).price ?? 0)).toBe(0);

    // ---------- With a price it saves ----------
    await field(page, 'price').fill('45');
    await save(page);
    await expect(page).toHaveURL(new RegExp(`/organiser/sessions/${id}$`), { timeout: 15_000 });
    expect(Number((await apiRow(page, id)).price)).toBe(45);
  });

  test('ORG-EDIT-004 Waiting List stays editable and persists', async ({ page }) => {
    const { id } = await seeded(page);
    await field(page, 'waiting-list').click();
    await expect(field(page, 'waiting-list')).not.toBeChecked();
    await save(page);
    await expect(page).toHaveURL(new RegExp(`/organiser/sessions/${id}$`), { timeout: 15_000 });
    expect((await apiRow(page, id)).waitingListEnabled).toBe(false);
  });

  test('ORG-EDIT-005 Rules & policies start collapsed; collapsing keeps what was typed; each policy saves', async ({ page }) => {
    const { id } = await seeded(page, { rulesText: 'Bring a racquet' });

    // ---------- Collapsed by default, says it is configured ----------
    await expect(field(page, 'policy-rules')).toHaveCount(0);
    await expect(page.getByTestId('organiser-session-edit-policies-status')).toHaveText('Configured');

    // ---------- Expand: all four fields ----------
    await page.getByTestId('organiser-session-edit-policies-toggle').click();
    for (const k of ['rules', 'refund', 'lateArrival', 'cancellation']) await expect(field(page, `policy-${k}`)).toBeVisible();
    await expect(field(page, 'policy-rules')).toHaveValue('Bring a racquet');

    // ---------- Type, collapse, expand: nothing lost ----------
    await field(page, 'policy-refund').fill('Refund up to 24h before');
    await field(page, 'policy-lateArrival').fill('15 minutes, then the waiting list');
    await field(page, 'policy-cancellation').fill('Cancel from My Sessions');
    await page.getByTestId('organiser-session-edit-policies-toggle').click();
    await expect(field(page, 'policy-refund')).toHaveCount(0);
    await page.getByTestId('organiser-session-edit-policies-toggle').click();
    await expect(field(page, 'policy-refund')).toHaveValue('Refund up to 24h before');
    await expect(field(page, 'policy-lateArrival')).toHaveValue('15 minutes, then the waiting list');

    // ---------- Collapsed at save time: still saved ----------
    await page.getByTestId('organiser-session-edit-policies-toggle').click();
    await save(page);
    await expect(page).toHaveURL(new RegExp(`/organiser/sessions/${id}$`), { timeout: 15_000 });
    expect(await apiRow(page, id)).toMatchObject({
      rulesText: 'Bring a racquet',
      refundPolicy: 'Refund up to 24h before',
      latePolicy: '15 minutes, then the waiting list',
      cancellationPolicy: 'Cancel from My Sessions',
    });
  });

  test('ORG-EDIT-006 A missing required field blocks the save with an inline error', async ({ page }) => {
    const { id, title } = await seeded(page);
    await field(page, 'title').fill('');
    await field(page, 'venue').fill('');
    await save(page);
    await expect(page.getByText('Enter a session name.')).toBeVisible();
    await expect(page.getByText('Enter a venue.')).toBeVisible();
    await expect(page).toHaveURL(/\/edit$/);
    const row = await apiRow(page, id);
    expect(row.title).toBe(title);
    expect(row.location).toBe('Cahill Tennis Park');

    // ---------- Registration cannot close after the session date ----------
    await field(page, 'title').fill(title);
    await field(page, 'venue').fill('Cahill Tennis Park');
    const date = await field(page, 'date').inputValue();
    const later = new Date(`${date}T00:00:00`);
    later.setDate(later.getDate() + 2);
    const iso = `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, '0')}-${String(later.getDate()).padStart(2, '0')}`;
    await field(page, 'registration-closes').evaluate((el, v) => {
      const input = el as HTMLInputElement;
      input.removeAttribute('max');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, iso);
    await expect(page.getByText("Registration can't close after the session date.").first()).toBeVisible();
    await save(page);
    await expect(page).toHaveURL(/\/edit$/);
  });

  test('ORG-EDIT-007 Phone: no horizontal scroll, Start and End share a row, Save is visible', async ({ page }) => {
    await seeded(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const scrollOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(scrollOverflow).toBeLessThanOrEqual(0);
    const y = async (id: string) => Math.round((await field(page, id).boundingBox())!.y);
    expect(await y('start-time')).toBe(await y('end-time'));
    expect(await y('venue')).not.toBe(await y('timezone'));
    await field(page, 'save').scrollIntoViewIfNeeded();
    await expect(field(page, 'save')).toBeInViewport();
    // A 20 px switch is operated through its label row (the label fills it): measure that.
    const tall = await page.evaluate(() => Array.from(
      document.querySelectorAll('[data-testid^=organiser-session-edit-]')
    ).filter((e) => e.matches('input, button[role=switch]')).filter((e) => {
      const target = e.matches('button[role=switch]') ? document.querySelector(`label[for="${e.id}"]`) ?? e : e;
      return target.getBoundingClientRect().height < 36;
    }).length);
    expect(tall).toBe(0);
  });
});
