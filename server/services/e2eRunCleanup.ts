// Stage 3: run-scoped cleanup of E2E test data (Staging / development only -
// reached through POST /api/test-hooks/cleanup-run, which is gated like
// every other test hook).
//
// Deletes ONLY what one Playwright run created: users whose address is
// e2e-run-<runId>-<label>@tennisconnect.test (exact pattern, re-checked
// with isOwnedByRun) AND flagged isTestUser, the organisations they own
// (with everything in them - server/lib/organizationCascade.ts) and their
// account rows (server/lib/userCascade.ts, the same cascade real account
// deletion uses), plus their uploaded files.
//
// Never touched: Stage 2 baseline/fixture accounts and their data, any
// other run's users, legacy test users, real users. Fails closed - the
// plan lists REFUSALS and nothing is deleted while there is one:
//   - a selected user is not isTestUser, or is an admin;
//   - someone outside this run (a real user or another run's user)
//     registered for, joined, or exchanged messages with this run's data
//     (the shared Stage 2 baseline/fixture accounts are allowed - their
//     rows that point at run data are part of the run's test data);
//   - a run user created rows in an organisation the run does not own;
//   - rows OUTSIDE the run point at the run's data, so the cascade would
//     delete or detach them: another organisation's series or sessions
//     attached to the run's seasons/series/sessions, tournament history,
//     messages or discovery activities referencing the run's sessions or
//     organisations, or matches elsewhere reported/confirmed by run users.
//
// Uploaded files: deleting them is a WRITE to the Supabase project the
// server is configured with. It only happens with removeFiles: true, which
// the server sets only when E2E_STORAGE_CLEANUP=enabled - to be set on
// Staging after verifying it does not share Production's storage project.
// Without it, files are only listed (read-only) and cleanup refuses to
// delete a run that still has files, so nothing is orphaned.
//
// Order: plan (read-only) -> uploaded files -> one database transaction
// that re-plans and aborts if anything changed. Storage first keeps a
// failed cleanup retryable: the users still exist, so a second call
// finds and finishes them.

import { and, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import {
  communityMemberships,
  externalActivities,
  marketplaceItems,
  matches,
  messages,
  organizationMembers,
  organizations,
  registrations,
  seasons,
  series,
  sessionTemplates,
  sessionUpdates,
  tennisSessions,
  tournamentHistory,
  users,
} from "@shared/schema";
import { classifyEmail, isOwnedByRun, isSeedOwnedEmail, isValidRunId } from "../seeds/e2e/identities";
import { cascadeDeleteOrganizations, type OrganizationCascadeResult } from "../lib/organizationCascade";
import { deleteUserRows } from "../lib/userCascade";

export type CleanupDb = NodePgDatabase<typeof schema>;
type Executor = Pick<CleanupDb, "select">;

export class RunCleanupError extends Error {
  constructor(message: string, readonly plan?: RunCleanupPlan) {
    super(`[e2e-cleanup] ${message}`);
    this.name = "RunCleanupError";
  }
}

/** User-owned folders in the "media" bucket (uploadMedia, playerPhotos, tournament + marketplace photos). */
export const USER_STORAGE_FOLDERS = ["players", "coaches", "sessions", "marketplace"] as const;

export interface RunCleanupPlan {
  runId: string;
  users: { id: string; email: string }[];
  organizationIds: string[];
  counts: {
    sessions: number;
    seasons: number;
    series: number;
    sessionTemplates: number;
    registrationsInRunSessions: number;
    messages: number;
    marketplaceItems: number;
    tournamentHistory: number;
  };
  storagePrefixes: string[];
  refusals: string[];
}

export interface RunStorage {
  /** Every object path under prefix (recursive). Read-only. */
  listFiles(prefix: string): Promise<string[]>;
  remove(paths: string[]): Promise<void>;
}

const runEmailLike = (runId: string) => `e2e-run-${runId}-%@tennisconnect.test`;
const n = async (rows: Promise<{ n: number }[]>) => (await rows)[0]?.n ?? 0;

/** Within this run's cleanup: may this person have rows that point at run data? */
function allowedCounterpart(user: { email: string; isTestUser: boolean | null }, runId: string): boolean {
  return user.isTestUser === true && (isOwnedByRun(user.email, runId) || isSeedOwnedEmail(user.email));
}

export async function planRunCleanup(qb: Executor, runId: string): Promise<RunCleanupPlan> {
  if (!isValidRunId(runId)) throw new RunCleanupError("invalid run id");
  const refusals: string[] = [];

  // ---------- Users of exactly this run ----------
  const candidates = await qb
    .select({ id: users.id, email: users.email, isTestUser: users.isTestUser, isAdmin: users.isAdmin })
    .from(users)
    .where(sql`lower(${users.email}) like ${runEmailLike(runId)}`);
  const runUsers = candidates.filter((user) => isOwnedByRun(user.email, runId));
  for (const user of runUsers) {
    if (user.isTestUser !== true) refusals.push(`${user.email} is not flagged as a test user`);
    if (user.isAdmin === true) refusals.push(`${user.email} is an admin`);
  }
  const userIds = runUsers.map((user) => user.id);

  const plan: RunCleanupPlan = {
    runId,
    users: runUsers.map(({ id, email }) => ({ id, email })),
    organizationIds: [],
    counts: { sessions: 0, seasons: 0, series: 0, sessionTemplates: 0, registrationsInRunSessions: 0, messages: 0, marketplaceItems: 0, tournamentHistory: 0 },
    storagePrefixes: userIds.flatMap((id) => USER_STORAGE_FOLDERS.map((folder) => `${folder}/${id}/`)),
    refusals,
  };
  if (userIds.length === 0) return plan;

  // ---------- What they own ----------
  const orgIds = (await qb.select({ id: organizations.id }).from(organizations).where(inArray(organizations.ownerId, userIds))).map(
    (row) => row.id
  );
  plan.organizationIds = orgIds;
  const sessionIds =
    orgIds.length > 0
      ? (await qb.select({ id: tennisSessions.id }).from(tennisSessions).where(inArray(tennisSessions.organizationId, orgIds))).map(
          (row) => row.id
        )
      : [];

  const count = sql<number>`count(*)::int`;
  plan.counts.sessions = sessionIds.length;
  if (orgIds.length > 0) {
    plan.counts.seasons = await n(qb.select({ n: count }).from(seasons).where(inArray(seasons.organizationId, orgIds)));
    plan.counts.series = await n(qb.select({ n: count }).from(series).where(inArray(series.organizationId, orgIds)));
    plan.counts.sessionTemplates = await n(
      qb.select({ n: count }).from(sessionTemplates).where(inArray(sessionTemplates.organizationId, orgIds))
    );
  }
  plan.counts.messages = await n(
    qb.select({ n: count }).from(messages).where(or(inArray(messages.senderUserId, userIds), inArray(messages.recipientId, userIds)))
  );
  plan.counts.marketplaceItems = await n(qb.select({ n: count }).from(marketplaceItems).where(inArray(marketplaceItems.userId, userIds)));
  plan.counts.tournamentHistory = await n(qb.select({ n: count }).from(tournamentHistory).where(inArray(tournamentHistory.userId, userIds)));

  // ---------- Fail closed: anyone outside the run involved? ----------
  const counterpart = { email: users.email, isTestUser: users.isTestUser };

  if (sessionIds.length > 0) {
    const regs = await qb
      .select(counterpart)
      .from(registrations)
      .innerJoin(users, sql`${users.id} = ${registrations.userId}`)
      .where(inArray(registrations.sessionId, sessionIds));
    plan.counts.registrationsInRunSessions = regs.length;
    const foreign = regs.filter((row) => !allowedCounterpart(row, runId));
    if (foreign.length) refusals.push(`${foreign.length} registration(s) in this run's sessions by users outside the run`);
  }

  if (orgIds.length > 0) {
    const members = [
      ...(await qb
        .select(counterpart)
        .from(communityMemberships)
        .innerJoin(users, sql`${users.id} = ${communityMemberships.userId}`)
        .where(inArray(communityMemberships.organizationId, orgIds))),
      ...(await qb
        .select(counterpart)
        .from(organizationMembers)
        .innerJoin(users, sql`${users.id} = ${organizationMembers.userId}`)
        .where(inArray(organizationMembers.organizationId, orgIds))),
    ];
    const foreign = members.filter((row) => !allowedCounterpart(row, runId));
    if (foreign.length) refusals.push(`${foreign.length} membership(s) in this run's organisations by users outside the run`);
  }

  const sent = await qb
    .select(counterpart)
    .from(messages)
    .innerJoin(users, sql`${users.id} = ${messages.recipientId}`)
    .where(inArray(messages.senderUserId, userIds));
  const received = await qb
    .select(counterpart)
    .from(messages)
    .innerJoin(users, sql`${users.id} = ${messages.senderUserId}`)
    .where(inArray(messages.recipientId, userIds));
  const foreignMessages = [...sent, ...received].filter((row) => !allowedCounterpart(row, runId));
  if (foreignMessages.length) refusals.push(`${foreignMessages.length} message(s) exchanged with users outside the run`);

  const outsideOrg = orgIds.length > 0 ? (column: any) => notInArray(column, orgIds) : () => sql`true`;
  const createdElsewhere =
    (await n(qb.select({ n: count }).from(tennisSessions).where(and(inArray(tennisSessions.createdBy, userIds), outsideOrg(tennisSessions.organizationId))))) +
    (await n(qb.select({ n: count }).from(seasons).where(and(inArray(seasons.createdBy, userIds), outsideOrg(seasons.organizationId))))) +
    (await n(qb.select({ n: count }).from(series).where(and(inArray(series.createdBy, userIds), outsideOrg(series.organizationId))))) +
    (await n(
      qb.select({ n: count }).from(sessionTemplates).where(and(inArray(sessionTemplates.createdBy, userIds), outsideOrg(sessionTemplates.organizationId)))
    )) +
    (await n(
      qb
        .select({ n: count })
        .from(sessionUpdates)
        .where(
          and(
            inArray(sessionUpdates.organizerId, userIds),
            sessionIds.length > 0 ? notInArray(sessionUpdates.sessionId, sessionIds) : sql`true`
          )
        )
    ));
  if (createdElsewhere > 0) refusals.push(`${createdElsewhere} row(s) created by run users in organisations the run does not own`);

  // ---------- Fail closed: outside rows that point AT the run's data ----------
  // The organisation and user cascades would delete or detach (set NULL)
  // these. They belong to someone else, so cleanup refuses instead.
  const pointingIn: string[] = [];
  if (orgIds.length > 0) {
    const seasonIds = (await qb.select({ id: seasons.id }).from(seasons).where(inArray(seasons.organizationId, orgIds))).map((r) => r.id);
    const seriesIds = (await qb.select({ id: series.id }).from(series).where(inArray(series.organizationId, orgIds))).map((r) => r.id);

    if (seasonIds.length > 0) {
      const foreignSeries = await n(
        qb.select({ n: count }).from(series).where(and(inArray(series.seasonId, seasonIds), notInArray(series.organizationId, orgIds)))
      );
      if (foreignSeries) pointingIn.push(`${foreignSeries} series of another organisation use this run's seasons`);
    }
    const sessionLinks = [
      ...(seasonIds.length ? [inArray(tennisSessions.seasonId, seasonIds)] : []),
      ...(seriesIds.length ? [inArray(tennisSessions.seriesId, seriesIds)] : []),
      ...(sessionIds.length ? [inArray(tennisSessions.parentSessionId, sessionIds)] : []),
    ];
    if (sessionLinks.length > 0) {
      const foreignSessions = await n(
        qb.select({ n: count }).from(tennisSessions).where(and(or(...sessionLinks), notInArray(tennisSessions.organizationId, orgIds)))
      );
      if (foreignSessions) pointingIn.push(`${foreignSessions} session(s) of another organisation are linked to this run's seasons, series or sessions`);
    }
    const foreignPartner = await n(qb.select({ n: count }).from(externalActivities).where(inArray(externalActivities.partnerId, orgIds)));
    if (foreignPartner) pointingIn.push(`${foreignPartner} discovery activit(y/ies) list this run's organisation as partner`);

    const orgMessages = await n(
      qb
        .select({ n: count })
        .from(messages)
        .where(
          and(
            inArray(messages.relatedOrganizationId, orgIds),
            or(isNull(messages.senderUserId), notInArray(messages.senderUserId, userIds)),
            notInArray(messages.recipientId, userIds)
          )
        )
    );
    if (orgMessages) pointingIn.push(`${orgMessages} message(s) between other users reference this run's organisation`);
  }
  if (sessionIds.length > 0) {
    const history = await n(
      qb.select({ n: count }).from(tournamentHistory).where(and(inArray(tournamentHistory.sessionId, sessionIds), notInArray(tournamentHistory.userId, userIds)))
    );
    if (history) pointingIn.push(`${history} tournament history entr(y/ies) of other users reference this run's sessions`);
    const duplicates = await n(qb.select({ n: count }).from(externalActivities).where(inArray(externalActivities.duplicateOfSessionId, sessionIds)));
    if (duplicates) pointingIn.push(`${duplicates} discovery activit(y/ies) are marked as duplicates of this run's sessions`);
    const sessionMessages = await n(
      qb
        .select({ n: count })
        .from(messages)
        .where(
          and(
            inArray(messages.relatedSessionId, sessionIds),
            or(isNull(messages.senderUserId), notInArray(messages.senderUserId, userIds)),
            notInArray(messages.recipientId, userIds)
          )
        )
    );
    if (sessionMessages) pointingIn.push(`${sessionMessages} message(s) between other users reference this run's sessions`);
  }
  const reviewedElsewhere = await n(
    qb
      .select({ n: count })
      .from(matches)
      .where(
        and(
          or(inArray(matches.reportedBy, userIds), inArray(matches.confirmedBy, userIds)),
          sessionIds.length > 0 ? notInArray(matches.sessionId, sessionIds) : sql`true`
        )
      )
  );
  if (reviewedElsewhere) pointingIn.push(`${reviewedElsewhere} match(es) outside this run were reported or confirmed by run users`);
  refusals.push(...pointingIn);

  return plan;
}

/** Storage paths to remove - strictly inside this run's users' own folders. */
export async function listRunStorage(storage: RunStorage, plan: RunCleanupPlan): Promise<string[]> {
  const allowed = new Set(plan.storagePrefixes);
  const paths: string[] = [];
  for (const prefix of plan.storagePrefixes) {
    for (const path of await storage.listFiles(prefix)) {
      const owner = Array.from(allowed).find((candidate) => path.startsWith(candidate));
      if (!owner || path.includes("..") || path.startsWith("/")) {
        throw new RunCleanupError(`storage listing returned a path outside this run's folders: ${path}`);
      }
      paths.push(path);
    }
  }
  return Array.from(new Set(paths));
}

export interface RunCleanupOptions {
  /** Delete the run's uploaded files. false -> list only, and refuse if any exist. */
  removeFiles: boolean;
}

export interface RunCleanupResult {
  plan: RunCleanupPlan;
  storage: { removed: number; skipped: boolean };
  organizations: OrganizationCascadeResult | null;
  usersDeleted: number;
}

export async function applyRunCleanup(
  db: CleanupDb,
  runId: string,
  storage: RunStorage | null,
  options: RunCleanupOptions
): Promise<RunCleanupResult> {
  const plan = await planRunCleanup(db, runId);
  if (plan.refusals.length > 0) {
    throw new RunCleanupError(`refusing to clean up: ${plan.refusals.join("; ")}`, plan);
  }
  if (plan.users.length === 0) {
    return { plan, storage: { removed: 0, skipped: true }, organizations: null, usersDeleted: 0 };
  }

  // 1. Files first - if this fails the users still exist and a retry finishes the job.
  if (!storage) {
    throw new RunCleanupError("no storage adapter - cannot prove the run left no uploaded files, nothing deleted", plan);
  }
  const paths = await listRunStorage(storage, plan);
  if (paths.length > 0 && !options.removeFiles) {
    throw new RunCleanupError(
      `this run has ${paths.length} uploaded file(s) but file cleanup is disabled on this server (E2E_STORAGE_CLEANUP) - nothing deleted`,
      plan
    );
  }
  let removed = 0;
  if (paths.length > 0) {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      await storage.remove(batch);
      removed += batch.length;
    }
  }

  // 2. Database, in one transaction that re-checks the plan.
  const expected = plan.users.map((user) => user.id).sort().join(",");
  const outcome = await db.transaction(async (tx) => {
    const again = await planRunCleanup(tx, runId);
    if (again.refusals.length > 0) throw new RunCleanupError(`refusing to clean up: ${again.refusals.join("; ")}`, again);
    if (again.users.map((user) => user.id).sort().join(",") !== expected) {
      throw new RunCleanupError("this run's users changed during cleanup (is the run still in progress?) - nothing deleted", again);
    }
    const organizationsResult = await cascadeDeleteOrganizations(tx, again.organizationIds);
    const usersDeleted = await deleteUserRows(tx, again.users.map((user) => user.id));
    return { organizations: organizationsResult, usersDeleted };
  });

  return { plan, storage: { removed, skipped: paths.length === 0 }, ...outcome };
}

export interface RunResidue {
  runId: string;
  users: number;
  oldestCreatedAt: string | null;
}

/** Read-only: run ids that still own test users (e.g. a cancelled run). */
export async function listRunResidue(qb: Executor): Promise<RunResidue[]> {
  const rows = await qb
    .select({ email: users.email, createdAt: users.createdAt, isTestUser: users.isTestUser })
    .from(users)
    .where(sql`lower(${users.email}) like 'e2e-run-%@tennisconnect.test'`);
  const byRun = new Map<string, RunResidue>();
  for (const row of rows) {
    const classified = classifyEmail(row.email);
    if (classified.kind !== "run" || !classified.runId || row.isTestUser !== true) continue;
    const entry = byRun.get(classified.runId) ?? { runId: classified.runId, users: 0, oldestCreatedAt: null };
    entry.users += 1;
    const created = row.createdAt ? new Date(row.createdAt).toISOString() : null;
    if (created && (!entry.oldestCreatedAt || created < entry.oldestCreatedAt)) entry.oldestCreatedAt = created;
    byRun.set(classified.runId, entry);
  }
  return Array.from(byRun.values()).sort((a, b) => (a.oldestCreatedAt ?? "").localeCompare(b.oldestCreatedAt ?? ""));
}
