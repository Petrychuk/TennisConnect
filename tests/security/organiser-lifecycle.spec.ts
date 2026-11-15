import { test, expect, type Page } from '@playwright/test';
import { becomeOrganiser, seedPlayers } from '../helpers/organiser';
import { inDays, seedHubSession } from '../helpers/organiser-hub';
import { login } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/test-users';

/*
  TC-212 - Organiser Hub audit Batch 2 (OH-AUDIT-005 / OH-AUDIT-006), on a
  deployed server. One run-owned organiser and run-owned players.

    SEC-LC-001  A cancelled session can't be edited (409 "cancelled"), and
                nothing on it changes - updatedAt included.
    SEC-LC-002  Capacity can't be set below the players already registered;
                raising it still works.
    SEC-LC-003  Cancel and archive are conditional: a second cancel is 409,
                a finished session can't be cancelled, archive repeats safely.
    SEC-LC-004  An admin can't approve or reject a session that isn't waiting
                for review (409) - it stays as it was.

  The server rules are unit-tested in server/routes/organizerLifecycle.test.ts
  and shared/sessionActions.test.ts; this proves them end to end.

  Staging / local only (phase hub-msg-admin, tests/safety/staging-phases.ts).
  Run-owned data only. Nothing is published or submitted for review, and the
  only cancellation is of a draft with nobody registered, so no message is
  sent to anyone. The admin requests are all ones that must be refused.
*/

const API = '/api/organizer';

async function apiSession(page: Page, id: string) {
  const res = await page.request.get(`${API}/sessions/${id}`);
  expect(res.status(), `GET ${API}/sessions/${id}`).toBe(200);
  return res.json();
}

test.describe('Organiser Hub - session lifecycle and edit guards (TC-212)', () => {
  test('SEC-LC-001 A cancelled session cannot be edited', async ({ page }) => {
    // ---------- Login ----------
    const organiser = await becomeOrganiser(page);

    // ---------- Test data ----------
    const seeded = await seedHubSession(page, organiser, { title: `Cancelled ${Date.now()}`, startAt: inDays(4), status: 'cancelled' });
    const before = await apiSession(page, seeded.id);

    // ---------- Actions ----------
    for (const data of [{ title: 'Back on' }, { startAt: inDays(6) }, { maxParticipants: 20 }]) {
      const res = await page.request.put(`${API}/sessions/${seeded.id}`, { data, failOnStatusCode: false });
      // ---------- Verify request ----------
      expect(res.status(), `PUT ${Object.keys(data)[0]} on a cancelled session`).toBe(409);
      expect((await res.json()).code).toBe('cancelled');
    }

    // ---------- Final verification ----------
    const after = await apiSession(page, seeded.id);
    expect({ title: after.title, startAt: after.startAt, maxParticipants: after.maxParticipants, updatedAt: after.updatedAt, status: after.status })
      .toEqual({ title: before.title, startAt: before.startAt, maxParticipants: before.maxParticipants, updatedAt: before.updatedAt, status: 'cancelled' });
  });

  test('SEC-LC-002 Capacity cannot drop below the players already registered', async ({ page }) => {
    // ---------- Login ----------
    const organiser = await becomeOrganiser(page);

    // ---------- Test data ----------
    const players = await seedPlayers(page, 3);
    const seeded = await seedHubSession(page, organiser, {
      title: `Capacity ${Date.now()}`,
      startAt: inDays(5),
      status: 'published',
      maxParticipants: 8,
      registrations: players.map((p) => ({ userId: p.id })),
    });

    // ---------- Actions ----------
    const tooLow = await page.request.put(`${API}/sessions/${seeded.id}`, { data: { maxParticipants: 2 }, failOnStatusCode: false });

    // ---------- Verify request ----------
    expect(tooLow.status()).toBe(409);
    const body = await tooLow.json();
    expect(body.code).toBe('capacity_below_registered');
    expect(body.registered).toBe(3);
    expect((await apiSession(page, seeded.id)).maxParticipants).toBe(8);

    // ---------- Save ----------
    const exact = await page.request.put(`${API}/sessions/${seeded.id}`, { data: { maxParticipants: 3 } });
    expect(exact.status()).toBe(200);

    // ---------- Final verification ----------
    expect((await apiSession(page, seeded.id)).maxParticipants).toBe(3);
  });

  test('SEC-LC-003 Cancel and archive only apply once and only from the right status', async ({ page }) => {
    // ---------- Login ----------
    const organiser = await becomeOrganiser(page);

    // ---------- Test data ----------
    const draft = await seedHubSession(page, organiser, { title: `Draft to cancel ${Date.now()}`, startAt: inDays(7), status: 'draft' });
    const finished = await seedHubSession(page, organiser, { title: `Finished ${Date.now()}`, startAt: inDays(-1), status: 'completed' });

    // ---------- Actions: cancel (a draft - nobody registered, nobody messaged) ----------
    expect((await page.request.post(`${API}/sessions/${draft.id}/cancel`)).status()).toBe(200);
    const again = await page.request.post(`${API}/sessions/${draft.id}/cancel`, { failOnStatusCode: false });
    expect(again.status(), 'second cancel').toBe(409);
    const finishedCancel = await page.request.post(`${API}/sessions/${finished.id}/cancel`, { failOnStatusCode: false });
    expect(finishedCancel.status(), 'a completed session is never cancelled').toBe(409);

    // ---------- Actions: archive twice ----------
    for (let i = 0; i < 2; i++) {
      const res = await page.request.post(`${API}/sessions/${finished.id}/archive`);
      expect(res.status(), `archive #${i + 1}`).toBe(200);
    }

    // ---------- Final verification ----------
    expect((await apiSession(page, draft.id)).status).toBe('cancelled');
    expect((await apiSession(page, finished.id)).status).toBe('archived');
  });

  test('SEC-LC-004 An admin cannot approve or reject a session that is not waiting for review', async ({ page, browser }) => {
    // ---------- Login ----------
    const organiser = await becomeOrganiser(page);

    // ---------- Test data ----------
    const cancelled = await seedHubSession(page, organiser, { title: `Not for review ${Date.now()}`, startAt: inDays(3), status: 'cancelled' });
    const completed = await seedHubSession(page, organiser, { title: `Played ${Date.now()}`, startAt: inDays(-2), status: 'completed' });

    const adminContext = await browser.newContext();
    try {
      const admin = await adminContext.newPage();
      await login(admin, TEST_USERS.admin.email, TEST_USERS.admin.password);

      // ---------- Actions ----------
      for (const id of [cancelled.id, completed.id]) {
        for (const verb of ['approve', 'reject']) {
          const res = await admin.request.post(`${API}/admin/sessions/${id}/${verb}`, { failOnStatusCode: false });
          // ---------- Verify request ----------
          expect(res.status(), `${verb} a non-pending session`).toBe(409);
          expect((await res.json()).code).toBe('not_pending_review');
        }
      }
      const unknown = await admin.request.post(`${API}/admin/sessions/00000000-0000-0000-0000-000000000000/approve`, { failOnStatusCode: false });
      expect(unknown.status()).toBe(404);
    } finally {
      await adminContext.close();
    }

    // ---------- Final verification ----------
    expect((await apiSession(page, cancelled.id)).status).toBe('cancelled');
    expect((await apiSession(page, completed.id)).status).toBe('completed');
  });
});
