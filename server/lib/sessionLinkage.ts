/*
  Which season / series / parent event a session may point at (TC-211,
  Organiser Hub audit OH-AUDIT-001).

  POST /sessions and PUT /sessions/:id accept seasonId and seriesId in the
  body (the wizard's Season picker sends seasonId), and the insert schema
  lets parentSessionId through too. Before TC-211 none of them was checked:
  an organiser could point their session at ANOTHER organisation's season
  or ranking series (it then showed up in that organiser's season, series
  and standings), or make it a "division" of someone else's event.

  Rules, checked before anything is written:
    - seasonId / seriesId must exist AND belong to the session's own
      organisation. Unknown and foreign ids get the same 404, so the API
      can't be used to probe which ids exist elsewhere.
    - a series belongs to one season: when the request sets seasonId or
      seriesId, the resulting pair must agree (a series without a season,
      or with a different one, is refused - 400).
    - parentSessionId is never set through these routes: divisions are
      created by POST /sessions/:id/divisions, which sets it server-side.
      Sending the session's current value back unchanged is allowed.

  Pure apart from the injected lookups - unit-tested in
  ./sessionLinkage.test.ts, and through the real router in
  server/routes/organizerLinkage.test.ts.
*/

export interface LinkageLookups {
  getSeasonById(id: string): Promise<{ id: string; organizationId: string } | undefined>;
  getSeriesById(id: string): Promise<{ id: string; organizationId: string; seasonId: string } | undefined>;
}

export interface LinkageProblem {
  status: 400 | 404;
  code: "season_not_found" | "series_not_found" | "series_season_mismatch" | "parent_not_editable" | "invalid_linkage" | "not_editable";
  message: string;
}

export interface CurrentLinkage {
  seasonId: string | null;
  seriesId: string | null;
  parentSessionId: string | null;
}

const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

/**
 * PUT /seasons/:id and PUT /series/:id: the owning organisation, the creator
 * and (for a series) its season are fixed once created - changing them would
 * move the season / series, and every ranked session in it, into another
 * organisation or season. Sending the stored value back unchanged is fine.
 */
export function fixedFieldProblem(
  changes: Record<string, unknown>,
  current: Record<string, unknown>,
  fields: readonly string[],
): LinkageProblem | null {
  for (const field of fields) {
    if (has(changes, field) && changes[field] !== undefined && changes[field] !== current[field]) {
      return { status: 400, code: "not_editable", message: `${field} can't be changed` };
    }
  }
  return null;
}

const SEASON_NOT_FOUND: LinkageProblem = { status: 404, code: "season_not_found", message: "Season not found" };
const SERIES_NOT_FOUND: LinkageProblem = { status: 404, code: "series_not_found", message: "Series not found" };

/**
 * Why this create/update can't link the session as asked, or null when it can.
 * `changes` is what the request would write (parsed body plus explicit null
 * clears); `current` is the stored session for an update, omitted for a create.
 */
export async function sessionLinkageProblem(
  organizationId: string,
  changes: Record<string, unknown>,
  lookups: LinkageLookups,
  current?: CurrentLinkage,
): Promise<LinkageProblem | null> {
  // ---------- Parent event (divisions) ----------
  if (has(changes, "parentSessionId")) {
    const requested = changes.parentSessionId ?? null;
    const unchanged = current !== undefined && requested === (current.parentSessionId ?? null);
    if (!unchanged) {
      return {
        status: 400,
        code: "parent_not_editable",
        message: "A session's parent event can't be set here - add divisions from the event itself.",
      };
    }
  }

  const touchesSeason = has(changes, "seasonId");
  const touchesSeries = has(changes, "seriesId");
  if (!touchesSeason && !touchesSeries) return null;

  for (const key of ["seasonId", "seriesId"] as const) {
    const v = changes[key];
    if (has(changes, key) && v !== null && v !== undefined && (typeof v !== "string" || v.trim() === "")) {
      return { status: 400, code: "invalid_linkage", message: `${key} must be an id or null` };
    }
  }

  // ---------- Ownership of what the request names ----------
  const requestedSeasonId = touchesSeason ? ((changes.seasonId as string | null | undefined) ?? null) : null;
  if (requestedSeasonId) {
    const season = await lookups.getSeasonById(requestedSeasonId);
    if (!season || season.organizationId !== organizationId) return SEASON_NOT_FOUND;
  }

  const requestedSeriesId = touchesSeries ? ((changes.seriesId as string | null | undefined) ?? null) : null;
  let seriesRow: { organizationId: string; seasonId: string } | undefined;
  if (requestedSeriesId) {
    seriesRow = await lookups.getSeriesById(requestedSeriesId);
    if (!seriesRow || seriesRow.organizationId !== organizationId) return SERIES_NOT_FOUND;
  }

  // ---------- The resulting season/series pair must agree ----------
  const effectiveSeasonId = touchesSeason ? requestedSeasonId : (current?.seasonId ?? null);
  const effectiveSeriesId = touchesSeries ? requestedSeriesId : (current?.seriesId ?? null);
  if (!effectiveSeriesId) return null;

  if (!seriesRow) seriesRow = await lookups.getSeriesById(effectiveSeriesId);
  if (!seriesRow || seriesRow.organizationId !== organizationId || seriesRow.seasonId !== effectiveSeasonId) {
    return {
      status: 400,
      code: "series_season_mismatch",
      message: touchesSeries
        ? "That ranking series belongs to a different season. Pick the series' own season, or another series."
        : "This session is in a ranking series of its current season. Remove it from the series first (Rankings), then change its season.",
    };
  }
  return null;
}
