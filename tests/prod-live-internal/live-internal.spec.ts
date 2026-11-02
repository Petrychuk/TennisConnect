import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/prod-live-internal';
import { login, logout } from '../helpers/auth';

/*
  INTERNAL PRODUCTION VALIDATION OF TC LIVE v1 - @prod-live-internal.

  Runs ONLY as: TEST_ENV=production, E2E_PROD_SUITE=prod-live-internal,
  E2E_CONFIRM_PROD_LIVE_INTERNAL=<session id>, after Staging validation and
  explicit approval (docs/live/LIVE_RELEASE_CHECKLIST.md). Everywhere else
  every test here is skipped by the fixture.

  Prepared by the operator (docs/live/LIVE_RUNBOOK.md): an internal
  organiser and internal players (TC_INTERNAL_TEST_EMAILS on Production),
  one PUBLISHED internal session (E2E_PROD_LIVE_SESSION_ID) with courts,
  a match format, and the internal players registered. The suite never
  creates, deletes or touches anything else; the session ends Completed
  and stays (invisible) as history. A new run needs a new session.
*/

const SESSION = () => (process.env.E2E_PROD_LIVE_SESSION_ID ?? '').trim();
const PLAYER_SLUGS = () => new Set((process.env.E2E_PROD_LIVE_PLAYER_SLUGS ?? '').split(',').map((s) => s.trim()).filter(Boolean));

async function signInOrganiser(page: Page) {
  await login(page, process.env.E2E_PROD_LIVE_ORGANISER_EMAIL!, process.env.E2E_PROD_LIVE_ORGANISER_PASSWORD!, { ui: true });
}

/** The session is an internal test session and only allowlisted internal players are in it - or the run stops. */
async function assertInternalSession(page: Page) {
  const res = await page.request.get(`/api/organizer/sessions/${SESSION()}`);
  expect(res.ok(), 'the internal organiser owns the session').toBeTruthy();
  const session = await res.json();
  expect(session.isInternalTest, 'server-side internal marker').toBe(true);
  const regs = (await (await page.request.get(`/api/organizer/sessions/${SESSION()}/registrations`)).json()) as { userSlug: string; status: string }[];
  const allowed = PLAYER_SLUGS();
  const strangers = regs.filter((r) => r.status !== 'cancelled' && !allowed.has(r.userSlug)).map((r) => r.userSlug);
  expect(strangers, 'only allowlisted internal players are registered').toEqual([]);
  return session as { id: string; status: string; organizationId: string };
}

async function assertInvisibleToPublic(page: Page) {
  const ctx = await page.context().browser()!.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const guest = ctx.request;
    const list = await (await guest.get('/api/play/sessions')).json();
    expect((list.sessions ?? []).map((s: { id: string }) => s.id)).not.toContain(SESSION());
    expect((await guest.get(`/api/play/sessions/${SESSION()}`)).status()).toBe(404);
    const week = await (await guest.get('/api/organizer/sessions/this-week')).json();
    expect((week ?? []).map((s: { id: string }) => s.id)).not.toContain(SESSION());
  } finally {
    await ctx.close();
  }
  // The organiser's public organisation page doesn't list it either.
  const org = await (await page.request.get('/api/organizer/organizations/me')).json();
  if (org?.slug) {
    const pub = await (await page.request.get(`/api/organizer/organizations/${org.slug}`)).json();
    expect((pub.upcomingSessions ?? []).map((s: { id: string }) => s.id)).not.toContain(SESSION());
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('TC Live - internal Production validation', () => {
  test('@prod-live-internal LIVE-PROD-001 The internal session is internal-only and invisible to the public', async ({ page }) => {
    await signInOrganiser(page);
    await assertInternalSession(page);
    await assertInvisibleToPublic(page);
    await logout(page);
  });

  test('@prod-live-internal LIVE-PROD-002 Check in, go live, play a round, score, leaderboard, finish', async ({ page }) => {
    test.setTimeout(240_000);
    await signInOrganiser(page);
    let session = await assertInternalSession(page);
    test.skip(session.status === 'completed', 'This internal session is already completed - prepare a new one (LIVE_RUNBOOK.md).');

    await page.goto(`/organiser/sessions/${SESSION()}/live`);
    await expect(page.getByTestId('organiser-session-live')).toHaveAttribute('data-live-allowed', 'true', { timeout: 20_000 });

    if (session.status === 'published') {
      // Check in every registered internal player through the UI.
      const buttons = page.locator('[data-testid^="organiser-session-live-checkin-row-"][data-testid$="-button"]');
      for (let left = await buttons.count(); left > 0; left--) {
        await buttons.first().click();
        await expect.poll(() => buttons.count(), { timeout: 15_000 }).toBe(left - 1);
      }
      await page.getByTestId('organiser-session-live-go-live').click();
      await expect(page.getByTestId('organiser-session-live-badge')).toHaveText(/LIVE/, { timeout: 15_000 });
    }

    // Round: start one if none is open, then score every unscored match.
    const generate = page.getByTestId('organiser-session-live-generate-round');
    if (await generate.isVisible().catch(() => false)) await generate.click();
    await expect(page.getByTestId('organiser-session-live-courts')).toBeVisible({ timeout: 15_000 });
    const current = await (await page.request.get(`/api/organizer/sessions/${SESSION()}/rounds/current`)).json();
    for (const [i, match] of (current?.matches ?? []).entries()) {
      if (match.status === 'confirmed') continue;
      await page.getByTestId(`organiser-session-live-match-${match.id}-score-a`).fill(String(6));
      await page.getByTestId(`organiser-session-live-match-${match.id}-score-b`).fill(String(i % 6));
      await page.getByTestId(`organiser-session-live-match-${match.id}-save-score`).click();
      await expect(page.getByTestId(`organiser-session-live-match-${match.id}`)).toHaveAttribute('data-status', 'confirmed', { timeout: 15_000 });
    }

    // Leaderboard reflects the scores.
    const board = await (await page.request.get(`/api/organizer/sessions/${SESSION()}/leaderboard`)).json();
    expect(board.some((row: { wins: number }) => row.wins > 0)).toBe(true);

    // Finish through the dialog.
    await page.getByTestId('organiser-session-live-finish').click();
    await page.getByTestId('organiser-session-live-finish-confirm').click();
    await expect(page.getByTestId('organiser-session-live-badge')).toHaveText(/COMPLETED/, { timeout: 15_000 });
    session = await assertInternalSession(page);
    expect(session.status).toBe('completed');

    // History stays readable and still invisible to the public.
    expect(((await (await page.request.get(`/api/organizer/sessions/${SESSION()}/rounds`)).json()) as unknown[]).length).toBeGreaterThan(0);
    await assertInvisibleToPublic(page);
  });
});
