import { test, expect, type Page } from '@playwright/test';
import { becomeOrganiser, seedPlayers } from '../helpers/organiser';
import { inDays, openWorkspaceTab, seedHubSession, sessionRegistrations } from '../helpers/organiser-hub';

/*
  Session Workspace - Players tab, state changes (automation gap report, P0).
  Check-in, remove and move-to-waiting-list, each checked against the API
  state it should leave behind (GET /sessions/:id/registrations).

  Test plan
  - Risk: wrong registration changed, check-in not persisted, removal
    without confirmation, waitlisted player still offered check-in.
  - Fixtures: run-owned organiser (becomeOrganiser), run-owned players
    (seedPlayers), one seeded published session per test (inDays(3)).
  - Writes: registration status / checkedInAt on that session only. No
    emails, no messages, no payments.
  - Cleanup: run-scoped teardown (E2E_CLEANUP_ON_TEARDOWN) removes the
    organiser, players and sessions.
  - Assertions: UI state AND the API row; no retries or timeouts raised to
    get green.
  - Run: npm run test:e2e -- tests/organiser/organiser-workspace-players.spec.ts
    (local). Staging only through the phase runner (hub-msg-admin), with
    E2E_CONFIRM_WRITES set as documented in docs/ci-staging-e2e.md.

  Staging / local only (phase hub-msg-admin).
*/

test.use({ viewport: { width: 1440, height: 900 } });

type Registration = { id: string; userId: string; status: string; checkedInAt: string | null };

async function registrationOf(page: Page, sessionId: string, registrationId: string): Promise<Registration> {
  const rows = (await sessionRegistrations(page, sessionId)) as Registration[];
  const row = rows.find((r) => r.id === registrationId);
  expect(row, `registration ${registrationId} exists`).toBeTruthy();
  return row!;
}

async function openRowMenu(page: Page, registrationId: string) {
  await page.getByTestId(`organiser-players-row-${registrationId}-menu`).click();
}

test.describe('Session Workspace - players', () => {
  test('@smoke ORG-WSP-001 Check in a registered player: the button goes, the API records the check-in', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [player] = await seedPlayers(page, 1);
    const session = await seedHubSession(page, organiser, {
      title: `Check in ${Date.now()}`,
      startAt: inDays(3),
      status: 'published',
      type: 'social',
      registrations: [{ userId: player.id }],
    });
    const registrationId = session.registrationIds[0];

    await openWorkspaceTab(page, session.id, 'players');
    const checkIn = page.getByTestId(`organiser-players-row-${registrationId}-checkin`);
    await expect(checkIn).toBeVisible({ timeout: 15_000 });
    expect((await registrationOf(page, session.id, registrationId)).checkedInAt).toBeNull();

    await checkIn.click();
    await expect(checkIn).toBeHidden({ timeout: 15_000 });
    expect((await registrationOf(page, session.id, registrationId)).checkedInAt).toBeTruthy();
  });

  test('ORG-WSP-002 Check-in is idempotent: a second check-in leaves the first timestamp and the status alone', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [player] = await seedPlayers(page, 1);
    const session = await seedHubSession(page, organiser, {
      title: `Idempotent ${Date.now()}`,
      startAt: inDays(3),
      status: 'published',
      type: 'social',
      registrations: [{ userId: player.id }],
    });
    const registrationId = session.registrationIds[0];
    const url = `/api/organizer/sessions/${session.id}/checkin/${registrationId}`;

    const first = await page.request.post(url);
    expect(first.ok(), `first check-in: ${first.status()}`).toBeTruthy();
    const afterFirst = await registrationOf(page, session.id, registrationId);
    expect(afterFirst.checkedInAt).toBeTruthy();

    const second = await page.request.post(url, { failOnStatusCode: false });
    expect(second.ok(), `second check-in answered ${second.status()}`).toBeTruthy();
    const afterSecond = await registrationOf(page, session.id, registrationId);
    expect(afterSecond.checkedInAt).toBe(afterFirst.checkedInAt);
    expect(afterSecond.status).toBe('registered');
  });

  test('ORG-WSP-003 Check in all: every registered player on the session is checked in', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const players = await seedPlayers(page, 3);
    const session = await seedHubSession(page, organiser, {
      title: `Check in all ${Date.now()}`,
      startAt: inDays(3),
      status: 'published',
      type: 'social',
      registrations: players.map((p) => ({ userId: p.id })),
    });

    await openWorkspaceTab(page, session.id, 'players');
    await page.getByTestId('organiser-players-checkin-all').click();

    await expect
      .poll(async () => (await sessionRegistrations(page, session.id)).every((r) => r.checkedInAt), { timeout: 15_000 })
      .toBe(true);
    for (const registrationId of session.registrationIds) {
      await expect(page.getByTestId(`organiser-players-row-${registrationId}-checkin`)).toHaveCount(0);
    }
  });

  test('ORG-WSP-004 Remove asks first: Keep leaves the player registered', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [player] = await seedPlayers(page, 1);
    const session = await seedHubSession(page, organiser, {
      title: `Keep ${Date.now()}`,
      startAt: inDays(3),
      status: 'published',
      type: 'social',
      registrations: [{ userId: player.id }],
    });
    const registrationId = session.registrationIds[0];

    await openWorkspaceTab(page, session.id, 'players');
    await openRowMenu(page, registrationId);
    await page.getByTestId(`organiser-players-row-${registrationId}-remove`).click();
    await expect(page.getByTestId('organiser-players-remove-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Keep' }).click();
    await expect(page.getByTestId('organiser-players-remove-dialog')).toBeHidden();

    expect((await registrationOf(page, session.id, registrationId)).status).toBe('registered');
  });

  test('@smoke ORG-WSP-005 Remove confirmed: the registration is cancelled and the player leaves the list', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [player] = await seedPlayers(page, 1);
    const session = await seedHubSession(page, organiser, {
      title: `Remove ${Date.now()}`,
      startAt: inDays(3),
      status: 'published',
      type: 'social',
      registrations: [{ userId: player.id }],
    });
    const registrationId = session.registrationIds[0];

    await openWorkspaceTab(page, session.id, 'players');
    await openRowMenu(page, registrationId);
    await page.getByTestId(`organiser-players-row-${registrationId}-remove`).click();
    await page.getByTestId('organiser-players-remove-confirm').click();

    await expect(page.getByText('Player removed').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`organiser-players-row-${registrationId}`)).toHaveCount(0);
    expect((await registrationOf(page, session.id, registrationId)).status).toBe('cancelled');
  });

  test('ORG-WSP-006 Move to the waiting list: status becomes waitlisted and check-in is no longer offered', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [player] = await seedPlayers(page, 1);
    const session = await seedHubSession(page, organiser, {
      title: `Waitlist ${Date.now()}`,
      startAt: inDays(3),
      status: 'published',
      type: 'social',
      registrations: [{ userId: player.id }],
    });
    const registrationId = session.registrationIds[0];

    await openWorkspaceTab(page, session.id, 'players');
    await openRowMenu(page, registrationId);
    await page.getByTestId(`organiser-players-row-${registrationId}-move-to-waiting`).click();

    await expect(page.getByText('Moved to the waiting list').first()).toBeVisible({ timeout: 15_000 });
    expect((await registrationOf(page, session.id, registrationId)).status).toBe('waitlisted');
    // Check-in is offered only to a registered player.
    await expect(page.getByTestId(`organiser-players-row-${registrationId}-checkin`)).toHaveCount(0);
  });
});
