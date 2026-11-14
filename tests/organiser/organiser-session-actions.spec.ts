import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { becomeOrganiser, seedPlayers } from '../helpers/organiser';
import { getSession, inDays, openMoreMenu, openWorkspaceTab, seedHubSession, sessionRegistrations, updateSession } from '../helpers/organiser-hub';

/*
  Session Workspace actions (Organiser Hub Phase 2). Every action is checked
  through the API state it should leave behind; the negative cases check
  that the action is neither offered nor accepted.

  Edit and Duplicate: organiser-wizard.spec.ts (ORG-WIZ-003). Publish:
  ORG-WIZ-004 (opt-in - it messages every admin).

  Staging / local only (phase hub-msg-admin). Run-owned organiser, players
  and sessions. Cancel, invite and announcements send in-app messages to
  run-owned players only. Nothing is emailed.
*/

test.use({ viewport: { width: 1440, height: 900 } });

async function menuItems(page: Page): Promise<string[]> {
  await openMoreMenu(page);
  await expect(page.getByRole('menu')).toBeVisible();
  const ids = await page.locator('[data-testid^="organiser-session-more-"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-testid')!.replace('organiser-session-more-', '')).filter((id) => id !== 'button'),
  );
  await page.keyboard.press('Escape');
  return ids;
}

test.describe('Session actions', () => {
  test('ORG-ACT-001 Cancel asks first, cancels, and takes Invite / Cancel off the menu', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const players = await seedPlayers(page, 2);
    const session = await seedHubSession(page, organiser, {
      title: `Cancel me ${Date.now()}`,
      startAt: inDays(5),
      status: 'published',
      registrations: players.map((p) => ({ userId: p.id })),
    });

    await openWorkspaceTab(page, session.id, 'overview');
    await openMoreMenu(page);
    await page.getByTestId('organiser-session-more-cancel').click();
    const dialog = page.getByTestId('organiser-session-cancel-dialog');
    await expect(dialog).toContainText('(2)'); // tells the organiser who'll be messaged
    // "Keep Session" really keeps it.
    await page.getByTestId('organiser-session-cancel-keep').click();
    expect((await getSession(page, session.id)).status).toBe('published');

    await openMoreMenu(page);
    await page.getByTestId('organiser-session-more-cancel').click();
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/sessions/${session.id}/cancel`) && r.request().method() === 'POST'),
      page.getByTestId('organiser-session-cancel-confirm').click(),
    ]);
    expect(res.status()).toBe(200);
    expect((await getSession(page, session.id)).status).toBe('cancelled');

    await page.reload();
    const items = await menuItems(page);
    expect(items).not.toContain('cancel');
    expect(items).not.toContain('invite');
    // The server agrees: no invites into a cancelled session.
    const invite = await page.request.post(`/api/organizer/sessions/${session.id}/invite`, { data: { userId: players[0].id }, failOnStatusCode: false });
    expect(invite.status()).toBe(400);
  });

  test('ORG-ACT-002 Archive asks first and moves the session to Archived', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const session = await seedHubSession(page, organiser, { title: `Archive me ${Date.now()}`, startAt: inDays(-3), status: 'completed' });

    await openWorkspaceTab(page, session.id, 'overview');
    await openMoreMenu(page);
    await page.getByTestId('organiser-session-more-archive').click();
    await expect(page.getByTestId('organiser-session-archive-dialog')).toBeVisible();
    await page.getByTestId('organiser-session-archive-confirm').click();
    await expect.poll(async () => (await getSession(page, session.id)).status, { timeout: 15_000 }).toBe('archived');

    await page.reload();
    expect(await menuItems(page)).not.toContain('archive');
  });

  test('ORG-ACT-003 Invite: offered and accepted only for a published session that has not finished', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const [invitee, other] = await seedPlayers(page, 2);
    const open = await seedHubSession(page, organiser, { title: `Invite open ${Date.now()}`, startAt: inDays(4), status: 'published' });
    const draft = await seedHubSession(page, organiser, { title: `Invite draft ${Date.now()}`, startAt: inDays(4), status: 'draft' });
    const finished = await seedHubSession(page, organiser, { title: `Invite finished ${Date.now()}`, startAt: inDays(-2), status: 'published' });
    await updateSession(page, finished.id, { endAt: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 2 * 3600 * 1000).toISOString() });

    // Published, upcoming: in the menu, the dialog opens, and the invite is stored.
    await openWorkspaceTab(page, open.id, 'overview');
    expect(await menuItems(page)).toContain('invite');
    const res = await page.request.post(`/api/organizer/sessions/${open.id}/invite`, { data: { userId: invitee.id } });
    expect(res.status()).toBe(200);
    const regs = await sessionRegistrations(page, open.id);
    expect(regs.find((r) => r.userId === invitee.id)?.status).toBe('invited');

    // Draft and finished: not offered, and refused by the server.
    for (const s of [draft, finished]) {
      await openWorkspaceTab(page, s.id, 'overview');
      expect(await menuItems(page), s.id).not.toContain('invite');
      const refused = await page.request.post(`/api/organizer/sessions/${s.id}/invite`, { data: { userId: other.id }, failOnStatusCode: false });
      expect(refused.status(), s.id).toBe(400);
      expect((await sessionRegistrations(page, s.id)).find((r) => r.userId === other.id)).toBeUndefined();
    }
  });

  test('ORG-ACT-004 Announcement reaches every registered player; not offered for a draft', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const players = await seedPlayers(page, 2);
    const session = await seedHubSession(page, organiser, {
      title: `Announce ${Date.now()}`,
      startAt: inDays(2),
      status: 'published',
      registrations: players.map((p) => ({ userId: p.id })),
    });
    const draft = await seedHubSession(page, organiser, { title: `Announce draft ${Date.now()}`, startAt: inDays(2), status: 'draft' });

    await openWorkspaceTab(page, session.id, 'overview');
    await openMoreMenu(page);
    await page.getByTestId('organiser-session-more-announce').click();
    await page.getByTestId('organiser-session-announcement-input').fill('Courts 3 and 4 tonight - see you there');
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/sessions/${session.id}/broadcast`) && r.request().method() === 'POST'),
      page.getByTestId('organiser-session-announcement-send').click(),
    ]);
    expect(res.status()).toBe(200);
    expect((await res.json()).sentTo).toBe(2);
    await expect(page.getByTestId('organiser-session-announcement-dialog')).toBeHidden();

    await openWorkspaceTab(page, draft.id, 'overview');
    const items = await menuItems(page);
    expect(items).not.toContain('announce');
    expect(items).toContain('publish');
  });

  test('ORG-ACT-005 Export Player List downloads the registered players', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const players = await seedPlayers(page, 3);
    const session = await seedHubSession(page, organiser, {
      title: `Export ${Date.now()}`,
      startAt: inDays(2),
      status: 'published',
      registrations: players.map((p, i) => ({ userId: p.id, checkedIn: i === 0 })),
    });

    await openWorkspaceTab(page, session.id, 'overview');
    await openMoreMenu(page);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('organiser-session-more-export').click()]);
    expect(download.suggestedFilename()).toMatch(/-players\.csv$/);
    const lines = readFileSync(await download.path(), 'utf8').split('\n');
    expect(lines[0]).toBe('"Name","Profile","Status","Checked in","Registered at"');
    expect(lines).toHaveLength(4);
    for (const p of players) expect(lines.join('\n')).toContain(p.name);
  });

  test('ORG-ACT-006 Share copies the real public page, and only when there is one', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const organiser = await becomeOrganiser(page);
    const published = await seedHubSession(page, organiser, { title: `Share ${Date.now()}`, startAt: inDays(3), status: 'published' });
    const draft = await seedHubSession(page, organiser, { title: `Share draft ${Date.now()}`, startAt: inDays(3), status: 'draft' });

    await openWorkspaceTab(page, published.id, 'overview');
    await page.getByTestId('organiser-session-share-button').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(new URL(`/play/${published.id}`, baseURL).toString());
    // The link works: the public page opens.
    await page.goto(copied);
    await expect(page.getByTestId('play-session-details-page')).toBeVisible({ timeout: 15_000 });

    // The Players tab's share card shows the same link.
    await openWorkspaceTab(page, published.id, 'players');
    await expect(page.getByTestId('organiser-invite-players-link')).toHaveText(copied);

    // A draft has no public page: nothing is copied.
    await page.evaluate(() => navigator.clipboard.writeText('unchanged'));
    await openWorkspaceTab(page, draft.id, 'overview');
    await page.getByTestId('organiser-session-share-button').click();
    await expect(page.getByText('No public link right now').first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('unchanged');
  });
});
