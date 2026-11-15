import { test, expect, type Page } from '@playwright/test';
import { becomeOrganiser, createSeason, createSeries } from '../helpers/organiser';
import { inDays, secondOrganiser, seedHubSession } from '../helpers/organiser-hub';

/*
  TC-211 - Organiser Hub audit Batch 1 (OH-AUDIT-001 / OH-AUDIT-002), on a
  deployed server. Two run-owned organisers, A and B, each with their own
  organisation, season and ranking series.

    SEC-ORG-001  A cannot point a session at B's season, series or event
                 (POST and PUT /api/organizer/sessions) - 404 / 400, and
                 nothing on either side changes.
    SEC-ORG-002  A cannot detach B's session from a season or series through
                 A's own season/series ids - 404, B's session untouched.
    SEC-ORG-003  The legitimate flows keep working: attach and detach within
                 one organisation, and a series of another season is refused.

  The server rules are unit-tested in server/routes/organizerLinkage.test.ts
  and server/lib/sessionLinkage.test.ts; this proves them end to end.

  Staging / local only (phase hub-msg-admin, tests/safety/staging-phases.ts).
  Run-owned data only, cleaned up by the run-scoped teardown. Every write
  aimed at B's data is one that must be refused; nothing is published,
  emailed or messaged.
*/

const API = '/api/organizer';

interface RawSession {
  id: string;
  seasonId: string | null;
  seriesId: string | null;
  parentSessionId: string | null;
  updatedAt: string;
  title: string;
}

async function rawSession(page: Page, id: string): Promise<RawSession> {
  const res = await page.request.get(`${API}/sessions/${id}`);
  expect(res.status(), `GET ${API}/sessions/${id}`).toBe(200);
  return res.json();
}

/** Only the fields TC-211 protects, so a refused request is compared exactly. */
const linkage = (s: RawSession) => ({ seasonId: s.seasonId, seriesId: s.seriesId, parentSessionId: s.parentSessionId, updatedAt: s.updatedAt, title: s.title });

async function seasonWithSeries(page: Page, label: string) {
  // ---------- Test data ----------
  const season = await createSeason(page, { name: `${label} Season ${Date.now()}`, startDate: inDays(-30).slice(0, 10), endDate: inDays(60).slice(0, 10) });
  const series = await createSeries(page, { seasonId: season.id, name: `${label} Ladder`, format: 'social' });
  return { season, series };
}

test.describe('Organiser Hub - cross-organisation season / series linkage (TC-211)', () => {
  test('SEC-ORG-001 An organiser cannot link a session to another organiser\'s season, series or event', async ({ page, browser }) => {
    test.slow(); // two organisers, each registered and granted through the UI
    // ---------- Login ----------
    const a = await becomeOrganiser(page);
    const b = await secondOrganiser(browser);
    try {
      // ---------- Test data ----------
      const bRes = await seasonWithSeries(b.page, 'B');
      const aRes = await seasonWithSeries(page, 'A');
      const bEvent = await seedHubSession(b.page, b.organiser, { title: `B event ${Date.now()}`, startAt: inDays(5), status: 'draft' });
      const aSession = await seedHubSession(page, a, { title: `A own ${Date.now()}`, startAt: inDays(5), status: 'draft' });
      const aBefore = linkage(await rawSession(page, aSession.id));
      const bEventBefore = linkage(await rawSession(b.page, bEvent.id));

      // ---------- Actions: create ----------
      const createAttempts: [Record<string, unknown>, number][] = [
        [{ seasonId: bRes.season.id }, 404],
        [{ seriesId: bRes.series.id }, 404],
        [{ seasonId: bRes.season.id, seriesId: bRes.series.id }, 404],
        [{ parentSessionId: bEvent.id }, 400],
      ];
      for (const [extra, status] of createAttempts) {
        const res = await page.request.post(`${API}/sessions`, {
          data: { title: `Sneaky ${Date.now()}`, startAt: inDays(6), ...extra },
          failOnStatusCode: false,
        });
        expect(res.status(), `POST /sessions with ${JSON.stringify(Object.keys(extra))}`).toBe(status);
      }

      // ---------- Actions: update (twice each - repeating must not get through) ----------
      for (let i = 0; i < 2; i++) {
        for (const [extra, status] of createAttempts) {
          const res = await page.request.put(`${API}/sessions/${aSession.id}`, { data: extra, failOnStatusCode: false });
          expect(res.status(), `PUT /sessions/:id with ${JSON.stringify(Object.keys(extra))}`).toBe(status);
        }
      }

      // ---------- Actions: move A's own season / series into B's organisation or season ----------
      for (const data of [{ organizationId: b.organiser.organizationId }, { seasonId: bRes.season.id }]) {
        const res = await page.request.put(`${API}/series/${aRes.series.id}`, { data, failOnStatusCode: false });
        expect(res.status(), `PUT own series with ${Object.keys(data)[0]} of B`).toBe(400);
      }
      const seasonMove = await page.request.put(`${API}/seasons/${aRes.season.id}`, { data: { organizationId: b.organiser.organizationId }, failOnStatusCode: false });
      expect(seasonMove.status(), 'PUT own season into B\'s organisation').toBe(400);

      // ---------- Verify request: an unknown id answers exactly like a foreign one ----------
      const foreign = await page.request.put(`${API}/sessions/${aSession.id}`, { data: { seasonId: bRes.season.id }, failOnStatusCode: false });
      const unknown = await page.request.put(`${API}/sessions/${aSession.id}`, { data: { seasonId: '00000000-0000-0000-0000-000000000000' }, failOnStatusCode: false });
      expect(unknown.status()).toBe(foreign.status());
      expect(await unknown.json()).toEqual(await foreign.json());

      // ---------- Final verification ----------
      expect(linkage(await rawSession(page, aSession.id)), 'A\'s session is unchanged (updatedAt included)').toEqual(aBefore);
      expect(linkage(await rawSession(b.page, bEvent.id)), 'B\'s event is unchanged').toEqual(bEventBefore);
      const bSeasonSessions = await (await b.page.request.get(`${API}/seasons/${bRes.season.id}/sessions`)).json();
      expect(bSeasonSessions.map((s: { id: string }) => s.id), 'nothing of A\'s appears in B\'s season').not.toContain(aSession.id);
      const bSeriesSessions = await (await b.page.request.get(`${API}/series/${bRes.series.id}/sessions`)).json();
      expect(bSeriesSessions, 'B\'s series is still empty').toHaveLength(0);
      const bSeriesList = await (await b.page.request.get(`${API}/seasons/${bRes.season.id}/series`)).json();
      expect(bSeriesList.map((x: { id: string }) => x.id), 'A\'s series did not move into B\'s season').toEqual([bRes.series.id]);
      const bSeasons = await (await b.page.request.get(`${API}/seasons`)).json();
      expect(bSeasons.map((x: { id: string }) => x.id), 'A\'s season did not move into B\'s organisation').not.toContain(aRes.season.id);
      const bDivisions = await (await b.page.request.get(`${API}/sessions/${bEvent.id}/divisions`)).json();
      expect(Array.isArray(bDivisions) ? bDivisions.length : 0, 'no division was added to B\'s event').toBe(0);
    } finally {
      await b.close();
    }
  });

  test('SEC-ORG-002 An organiser cannot detach another organiser\'s session from a season or series', async ({ page, browser }) => {
    test.slow();
    // ---------- Login ----------
    await becomeOrganiser(page);
    const b = await secondOrganiser(browser);
    try {
      // ---------- Test data ----------
      const aRes = await seasonWithSeries(page, 'A');
      const bRes = await seasonWithSeries(b.page, 'B');
      const bSession = await seedHubSession(b.page, b.organiser, {
        title: `B ranked ${Date.now()}`,
        startAt: inDays(4),
        status: 'draft',
        seasonId: bRes.season.id,
        seriesId: bRes.series.id,
      });
      const bBefore = linkage(await rawSession(b.page, bSession.id));
      expect(bBefore.seasonId).toBe(bRes.season.id);
      expect(bBefore.seriesId).toBe(bRes.series.id);

      // ---------- Actions ----------
      for (let i = 0; i < 2; i++) {
        // A's own season / series id + B's session id: the IDOR this ticket closes.
        const viaOwnSeries = await page.request.delete(`${API}/series/${aRes.series.id}/sessions/${bSession.id}`, { failOnStatusCode: false });
        expect(viaOwnSeries.status(), 'detach from series via A\'s own series id').toBe(404);
        const viaOwnSeason = await page.request.delete(`${API}/seasons/${aRes.season.id}/sessions/${bSession.id}`, { failOnStatusCode: false });
        expect(viaOwnSeason.status(), 'detach from season via A\'s own season id').toBe(404);
        // B's own season / series ids: refused by ownership of the season/series.
        const viaBSeries = await page.request.delete(`${API}/series/${bRes.series.id}/sessions/${bSession.id}`, { failOnStatusCode: false });
        expect(viaBSeries.status()).toBe(403);
        const viaBSeason = await page.request.delete(`${API}/seasons/${bRes.season.id}/sessions/${bSession.id}`, { failOnStatusCode: false });
        expect(viaBSeason.status()).toBe(403);
      }

      // ---------- Final verification ----------
      expect(linkage(await rawSession(b.page, bSession.id)), 'B\'s session still in its season and series, updatedAt unchanged').toEqual(bBefore);
      const bSeriesSessions = await (await b.page.request.get(`${API}/series/${bRes.series.id}/sessions`)).json();
      expect(bSeriesSessions.map((s: { id: string }) => s.id)).toContain(bSession.id);
    } finally {
      await b.close();
    }
  });

  test('SEC-ORG-003 Attach and detach within one organisation keep working; a series of another season is refused', async ({ page }) => {
    // ---------- Login ----------
    const a = await becomeOrganiser(page);

    // ---------- Test data ----------
    const first = await seasonWithSeries(page, 'A1');
    const second = await createSeason(page, { name: `A2 Season ${Date.now()}`, startDate: inDays(61).slice(0, 10), endDate: inDays(120).slice(0, 10) });
    const session = await seedHubSession(page, a, { title: `A ladder night ${Date.now()}`, startAt: inDays(3), status: 'draft' });

    // ---------- Actions: own season through the session form (wizard Season picker) ----------
    const put = await page.request.put(`${API}/sessions/${session.id}`, { data: { seasonId: first.season.id } });
    expect(put.status()).toBe(200);
    expect((await rawSession(page, session.id)).seasonId).toBe(first.season.id);

    // ---------- Actions: attach to the series of that season ----------
    const attach = await page.request.post(`${API}/series/${first.series.id}/sessions`, { data: { sessionIds: [session.id] } });
    expect(attach.status()).toBe(204);
    expect((await rawSession(page, session.id)).seriesId).toBe(first.series.id);

    // ---------- Verify request: moving season while staying in the series is refused ----------
    const beforeMismatch = linkage(await rawSession(page, session.id));
    const mismatch = await page.request.put(`${API}/sessions/${session.id}`, { data: { seasonId: second.id }, failOnStatusCode: false });
    expect(mismatch.status()).toBe(400);
    expect((await mismatch.json()).code).toBe('series_season_mismatch');
    expect(linkage(await rawSession(page, session.id))).toEqual(beforeMismatch);

    // ---------- Actions: detach from series, then season (a repeat is a harmless no-op) ----------
    for (let i = 0; i < 2; i++) {
      const res = await page.request.delete(`${API}/series/${first.series.id}/sessions/${session.id}`);
      expect(res.status()).toBe(204);
    }
    expect((await rawSession(page, session.id)).seriesId).toBeNull();
    const detachSeason = await page.request.delete(`${API}/seasons/${first.season.id}/sessions/${session.id}`);
    expect(detachSeason.status()).toBe(204);

    // ---------- Final verification ----------
    const after = await rawSession(page, session.id);
    expect(after.seasonId).toBeNull();
    expect(after.seriesId).toBeNull();
  });
});
