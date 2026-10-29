// Organisation cascade delete - one implementation shared by
// storage.deleteOrganizationCascade() / deleteUserAccounts() (admin
// "Delete Organization", account deletion) and the Stage 3 E2E run
// cleanup (server/services/e2eRunCleanup.ts).
//
// Deletes everything that belongs to the given organisations - sessions
// (and their rounds, matches, registrations, update posts), seasons,
// series, session templates, memberships - and detaches (sets NULL) every
// optional reference other rows hold to them, then the organisations.
//
// Every foreign key into the tables touched here is listed in
// ORGANIZATION_CASCADE_COVERAGE. server/lib/organizationCascade.test.ts
// reads the real schema and fails if a foreign key exists that this map
// (and therefore this function) does not handle - so a new table that
// references sessions or organisations cannot silently break deletion
// again (seasons, series, session_templates and session_updates were
// missing before Stage 3, which made deleting such an organisation fail
// on a foreign-key violation).
//
// No database import here: callers pass their executor (the shared db or
// an open transaction), so this runs inside their transaction and is
// testable against a throwaway Postgres (organizationCascade.pg.test.ts).

import { inArray, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  communityMemberships,
  externalActivities,
  matches,
  messages,
  organizationMembers,
  organizations,
  registrations,
  seasons,
  series,
  sessionRounds,
  sessionTemplates,
  sessionUpdates,
  tennisSessions,
  tournamentHistory,
} from "@shared/schema";
import type * as schema from "@shared/schema";

/** The shared db or an open transaction - both expose select/update/delete. */
export type CascadeExecutor = Pick<NodePgDatabase<typeof schema>, "select" | "update" | "delete">;

/**
 * Every foreign key into a table this cascade deletes from, and what the
 * cascade does with the referencing rows. Keys are "<table>.<column>".
 */
export const ORGANIZATION_CASCADE_COVERAGE: Readonly<Record<string, "delete" | "set-null">> = {
  // -> organizations
  "sessions.organization_id": "delete",
  "seasons.organization_id": "delete",
  "series.organization_id": "delete",
  "session_templates.organization_id": "delete",
  "community_memberships.organization_id": "delete",
  "organization_members.organization_id": "delete",
  "messages.related_organization_id": "set-null",
  "external_activities.partner_id": "set-null",
  // -> seasons
  "series.season_id": "delete",
  "sessions.season_id": "set-null",
  // -> series
  "sessions.series_id": "set-null",
  // -> sessions
  "matches.session_id": "delete",
  "session_rounds.session_id": "delete",
  "registrations.session_id": "delete",
  "session_updates.session_id": "delete",
  "sessions.parent_session_id": "set-null",
  "tournament_history.session_id": "set-null",
  "messages.related_session_id": "set-null",
  "external_activities.duplicate_of_session_id": "set-null",
  // -> session_rounds
  "matches.round_id": "delete",
};

/** Tables whose rows this cascade deletes (the coverage test checks FKs into these). */
export const ORGANIZATION_CASCADE_TABLES = [
  "organizations",
  "sessions",
  "seasons",
  "series",
  "session_templates",
  "session_rounds",
  "registrations",
  "matches",
  "session_updates",
  "community_memberships",
  "organization_members",
] as const;

export interface OrganizationCascadeResult {
  organizations: number;
  sessions: number;
  seasons: number;
  series: number;
  sessionTemplates: number;
  sessionUpdates: number;
  registrations: number;
  rounds: number;
  matches: number;
  memberships: number;
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

export async function cascadeDeleteOrganizations(
  qb: CascadeExecutor,
  orgIds: readonly string[]
): Promise<OrganizationCascadeResult> {
  const result: OrganizationCascadeResult = {
    organizations: 0,
    sessions: 0,
    seasons: 0,
    series: 0,
    sessionTemplates: 0,
    sessionUpdates: 0,
    registrations: 0,
    rounds: 0,
    matches: 0,
    memberships: 0,
  };
  const orgList = Array.from(new Set(orgIds));
  if (orgList.length === 0) return result;

  // ---------- Sessions of these organisations ----------
  const sessionIds = ids(
    await qb.select({ id: tennisSessions.id }).from(tennisSessions).where(inArray(tennisSessions.organizationId, orgList))
  );

  if (sessionIds.length > 0) {
    // Optional references from elsewhere are detached, never deleted.
    await qb.update(tournamentHistory).set({ sessionId: null }).where(inArray(tournamentHistory.sessionId, sessionIds));
    await qb.update(messages).set({ relatedSessionId: null }).where(inArray(messages.relatedSessionId, sessionIds));
    await qb
      .update(externalActivities)
      .set({ duplicateOfSessionId: null })
      .where(inArray(externalActivities.duplicateOfSessionId, sessionIds));
    await qb.update(tennisSessions).set({ parentSessionId: null }).where(inArray(tennisSessions.parentSessionId, sessionIds));

    const roundIds = ids(
      await qb.select({ id: sessionRounds.id }).from(sessionRounds).where(inArray(sessionRounds.sessionId, sessionIds))
    );
    const matchWhere =
      roundIds.length > 0
        ? or(inArray(matches.sessionId, sessionIds), inArray(matches.roundId, roundIds))
        : inArray(matches.sessionId, sessionIds);

    result.matches = (await qb.delete(matches).where(matchWhere).returning({ id: matches.id })).length;
    result.rounds = (
      await qb.delete(sessionRounds).where(inArray(sessionRounds.sessionId, sessionIds)).returning({ id: sessionRounds.id })
    ).length;
    result.registrations = (
      await qb.delete(registrations).where(inArray(registrations.sessionId, sessionIds)).returning({ id: registrations.id })
    ).length;
    result.sessionUpdates = (
      await qb.delete(sessionUpdates).where(inArray(sessionUpdates.sessionId, sessionIds)).returning({ id: sessionUpdates.id })
    ).length;
    result.sessions = (
      await qb.delete(tennisSessions).where(inArray(tennisSessions.id, sessionIds)).returning({ id: tennisSessions.id })
    ).length;
  }

  // ---------- Seasons and series ----------
  const seasonIds = ids(await qb.select({ id: seasons.id }).from(seasons).where(inArray(seasons.organizationId, orgList)));
  const seriesWhere =
    seasonIds.length > 0
      ? or(inArray(series.organizationId, orgList), inArray(series.seasonId, seasonIds))
      : inArray(series.organizationId, orgList);
  const seriesIds = ids(await qb.select({ id: series.id }).from(series).where(seriesWhere));

  // Sessions of OTHER organisations should never point at these, but if
  // one does, it is detached rather than blocking (or being deleted).
  if (seriesIds.length > 0) {
    await qb.update(tennisSessions).set({ seriesId: null }).where(inArray(tennisSessions.seriesId, seriesIds));
    result.series = (await qb.delete(series).where(inArray(series.id, seriesIds)).returning({ id: series.id })).length;
  }
  if (seasonIds.length > 0) {
    await qb.update(tennisSessions).set({ seasonId: null }).where(inArray(tennisSessions.seasonId, seasonIds));
    result.seasons = (await qb.delete(seasons).where(inArray(seasons.id, seasonIds)).returning({ id: seasons.id })).length;
  }

  // ---------- Templates, memberships, detach, organisations ----------
  result.sessionTemplates = (
    await qb.delete(sessionTemplates).where(inArray(sessionTemplates.organizationId, orgList)).returning({ id: sessionTemplates.id })
  ).length;

  await qb.update(messages).set({ relatedOrganizationId: null }).where(inArray(messages.relatedOrganizationId, orgList));
  await qb.update(externalActivities).set({ partnerId: null }).where(inArray(externalActivities.partnerId, orgList));

  result.memberships += (
    await qb
      .delete(communityMemberships)
      .where(inArray(communityMemberships.organizationId, orgList))
      .returning({ id: communityMemberships.id })
  ).length;
  result.memberships += (
    await qb
      .delete(organizationMembers)
      .where(inArray(organizationMembers.organizationId, orgList))
      .returning({ id: organizationMembers.id })
  ).length;

  result.organizations = (
    await qb.delete(organizations).where(inArray(organizations.id, orgList)).returning({ id: organizations.id })
  ).length;

  return result;
}
