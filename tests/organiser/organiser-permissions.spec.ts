import { test, expect } from '@playwright/test';
import { becomeOrganiser, seedPlayers } from '../helpers/organiser';
import { inDays, secondOrganiser, seedHubSession } from '../helpers/organiser-hub';

/*
  Organiser Hub permissions across organisers (Phase 2 coverage).

  Two run-owned organisers, A and B, each with their own organisation. B owns
  a session with a registration and a confirmed match. A must not be able
  to read or change any of it, through the UI or the API. The server rules
  are unit-tested in server/routes/organizerOwnership.test.ts; this proves
  them on a deployed server.

  Staging / local only (phase hub-msg-admin). Run-owned data, cleaned up by
  the run-scoped teardown. Only refused writes are attempted against B's
  data; the one accepted write is A's own organisation.
*/

test.describe('Organiser Hub permissions', () => {
  test('ORG-PERM-001 An organiser cannot see or change another organiser\'s organisation, sessions, players or rounds', async ({ page, browser }) => {
    test.slow(); // two organisers, each registered and granted through the UI
    const a = await becomeOrganiser(page);
    const b = await secondOrganiser(browser);
    try {
      const players = await seedPlayers(b.page, 2);
      const title = `B private ${Date.now()}`;
      const session = await seedHubSession(b.page, b.organiser, {
        title,
        startAt: inDays(-1),
        status: 'completed',
        registrations: players.map((p) => ({ userId: p.id, checkedIn: true })),
        matches: [{ teamAIds: [players[0].id], teamBIds: [players[1].id], teamAGames: 6, teamBGames: 2 }],
      });

      // Reads: B's session, players and rounds.
      for (const path of [`/sessions/${session.id}`, `/sessions/${session.id}/registrations`, `/sessions/${session.id}/rounds`]) {
        const res = await page.request.get(`/api/organizer${path}`, { failOnStatusCode: false });
        expect(res.status(), `GET ${path} as another organiser`).toBe(403);
      }

      // Writes on B's session and organisation.
      const writes: [string, string, unknown][] = [
        ['PUT', `/sessions/${session.id}`, { title: 'Taken over' }],
        ['POST', `/sessions/${session.id}/cancel`, {}],
        ['POST', `/sessions/${session.id}/archive`, {}],
        ['POST', `/sessions/${session.id}/broadcast`, { message: 'Not yours' }],
        ['POST', `/sessions/${session.id}/checkin/${session.registrationIds[0]}`, {}],
      ];
      for (const [method, path, data] of writes) {
        const res = await page.request.fetch(`/api/organizer${path}`, { method, data, failOnStatusCode: false });
        expect(res.status(), `${method} ${path} as another organiser`).toBe(403);
      }
      const orgPut = await page.request.put(`/api/organizer/organizations/${b.organiser.organizationId}`, { data: { name: 'Taken over' }, failOnStatusCode: false });
      expect(orgPut.status(), 'PUT another organisation').toBe(404);

      // A's own session id paired with B's registration: still refused (IDOR guard).
      const own = await seedHubSession(page, a, { title: `A own ${Date.now()}`, startAt: inDays(2), status: 'published' });
      const idor = await page.request.post(`/api/organizer/sessions/${own.id}/checkin/${session.registrationIds[0]}`, { failOnStatusCode: false });
      expect(idor.status()).toBe(404);

      // Nothing changed on B's side.
      const after = await (await b.page.request.get(`/api/organizer/sessions/${session.id}`)).json();
      expect(after.title).toBe(title);
      expect(after.status).toBe('completed');
      const bOrg = await (await b.page.request.get('/api/organizer/organizations/me')).json();
      expect(bOrg.name).toBe(b.organiser.organizationName);

      // The UI agrees: B's workspace is not A's to open.
      await page.goto(`/organiser/sessions/${session.id}`);
      await expect(page.getByTestId('organiser-session-not-found')).toBeVisible({ timeout: 15_000 });
    } finally {
      await b.close();
    }
  });

  test('ORG-PERM-002 An organiser cannot make their own organisation verified or premium', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const res = await page.request.put(`/api/organizer/organizations/${organiser.organizationId}`, {
      data: { name: organiser.organizationName, verified: true, listingType: 'premium', status: 'published', slug: 'taken-slug' },
    });
    expect(res.status()).toBe(200); // profile fields accepted, the rest silently dropped
    const org = await (await page.request.get('/api/organizer/organizations/me')).json();
    expect(org.verified).toBe(false);
    expect(org.listingType).toBe('free');
    expect(org.slug).not.toBe('taken-slug');

    // Server-side validation, not only the form: a script URL is refused.
    const bad = await page.request.put(`/api/organizer/organizations/${organiser.organizationId}`, {
      data: { website: 'javascript:alert(1)' },
      failOnStatusCode: false,
    });
    expect(bad.status()).toBe(400);
  });
});
