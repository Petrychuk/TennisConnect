import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import { login } from './auth';
import { seedPlayers, seedSession, type SeededPlayer } from './organiser';
import { TEST_USERS } from '../fixtures/test-users';
import { expectRunOwned } from '../fixtures/run-id';

/*
  Helpers for the admin user-deletion suite (tests/admin/users/admin-user-deletion.spec.ts).

  Every account here is disposable and run-owned (seed-players hook ->
  e2e-run-<runId>-...@tennisconnect.test). guardDeletes() is the safety net:
  while it's active, a DELETE /api/admin/users/:id or a bulk-delete request
  that names any id outside the allowed set is aborted before it leaves the
  browser, and the test fails - so neither a filter bug nor a "select all"
  can ever delete someone else's account.
*/

export interface AdminAccount extends SeededPlayer {
  role: 'player' | 'coach';
}

export async function seedAccounts(page: Page, count: number, options: { role?: 'player' | 'coach'; approved?: boolean } = {}): Promise<AdminAccount[]> {
  const accounts = await seedPlayers(page, count, options);
  expectRunOwned(...accounts.map((a) => a.email));
  return accounts.map((a) => ({ ...a, role: options.role ?? 'player' }));
}

export async function loginAsAdmin(page: Page) {
  await login(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
}

/** The admin Users tab, freshly loaded. */
export async function openUsersTab(page: Page) {
  await page.goto('/admin');
  await page.getByTestId('organiser-sidebar-nav-admin-users').click();
  await expect(page.getByTestId('admin-users-tab')).toBeVisible({ timeout: 15000 });
}

export const row = (page: Page, id: string) => page.getByTestId(`user-row-${id}`);

/** GET /api/admin/users as the signed-in admin. */
export async function adminUsers(page: Page): Promise<any[]> {
  const res = await page.request.get('/api/admin/users');
  expect(res.ok(), 'GET /api/admin/users').toBeTruthy();
  return res.json();
}

/** A separate API session signed in as a seeded account (its own cookies). */
export async function signedInAs(account: SeededPlayer): Promise<APIRequestContext> {
  const ctx = await playwrightRequest.newContext({ baseURL: test.info().project.use.baseURL });
  const res = await ctx.post('/api/auth/login', { data: { email: account.email, password: account.password } });
  expect(res.ok(), `login as ${account.email}`).toBeTruthy();
  return ctx;
}

export async function grantOrganiser(page: Page, userId: string) {
  const res = await page.request.patch(`/api/admin/users/${userId}/grant-organizer`);
  expect(res.ok(), 'grant organiser').toBeTruthy();
}

export async function revokeOrganiser(page: Page, userId: string) {
  const res = await page.request.patch(`/api/admin/users/${userId}/revoke-organizer`);
  expect(res.ok(), 'revoke organiser').toBeTruthy();
}

/**
 * A run-owned account that owns an organisation with one session - the case the
 * rules protect. The admin (page) grants organiser access; the account creates
 * its organisation through the real API; the session comes from the seed hook.
 */
export async function protectedOwner(page: Page, options: { role?: 'player' | 'coach'; revokeAfter?: boolean } = {}) {
  const [account] = await seedAccounts(page, 1, { role: options.role });
  await grantOrganiser(page, account.id);
  const ctx = await signedInAs(account);
  try {
    const org = await ctx.post('/api/organizer/organizations', { data: { name: `Deletion Test Org ${Date.now()}` } });
    expect(org.ok(), 'create organisation').toBeTruthy();
    const organization = await org.json();
    await seedSession(page, {
      organizationId: organization.id,
      createdBy: account.id,
      title: `Deletion Test Session ${Date.now()}`,
      startAt: new Date(Date.now() + 7 * 864e5).toISOString(),
      status: 'published',
    });
    if (options.revokeAfter) await revokeOrganiser(page, account.id);
    return { account, organization: organization as { id: string; name: string } };
  } finally {
    await ctx.dispose();
  }
}

/** The account asks for organiser access (shows as "Awaiting Organiser Approval"). */
export async function requestOrganiserAccess(account: SeededPlayer) {
  const ctx = await signedInAs(account);
  try {
    const res = await ctx.post('/api/organizer/requests', { data: {} });
    expect(res.status(), 'organiser request').toBe(201);
  } finally {
    await ctx.dispose();
  }
}

export interface DeleteGuard {
  /** Every id the page actually asked to delete, in order. */
  sentIds: string[][];
  refused: string[];
}

/** Aborts any admin delete request that names an id outside `allowed`. */
export async function guardDeletes(page: Page, allowed: Iterable<string>): Promise<DeleteGuard> {
  const allowedSet = new Set(allowed);
  const guard: DeleteGuard = { sentIds: [], refused: [] };
  await page.route('**/api/admin/users/bulk-delete', async (route) => {
    const ids: string[] = route.request().postDataJSON()?.ids ?? [];
    guard.sentIds.push(ids);
    const outside = ids.filter((id) => !allowedSet.has(id));
    if (outside.length > 0) {
      guard.refused.push(...outside);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  await page.route(/\/api\/admin\/users\/[^/]+$/, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
    guard.sentIds.push([id]);
    if (!allowedSet.has(id)) {
      guard.refused.push(id);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  return guard;
}

export function expectGuardClean(guard: DeleteGuard) {
  expect(guard.refused, 'delete requests for accounts outside this test').toEqual([]);
}

/** Every account that was listed before and not asked to be deleted is still listed. */
export async function expectNoCollateral(page: Page, before: any[], requestedIds: string[]) {
  const requested = new Set(requestedIds);
  const after = new Set((await adminUsers(page)).map((u) => u.id));
  const missing = before.filter((u) => !requested.has(u.id) && !after.has(u.id)).map((u) => u.email);
  expect(missing, 'accounts that disappeared without being selected').toEqual([]);
}

export async function selectRows(page: Page, ids: string[]) {
  for (const id of ids) await row(page, id).getByTestId(`select-user-${id}`).check();
}

/** Confirms the bulk dialog and returns the response body. */
export async function confirmBulkDelete(page: Page) {
  await page.getByTestId('bulk-delete-button').click();
  await expect(page.getByTestId('bulk-delete-dialog')).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/admin/users/bulk-delete') && r.request().method() === 'POST'),
    page.getByTestId('bulk-delete-confirm').click(),
  ]);
  expect(response.status(), 'bulk-delete status').toBe(200);
  return response.json();
}
