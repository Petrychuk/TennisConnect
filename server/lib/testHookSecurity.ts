// Security rules for /api/test-hooks/* (server/routes/testHooks.ts).
//
// Deliberately free of Express / storage / env imports so every rule here
// is unit-testable without a database (server/lib/testHookSecurity.test.ts).
//
// Three layers, ALL required on every request:
//
// 1. Environment - test hooks exist only on development and staging.
//    DB_ENV=production is rejected outright, whatever NODE_ENV says
//    (staging and production both run `npm start` = NODE_ENV=production,
//    so NODE_ENV alone can never be trusted to mean "not prod").
//
// 2. Shared secret - the caller must send E2E_TEST_HOOK_SECRET in the
//    X-E2E-Test-Secret header. If the server has no usable secret
//    configured, the hooks are disabled (fail closed). There is no
//    local-development bypass: `npm run dev` needs the secret too.
//
// 3. Test-data boundaries - hooks only ever act on test accounts
//    (users.isTestUser = true) and on Organiser Hub data owned by them.

import { createHash, timingSafeEqual } from "node:crypto";
import { SESSION_STATUS } from "@shared/constants/sessions";

// ---------- Configuration ----------

export const TEST_HOOK_SECRET_HEADER = "x-e2e-test-secret";
export const TEST_HOOK_SECRET_ENV = "E2E_TEST_HOOK_SECRET";

// Long enough that it can't be guessed; `openssl rand -hex 32` gives 64.
export const MIN_TEST_HOOK_SECRET_LENGTH = 32;

// Reserved by RFC 2606 - mail to *.test is undeliverable, so no real
// person can ever own or verify an account on this domain.
export const RESERVED_TEST_EMAIL_DOMAIN = "tennisconnect.test";

export interface TestHookConfig {
  nodeEnv: string | undefined;
  dbEnv: string | undefined;
  secret: string | undefined;
}

function normalise(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Development or staging, and never production. */
export function testHooksEnvironmentAllowed(config: Pick<TestHookConfig, "nodeEnv" | "dbEnv">): boolean {
  const dbEnv = normalise(config.dbEnv);
  if (dbEnv === "production") return false;
  return normalise(config.nodeEnv) === "development" || dbEnv === "staging";
}

export function isUsableServerSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.trim().length >= MIN_TEST_HOOK_SECRET_LENGTH;
}

/**
 * Constant-time comparison. Both sides are hashed first so the
 * comparison is always over 32 equal-length buffers - timingSafeEqual
 * on the raw values would throw (and leak) on a length mismatch.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export type TestHookAccess =
  | { ok: true }
  | {
      ok: false;
      status: 404 | 401;
      reason: "environment" | "not-configured" | "missing-secret" | "invalid-secret";
    };

/**
 * 404 when the hooks are disabled (wrong environment, or no server
 * secret) so they look like they don't exist; 401 when they're enabled
 * but the caller didn't prove it holds the secret.
 */
export function checkTestHookAccess(config: TestHookConfig, providedHeader: unknown): TestHookAccess {
  if (!testHooksEnvironmentAllowed(config)) {
    return { ok: false, status: 404, reason: "environment" };
  }

  if (!isUsableServerSecret(config.secret)) {
    return { ok: false, status: 404, reason: "not-configured" };
  }

  if (typeof providedHeader !== "string" || providedHeader.length === 0) {
    return { ok: false, status: 401, reason: "missing-secret" };
  }

  if (!secretsMatch(providedHeader, config.secret)) {
    return { ok: false, status: 401, reason: "invalid-secret" };
  }

  return { ok: true };
}

// ---------- Test accounts ----------

export function isReservedTestEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const at = email.lastIndexOf("@");
  return at > 0 && email.slice(at + 1).trim().toLowerCase() === RESERVED_TEST_EMAIL_DOMAIN;
}

/**
 * Whether a NEW registration should be flagged isTestUser. Only on an
 * environment where test hooks may run (never production), and only for
 * the reserved test domain - this is what lets accounts created by the
 * Playwright registration flow receive verification tokens from
 * /api/test-hooks/issue-verification-token, while ordinary staging users
 * cannot.
 */
export function shouldFlagRegistrationAsTestUser(
  email: unknown,
  config: Pick<TestHookConfig, "nodeEnv" | "dbEnv">
): boolean {
  return testHooksEnvironmentAllowed(config) && isReservedTestEmail(email);
}

// ---------- seed-session validation ----------

export interface SeedUserRecord {
  id: string;
  isTestUser: boolean;
}

export interface SeedLookups {
  getUser(id: string): Promise<SeedUserRecord | undefined>;
  getOrganizationById(id: string): Promise<{ id: string; ownerId: string } | undefined>;
  getSeasonById(id: string): Promise<{ id: string; organizationId: string } | undefined>;
  getSeriesById(id: string): Promise<{ id: string; organizationId: string; seasonId: string } | undefined>;
}

export interface SeedSessionPlan {
  session: {
    organizationId: string;
    createdBy: string;
    title: string;
    startAt: Date;
    status: string;
    seasonId?: string;
    seriesId?: string;
    type?: string;
    maxParticipants?: number;
    waitingListEnabled?: boolean;
  };
  registrations: { userId: string; checkedIn: boolean }[];
  matches: { teamAIds: string[]; teamBIds: string[]; teamAGames: number; teamBGames: number }[];
}

export type SeedValidation =
  | { ok: true; plan: SeedSessionPlan }
  | { ok: false; status: 400 | 403; message: string };

export const MAX_SEED_REGISTRATIONS = 64;
export const MAX_SEED_MATCHES = 64;
const MAX_TEAM_SIZE = 4;
const MAX_GAMES = 99;

const bad = (message: string): SeedValidation => ({ ok: false, status: 400, message });
const forbidden = (message: string): SeedValidation => ({ ok: false, status: 403, message });

function isNonEmptyString(value: unknown, max = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function optionalId(value: unknown): string | undefined | null {
  // Mirrors the previous `seasonId || undefined` behaviour for "" / null.
  if (value === undefined || value === null || value === "") return undefined;
  return isNonEmptyString(value) ? value : null;
}

function isGames(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_GAMES;
}

/**
 * Validates a seed-session request body and checks every referenced id
 * against the test-data boundary:
 *  - createdBy is an existing test user;
 *  - the organization exists and is owned by createdBy;
 *  - season / series exist and belong to that organization (and the
 *    series to that season, when both are given);
 *  - every registration and match participant is an existing test user.
 * Unknown ids and non-test ids get the same 403, so this can't be used to
 * probe which real ids exist.
 */
export async function validateSeedSessionInput(body: unknown, lookups: SeedLookups): Promise<SeedValidation> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return bad("Request body must be a JSON object");
  }
  const input = body as Record<string, unknown>;

  // ---------- Shape ----------

  const { organizationId, createdBy, title, startAt } = input;
  if (!organizationId || !createdBy || !title || !startAt) {
    return bad("organizationId, createdBy, title and startAt are required");
  }
  if (!isNonEmptyString(organizationId) || !isNonEmptyString(createdBy) || !isNonEmptyString(title)) {
    return bad("organizationId, createdBy and title must be non-empty strings");
  }

  const start = typeof startAt === "string" || typeof startAt === "number" ? new Date(startAt) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return bad("startAt must be a valid date");
  }

  const status = input.status === undefined ? "completed" : input.status;
  if (typeof status !== "string" || !(SESSION_STATUS as readonly string[]).includes(status)) {
    return bad(`status must be one of: ${SESSION_STATUS.join(", ")}`);
  }

  const seasonId = optionalId(input.seasonId);
  const seriesId = optionalId(input.seriesId);
  if (seasonId === null || seriesId === null) {
    return bad("seasonId and seriesId must be strings when provided");
  }

  if (input.type !== undefined && !isNonEmptyString(input.type, 50)) {
    return bad("type must be a short string");
  }

  const registrationInput = input.registrations ?? [];
  const matchInput = input.matches ?? [];
  if (!Array.isArray(registrationInput) || registrationInput.length > MAX_SEED_REGISTRATIONS) {
    return bad(`registrations must be an array of at most ${MAX_SEED_REGISTRATIONS} entries`);
  }
  if (!Array.isArray(matchInput) || matchInput.length > MAX_SEED_MATCHES) {
    return bad(`matches must be an array of at most ${MAX_SEED_MATCHES} entries`);
  }

  const registrations: SeedSessionPlan["registrations"] = [];
  const registeredIds = new Set<string>();
  for (const entry of registrationInput) {
    const r = entry as { userId?: unknown; checkedIn?: unknown } | null;
    if (!r || typeof r !== "object" || !isNonEmptyString(r.userId)) {
      return bad("each registration needs a userId string");
    }
    if (registeredIds.has(r.userId)) {
      return bad("registrations contain a duplicate userId");
    }
    registeredIds.add(r.userId);
    registrations.push({ userId: r.userId, checkedIn: !!r.checkedIn });
  }

  const matches: SeedSessionPlan["matches"] = [];
  for (const entry of matchInput) {
    const m = entry as Record<string, unknown> | null;
    if (!m || typeof m !== "object") return bad("each match must be an object");
    const { teamAIds, teamBIds, teamAGames, teamBGames } = m;
    const validTeam = (team: unknown): team is string[] =>
      Array.isArray(team) &&
      team.length >= 1 &&
      team.length <= MAX_TEAM_SIZE &&
      team.every((id) => isNonEmptyString(id));
    if (!validTeam(teamAIds) || !validTeam(teamBIds)) {
      return bad(`each match needs teamAIds and teamBIds with 1-${MAX_TEAM_SIZE} user ids`);
    }
    if (teamAIds.some((id) => teamBIds.includes(id))) {
      return bad("a player cannot be on both teams of a match");
    }
    if (!isGames(teamAGames) || !isGames(teamBGames)) {
      return bad(`teamAGames and teamBGames must be integers from 0 to ${MAX_GAMES}`);
    }
    matches.push({ teamAIds, teamBIds, teamAGames, teamBGames });
  }

  // ---------- Test-data boundaries ----------

  const creator = await lookups.getUser(createdBy);
  if (!creator || creator.isTestUser !== true) {
    return forbidden("createdBy must be an existing test user");
  }

  const organization = await lookups.getOrganizationById(organizationId);
  if (!organization || organization.ownerId !== creator.id) {
    return forbidden("organizationId must be an organization owned by createdBy");
  }

  if (seasonId) {
    const season = await lookups.getSeasonById(seasonId);
    if (!season || season.organizationId !== organization.id) {
      return forbidden("seasonId must belong to organizationId");
    }
  }

  if (seriesId) {
    const series = await lookups.getSeriesById(seriesId);
    if (!series || series.organizationId !== organization.id || (seasonId && series.seasonId !== seasonId)) {
      return forbidden("seriesId must belong to organizationId (and to seasonId, when given)");
    }
  }

  const participantIds = new Set<string>(registeredIds);
  for (const m of matches) {
    for (const id of m.teamAIds.concat(m.teamBIds)) participantIds.add(id);
  }
  for (const id of Array.from(participantIds)) {
    const user = await lookups.getUser(id);
    if (!user || user.isTestUser !== true) {
      return forbidden("every registration and match participant must be an existing test user");
    }
  }

  // ---------- Normalised plan ----------

  return {
    ok: true,
    plan: {
      session: {
        organizationId,
        createdBy,
        title,
        startAt: start,
        status,
        seasonId,
        seriesId,
        type: input.type as string | undefined,
        maxParticipants: typeof input.maxParticipants === "number" ? input.maxParticipants : undefined,
        waitingListEnabled: typeof input.waitingListEnabled === "boolean" ? input.waitingListEnabled : undefined,
      },
      registrations,
      matches,
    },
  };
}
