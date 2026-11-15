// npx tsx --test server/lib/sessionLinkage.test.ts
//
// TC-211 (OH-AUDIT-001): the season / series / parent-event rules for
// POST /sessions and PUT /sessions/:id, without a server or database.
// The same rules through the real router: server/routes/organizerLinkage.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionLinkageProblem, type LinkageLookups } from "./sessionLinkage";

const SEASONS: Record<string, { id: string; organizationId: string }> = {
  "season-a1": { id: "season-a1", organizationId: "org-a" },
  "season-a2": { id: "season-a2", organizationId: "org-a" },
  "season-b": { id: "season-b", organizationId: "org-b" },
};
const SERIES: Record<string, { id: string; organizationId: string; seasonId: string }> = {
  "series-a1": { id: "series-a1", organizationId: "org-a", seasonId: "season-a1" },
  "series-a2": { id: "series-a2", organizationId: "org-a", seasonId: "season-a2" },
  "series-b": { id: "series-b", organizationId: "org-b", seasonId: "season-b" },
};
const lookups: LinkageLookups = {
  getSeasonById: async (id) => SEASONS[id],
  getSeriesById: async (id) => SERIES[id],
};
const none = { seasonId: null, seriesId: null, parentSessionId: null };

test("no linkage fields in the request: nothing to check", async () => {
  assert.equal(await sessionLinkageProblem("org-a", { title: "Doubles" }, lookups), null);
  assert.equal(await sessionLinkageProblem("org-a", { title: "x" }, lookups, { seasonId: "season-b", seriesId: "series-b", parentSessionId: null }), null);
});

test("own season, own series of that season, and clearing them are allowed", async () => {
  assert.equal(await sessionLinkageProblem("org-a", { seasonId: "season-a1" }, lookups), null);
  assert.equal(await sessionLinkageProblem("org-a", { seasonId: "season-a1", seriesId: "series-a1" }, lookups), null);
  assert.equal(await sessionLinkageProblem("org-a", { seriesId: "series-a1" }, lookups, { ...none, seasonId: "season-a1" }), null);
  assert.equal(await sessionLinkageProblem("org-a", { seasonId: null }, lookups, { ...none, seasonId: "season-a1" }), null);
  assert.equal(await sessionLinkageProblem("org-a", { seasonId: null, seriesId: null }, lookups, { ...none, seasonId: "season-a1", seriesId: "series-a1" }), null);
  assert.equal(await sessionLinkageProblem("org-a", { seriesId: null }, lookups, { ...none, seasonId: "season-a1", seriesId: "series-a1" }), null);
});

test("another organisation's season or series is a 404 - the same answer as an unknown id", async () => {
  const foreignSeason = await sessionLinkageProblem("org-a", { seasonId: "season-b" }, lookups);
  const unknownSeason = await sessionLinkageProblem("org-a", { seasonId: "nope" }, lookups);
  assert.deepEqual(foreignSeason, { status: 404, code: "season_not_found", message: "Season not found" });
  assert.deepEqual(unknownSeason, foreignSeason);

  const foreignSeries = await sessionLinkageProblem("org-a", { seriesId: "series-b" }, lookups, { ...none, seasonId: "season-a1" });
  const unknownSeries = await sessionLinkageProblem("org-a", { seriesId: "nope" }, lookups, { ...none, seasonId: "season-a1" });
  assert.equal(foreignSeries?.status, 404);
  assert.equal(foreignSeries?.code, "series_not_found");
  assert.deepEqual(unknownSeries, foreignSeries);
  // Foreign series named together with its own (foreign) season: still 404, never a pair check that leaks.
  assert.equal((await sessionLinkageProblem("org-a", { seasonId: "season-b", seriesId: "series-b" }, lookups))?.status, 404);
});

test("a series must belong to the session's season", async () => {
  // Series of season A2 with season A1 in the same request.
  const p1 = await sessionLinkageProblem("org-a", { seasonId: "season-a1", seriesId: "series-a2" }, lookups);
  assert.equal(p1?.status, 400);
  assert.equal(p1?.code, "series_season_mismatch");
  // Series without any season.
  assert.equal((await sessionLinkageProblem("org-a", { seriesId: "series-a1" }, lookups))?.code, "series_season_mismatch");
  // Series of A2 on a session stored in A1.
  assert.equal((await sessionLinkageProblem("org-a", { seriesId: "series-a2" }, lookups, { ...none, seasonId: "season-a1" }))?.code, "series_season_mismatch");
  // Moving a session that sits in series A1 to season A2, or clearing its season, while keeping the series.
  const inSeries = { ...none, seasonId: "season-a1", seriesId: "series-a1" };
  assert.equal((await sessionLinkageProblem("org-a", { seasonId: "season-a2" }, lookups, inSeries))?.code, "series_season_mismatch");
  assert.equal((await sessionLinkageProblem("org-a", { seasonId: null }, lookups, inSeries))?.code, "series_season_mismatch");
  // ...but moving season AND series together is fine.
  assert.equal(await sessionLinkageProblem("org-a", { seasonId: "season-a2", seriesId: "series-a2" }, lookups, inSeries), null);
});

test("parentSessionId: never set on create, only echoed unchanged on update", async () => {
  assert.equal((await sessionLinkageProblem("org-a", { parentSessionId: "event-b" }, lookups))?.code, "parent_not_editable");
  assert.equal((await sessionLinkageProblem("org-a", { parentSessionId: "event-a" }, lookups))?.status, 400);
  assert.equal((await sessionLinkageProblem("org-a", { parentSessionId: "event-b" }, lookups, { ...none, parentSessionId: "event-a" }))?.code, "parent_not_editable");
  assert.equal((await sessionLinkageProblem("org-a", { parentSessionId: "event-a" }, lookups, none))?.code, "parent_not_editable");
  assert.equal(await sessionLinkageProblem("org-a", { parentSessionId: "event-a" }, lookups, { ...none, parentSessionId: "event-a" }), null);
  assert.equal(await sessionLinkageProblem("org-a", { parentSessionId: null }, lookups, none), null);
});

test("malformed ids are a 400, not a lookup", async () => {
  assert.equal((await sessionLinkageProblem("org-a", { seasonId: 42 }, lookups))?.code, "invalid_linkage");
  assert.equal((await sessionLinkageProblem("org-a", { seriesId: "  " }, lookups))?.code, "invalid_linkage");
  assert.equal((await sessionLinkageProblem("org-a", { seasonId: ["season-a1"] }, lookups))?.code, "invalid_linkage");
});
