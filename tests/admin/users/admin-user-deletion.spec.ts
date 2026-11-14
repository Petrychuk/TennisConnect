import { test, expect, type Page } from '@playwright/test';
import {
  adminUsers,
  confirmBulkDelete,
  expectGuardClean,
  expectNoCollateral,
  grantOrganiser,
  guardDeletes,
  loginAsAdmin,
  openUsersTab,
  protectedOwner,
  requestOrganiserAccess,
  row,
  seedAccounts,
  selectRows,
} from '../../helpers/admin-users';
import { matchesAdminUserFilters, type AdminUserFilters } from '../../../client/src/lib/adminUserFilters';

/*
  ADMIN-DEL-001..012 - admin user deletion, single and bulk, under every
  Users-tab filter (role, organiser status, account status).

  Safety (docs/CLAUDE_PLAYWRIGHT_RULES.md): Staging / local only, never
  Production. Every account is created by this run (seed-players hook,
  e2e-run-<runId>-...@tennisconnect.test). guardDeletes() aborts any delete
  request naming an id this test didn't create, and expectNoCollateral()
  checks that nothing else left the list. Protected accounts (an organisation
  with a session) are never force-deleted; the run-scoped teardown removes
  them and their organisation afterwards. No test here deletes an organisation,
  and the header "select all" is only exercised with every delete blocked.

  Phase: hub-msg-admin (next to ADMIN-002..008).
*/

type Filters = AdminUserFilters;

async function setFilters(page: Page, filters: Partial<Filters>) {
  const organiserIds: Record<Filters['organizer'], string> = {
    all: 'users-filter-organizer-all',
    organizers: 'users-filter-organizer-approved',
    'not-organizers': 'users-filter-organizer-not-approved',
    awaiting: 'users-filter-organizer-awaiting',
  };
  if (filters.role) await page.getByTestId(`users-filter-role-${filters.role}`).click();
  if (filters.organizer) await page.getByTestId(organiserIds[filters.organizer]).click();
  if (filters.status) await page.getByTestId(`users-filter-status-${filters.status}`).click();
}

async function expectNoSelection(page: Page, label: string) {
  await expect(page.getByTestId('bulk-delete-bar'), `${label}: selection cleared`).toHaveCount(0);
}

const TOAST_LIST = '[role="region"][aria-label^="Notifications"]';

test.describe('Admin user deletion', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADMIN-DEL-001 Single delete: an ordinary player is deleted', async ({ page }) => {
    const [player] = await seedAccounts(page, 1);
    const before = await adminUsers(page);
    const guard = await guardDeletes(page, [player.id]);
    await openUsersTab(page);

    await row(page, player.id).getByTestId(`delete-user-${player.id}`).click();
    await expect(page.getByTestId('user-action-dialog')).toContainText('Permanently delete');
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/admin/users/${player.id}`) && r.request().method() === 'DELETE'),
      page.getByTestId('user-action-confirm').click(),
    ]);
    expect(response.status()).toBe(200);
    expect((await response.json()).deleted).toEqual([player.id]);

    await expect(row(page, player.id)).toHaveCount(0);
    await expect(page.locator(TOAST_LIST).getByText(/user deleted/i)).toBeVisible();
    expect((await adminUsers(page)).some((u) => u.id === player.id), 'gone from the API too').toBe(false);
    await expectNoCollateral(page, before, [player.id]);
    expectGuardClean(guard);
  });

  test('ADMIN-DEL-002 Single delete under the Coaches filter: an ordinary coach is deleted', async ({ page }) => {
    const [coach] = await seedAccounts(page, 1, { role: 'coach' });
    const before = await adminUsers(page);
    const guard = await guardDeletes(page, [coach.id]);
    await openUsersTab(page);
    await setFilters(page, { role: 'coach' });

    await row(page, coach.id).getByTestId(`delete-user-${coach.id}`).click();
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/admin/users/${coach.id}`) && r.request().method() === 'DELETE'),
      page.getByTestId('user-action-confirm').click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(row(page, coach.id)).toHaveCount(0);
    await expectNoCollateral(page, before, [coach.id]);
    expectGuardClean(guard);
  });

  test('ADMIN-DEL-003 Single delete: an account whose organisation has sessions is refused with the reason, nothing removed', async ({ page }) => {
    const { account, organization } = await protectedOwner(page);
    const guard = await guardDeletes(page, [account.id]);
    await openUsersTab(page);

    // Marked before anything is attempted.
    await expect(page.getByTestId(`user-protected-${account.id}`)).toBeVisible();
    await row(page, account.id).getByTestId(`delete-user-${account.id}`).click();
    await expect(page.getByTestId('user-action-dialog')).toContainText('is protected');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/admin/users/${account.id}`) && r.request().method() === 'DELETE'),
      page.getByTestId('user-action-confirm').click(),
    ]);
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('owns_organization_with_sessions');
    expect(body.organization).toEqual({ id: organization.id, name: organization.name });
    expect(body.sessionCount).toBe(1);

    // The reason and the way forward, inside the dialog - not a page-covering toast.
    await expect(page.getByTestId('user-delete-blocked-reason')).toContainText(organization.name);
    await expect(page.getByTestId('user-delete-blocked-delete-org')).toBeVisible();
    await expect(page.getByTestId('user-action-confirm')).toBeDisabled();
    await expect(page.locator(TOAST_LIST).getByText(/own an organization/i)).toHaveCount(0);

    // Nothing was removed: the account and its organisation are both still there.
    const listed = (await adminUsers(page)).find((u) => u.id === account.id);
    expect(listed?.ownedOrganization?.id).toBe(organization.id);
    expect(listed?.ownedOrganization?.sessionCount).toBe(1);
    expect(listed?.deletionBlock?.code).toBe('owns_organization_with_sessions');
    expectGuardClean(guard);
  });

  test('ADMIN-DEL-004 A former organiser who still owns an organisation with sessions has a way forward', async ({ page }) => {
    // The reported case: a test player (organiser access revoked) blocked with no action to take.
    const { account, organization } = await protectedOwner(page, { revokeAfter: true });
    await openUsersTab(page);
    await setFilters(page, { organizer: 'not-organizers' });

    await expect(row(page, account.id)).toBeVisible();
    await expect(page.getByTestId(`user-protected-${account.id}`)).toBeVisible();
    // Before the fix only current organisers got this button.
    await expect(row(page, account.id).getByTestId(`delete-organization-${organization.id}`)).toBeVisible();
  });

  test('ADMIN-DEL-005 Bulk delete under the Players filter deletes only the ticked players', async ({ page }) => {
    const players = await seedAccounts(page, 3);
    const [coach] = await seedAccounts(page, 1, { role: 'coach' });
    const before = await adminUsers(page);
    const guard = await guardDeletes(page, players.map((p) => p.id));
    await openUsersTab(page);
    await setFilters(page, { role: 'player' });

    await expect(row(page, coach.id), 'the coach is filtered out').toHaveCount(0);
    await selectRows(page, players.map((p) => p.id));
    await expect(page.getByTestId('bulk-delete-button')).toHaveText(/Delete Selected \(3\)/);

    const body = await confirmBulkDelete(page);
    expect([...body.deleted].sort()).toEqual(players.map((p) => p.id).sort());
    expect(body.failed).toEqual([]);
    expect(body.summary).toEqual({ requested: 3, deleted: 3, notDeleted: 0 });
    expect(guard.sentIds).toEqual([expect.arrayContaining(players.map((p) => p.id))]);

    await expect(page.getByTestId('bulk-delete-result-title')).toHaveText('3 users deleted');
    for (const p of players) await expect(row(page, p.id)).toHaveCount(0);
    await expectNoSelection(page, 'after delete');
    await setFilters(page, { role: 'all' });
    await expect(row(page, coach.id), 'the coach was not touched').toBeVisible();
    await expectNoCollateral(page, before, players.map((p) => p.id));
    expectGuardClean(guard);
  });

  test('ADMIN-DEL-006 Bulk delete under the Coaches filter deletes only the ticked coaches', async ({ page }) => {
    const coaches = await seedAccounts(page, 2, { role: 'coach' });
    const [player] = await seedAccounts(page, 1);
    const before = await adminUsers(page);
    const guard = await guardDeletes(page, coaches.map((c) => c.id));
    await openUsersTab(page);
    await setFilters(page, { role: 'coach' });

    await expect(row(page, player.id)).toHaveCount(0);
    await selectRows(page, coaches.map((c) => c.id));
    const body = await confirmBulkDelete(page);
    expect([...body.deleted].sort()).toEqual(coaches.map((c) => c.id).sort());
    expect(body.failed).toEqual([]);
    await expect(page.getByTestId('bulk-delete-result-title')).toHaveText('2 users deleted');

    const after = await adminUsers(page);
    expect(after.some((u) => u.id === player.id), 'the player was not touched').toBe(true);
    await expectNoCollateral(page, before, coaches.map((c) => c.id));
    expectGuardClean(guard);
  });

  test('ADMIN-DEL-007 Partial success: eligible accounts deleted, protected ones reported in a readable summary', async ({ page }) => {
    test.slow(); // two protected owners, each with an organisation and a session
    const plain = await seedAccounts(page, 3);
    const ownerA = await protectedOwner(page);
    const ownerB = await protectedOwner(page, { role: 'coach' });
    const protectedIds = [ownerA.account.id, ownerB.account.id];
    const selected = [...plain.map((p) => p.id), ...protectedIds];
    const before = await adminUsers(page);
    const guard = await guardDeletes(page, selected);
    await openUsersTab(page);

    await selectRows(page, selected);
    await expect(page.getByTestId('bulk-selected-count')).toContainText('5 users selected · 2 protected');
    await page.getByTestId('bulk-delete-button').click();
    await expect(page.getByTestId('bulk-delete-protected-note')).toContainText('2 of them are protected');
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/admin/users/bulk-delete')),
      page.getByTestId('bulk-delete-confirm').click(),
    ]);
    const body = await response.json();

    expect([...body.deleted].sort()).toEqual(plain.map((p) => p.id).sort());
    expect(body.failed.map((f: any) => f.id).sort()).toEqual([...protectedIds].sort());
    expect(body.failed.every((f: any) => f.code === 'owns_organization_with_sessions')).toBe(true);
    expect(body.summary).toEqual({ requested: 5, deleted: 3, notDeleted: 2 });

    // A short summary with the details grouped and scrollable, not a giant red toast.
    const panel = page.getByTestId('bulk-delete-result');
    await expect(page.getByTestId('bulk-delete-result-title')).toHaveText('3 deleted, 2 not deleted');
    await expect(page.getByTestId('bulk-delete-result-group-owns_organization_with_sessions')).toContainText('(2)');
    await expect(page.getByTestId(`bulk-delete-result-item-${ownerA.account.id}`)).toContainText(ownerA.organization.name);
    await expect(page.getByTestId(`bulk-delete-result-item-${ownerB.account.id}`)).toContainText(ownerB.organization.name);
    const box = (await panel.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.height, 'summary fits comfortably on screen').toBeLessThan(viewport.height * 0.7);
    await expect(page.locator(TOAST_LIST).locator('[data-state="open"]'), 'no toast covering the page').toHaveCount(0);

    for (const id of protectedIds) await expect(row(page, id), 'protected account kept').toBeVisible();
    for (const p of plain) await expect(row(page, p.id)).toHaveCount(0);
    await expectNoSelection(page, 'after delete');
    await expectNoCollateral(page, before, selected);
    expectGuardClean(guard);

    await page.getByTestId('bulk-delete-result-dismiss').click();
    await expect(panel).toHaveCount(0);
  });

  test('ADMIN-DEL-008 Organiser status filters: bulk delete under Awaiting Approval and Organisers Approved', async ({ page }) => {
    const [approved, awaiting, plain] = await seedAccounts(page, 3);
    await grantOrganiser(page, approved.id);
    await requestOrganiserAccess(awaiting);
    const before = await adminUsers(page);
    const guard = await guardDeletes(page, [approved.id, awaiting.id]);
    await openUsersTab(page);

    const visible = async (label: string, expected: Record<string, boolean>) => {
      for (const [id, shown] of Object.entries(expected)) await expect(row(page, id), `${label}: ${id}`).toHaveCount(shown ? 1 : 0);
    };
    await setFilters(page, { organizer: 'organizers' });
    await visible('Organisers Approved', { [approved.id]: true, [awaiting.id]: false, [plain.id]: false });
    await setFilters(page, { organizer: 'not-organizers' });
    await visible('Not Organisers', { [approved.id]: false, [awaiting.id]: true, [plain.id]: true });
    await setFilters(page, { organizer: 'awaiting' });
    await visible('Awaiting', { [approved.id]: false, [awaiting.id]: true, [plain.id]: false });

    await selectRows(page, [awaiting.id]);
    expect((await confirmBulkDelete(page)).deleted).toEqual([awaiting.id]);

    await setFilters(page, { organizer: 'organizers' });
    await selectRows(page, [approved.id]);
    // An organiser with no organisation isn't protected.
    expect((await confirmBulkDelete(page)).deleted).toEqual([approved.id]);

    await setFilters(page, { organizer: 'all' });
    await expect(row(page, plain.id)).toBeVisible();
    await expectNoCollateral(page, before, [approved.id, awaiting.id]);
    expectGuardClean(guard);
  });

  test('ADMIN-DEL-009 Account status filters: bulk delete under Players + Pending', async ({ page }) => {
    const [approvedPlayer] = await seedAccounts(page, 1, { approved: true });
    const [pendingPlayer] = await seedAccounts(page, 1, { approved: false });
    const [pendingCoach] = await seedAccounts(page, 1, { role: 'coach', approved: false });
    const before = await adminUsers(page);
    const guard = await guardDeletes(page, [pendingPlayer.id]);
    await openUsersTab(page);

    await setFilters(page, { status: 'pending' });
    await expect(row(page, pendingPlayer.id)).toBeVisible();
    await expect(row(page, pendingCoach.id)).toBeVisible();
    await expect(row(page, approvedPlayer.id)).toHaveCount(0);
    await setFilters(page, { status: 'approved' });
    await expect(row(page, approvedPlayer.id)).toBeVisible();
    await expect(row(page, pendingPlayer.id)).toHaveCount(0);

    await setFilters(page, { role: 'player', status: 'pending' });
    await expect(row(page, pendingCoach.id)).toHaveCount(0);
    await selectRows(page, [pendingPlayer.id]);
    expect((await confirmBulkDelete(page)).deleted).toEqual([pendingPlayer.id]);

    const after = new Set((await adminUsers(page)).map((u) => u.id));
    expect(after.has(pendingCoach.id) && after.has(approvedPlayer.id)).toBe(true);
    await expectNoCollateral(page, before, [pendingPlayer.id]);
    expectGuardClean(guard);
  });

  test('ADMIN-DEL-010 The selection only ever holds visible rows and is cleared by any filter change', async ({ page }) => {
    const [player] = await seedAccounts(page, 1);
    const [coach] = await seedAccounts(page, 1, { role: 'coach' });
    // Nothing may be deleted in this test, whatever is clicked.
    const guard = await guardDeletes(page, []);
    await openUsersTab(page);

    await selectRows(page, [player.id, coach.id]);
    await expect(page.getByTestId('bulk-delete-button')).toHaveText(/\(2\)/);
    await setFilters(page, { role: 'player' });
    await expectNoSelection(page, 'role filter');
    await expect(row(page, player.id).getByTestId(`select-user-${player.id}`)).not.toBeChecked();

    await selectRows(page, [player.id]);
    await setFilters(page, { status: 'approved' });
    await expectNoSelection(page, 'status filter');
    await selectRows(page, [player.id]);
    await setFilters(page, { organizer: 'not-organizers' });
    await expectNoSelection(page, 'organiser filter');
    await setFilters(page, { role: 'coach' });
    await selectRows(page, [coach.id]);
    await setFilters(page, { role: 'all' });
    await expectNoSelection(page, 'back to All');

    // "Select all" ticks exactly the visible, selectable rows of the current filters (never the admin).
    await setFilters(page, { role: 'coach', organizer: 'not-organizers', status: 'approved' });
    await page.getByTestId('select-all-users').check();
    const visibleBoxes = await page.locator('[data-testid^="select-user-"]').count();
    await expect(page.getByTestId('bulk-delete-button')).toHaveText(new RegExp(`\\(${visibleBoxes}\\)`));
    await page.getByTestId('clear-selected-users').click();
    await expectNoSelection(page, 'Clear');

    expect(guard.sentIds, 'no delete request was made').toEqual([]);
  });

  test('ADMIN-DEL-011 A double-clicked confirm sends one request; repeating it deletes nothing more', async ({ page }) => {
    const players = await seedAccounts(page, 2);
    const ids = players.map((p) => p.id);
    const before = await adminUsers(page);
    const guard = await guardDeletes(page, ids);
    await openUsersTab(page);

    await selectRows(page, ids);
    await page.getByTestId('bulk-delete-button').click();
    const responded = page.waitForResponse((r) => r.url().includes('/api/admin/users/bulk-delete'));
    await page.getByTestId('bulk-delete-confirm').dblclick();
    expect((await (await responded).json()).deleted.sort()).toEqual([...ids].sort());
    await expect(page.getByTestId('bulk-delete-result-title')).toHaveText('2 users deleted');
    expect(guard.sentIds, 'one request').toHaveLength(1);

    const again = await page.request.post('/api/admin/users/bulk-delete', { data: { ids } });
    const body = await again.json();
    expect(body.deleted).toEqual([]);
    expect(body.failed.map((f: any) => f.code)).toEqual(['not_found', 'not_found']);
    await expectNoCollateral(page, before, ids);
    expectGuardClean(guard);
  });

  test('ADMIN-DEL-012 Every filter combination shows exactly the matching accounts', async ({ page }) => {
    test.slow(); // 36 combinations
    const [approvedPlayer] = await seedAccounts(page, 1, { approved: true });
    const [pendingPlayer] = await seedAccounts(page, 1, { approved: false });
    const [approvedCoach] = await seedAccounts(page, 1, { role: 'coach', approved: true });
    const [pendingCoach] = await seedAccounts(page, 1, { role: 'coach', approved: false });
    await grantOrganiser(page, pendingCoach.id);
    await requestOrganiserAccess(approvedCoach);
    const guard = await guardDeletes(page, []);
    await openUsersTab(page);

    const listed = await adminUsers(page);
    const fixtures = [approvedPlayer, pendingPlayer, approvedCoach, pendingCoach].map((f) => listed.find((u) => u.id === f.id)!);
    for (const role of ['all', 'player', 'coach'] as const) {
      for (const organizer of ['all', 'organizers', 'not-organizers', 'awaiting'] as const) {
        for (const status of ['all', 'approved', 'pending'] as const) {
          const filters = { role, organizer, status };
          await setFilters(page, filters);
          for (const user of fixtures) {
            const expected = matchesAdminUserFilters(user, filters) ? 1 : 0;
            await expect(row(page, user.id), `${role}/${organizer}/${status}: ${user.email}`).toHaveCount(expected);
          }
        }
      }
    }
    expect(guard.sentIds).toEqual([]);
  });
});
