// npx tsx --test server/seeds/e2e/e2eSeed.test.ts   (or: npm run test:staging-fixtures)
//
// Stage 2 E2E fixture seed: identities, run tokens, deterministic fixtures,
// the Staging-only gate, and the seeder against an IN-MEMORY store.
// No database, network, email or Stripe - nothing here can reach Staging.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASELINE_IDENTITIES,
  classifyEmail,
  generateRunId,
  isOwnedByRun,
  isSeedOwnedEmail,
  isValidRunId,
  runScopedEmail,
} from "./identities";
import {
  COACHES_PER_PAGE,
  FIXTURE_CONTACT_EMAIL,
  PLAYERS_PER_PAGE,
  FUTURE_HORIZON_DAYS,
  buildFixtureSet,
  fixtureInvariantProblems,
  fixtureValidUntil,
  type FixtureSet,
} from "./fixtures";
import {
  SeedSafetyError,
  assertConnectedDatabase,
  assertSeedTarget,
  parseAnchor,
  PG_OVERRIDE_ENVS,
  describeDatabaseUrl,
  parseDatabaseTarget,
  parseSeedArgs,
  readBaselinePasswords,
} from "./safety";
import { applySeed, planSeed, requiredPasswordEnvs, type SeedStore, type UserWrite } from "./seeder";
import { comparePasswords, hashPassword } from "../../lib/passwords";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANCHOR = new Date("2026-11-02T00:00:00Z");
const STAGING_URL = "postgresql://seed_user:not-a-real-secret@staging-db.example.internal:5432/tc_staging";
const STAGING_LABEL = "seed_user@staging-db.example.internal/tc_staging";
// Supabase-style: Staging and Production behind ONE pooler host, both "postgres".
const POOLER = "aws-0-ap-southeast-2.pooler.example.test";
const POOLER_STAGING_URL = `postgresql://postgres.stagingref:not-a-real-secret@${POOLER}:6543/postgres`;
const POOLER_PROD_URL = `postgresql://postgres.prodref:not-a-real-secret@${POOLER}:6543/postgres`;

function stagingEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    DB_ENV: "staging",
    NODE_ENV: "development",
    DATABASE_URL: STAGING_URL,
    E2E_APPROVED_STAGING_DB: STAGING_LABEL,
    ...overrides,
  };
}

// Synthetic login values (never real credentials): deterministic, unique per
// label and >= 16 characters, derived at runtime so the source holds no
// credential-shaped literals for secret scanners to flag.
const synthetic = (label: string) => `synthetic-${createHash("sha256").update(`e2eSeed.test ${label}`).digest("hex").slice(0, 24)}`;
const PASSWORDS = new Map(BASELINE_IDENTITIES.map(identity => [identity.passwordEnv, synthetic(`baseline ${identity.role}`)]));
const CHANGED_VALUE = synthetic("changed player value");
const ROTATED_VALUE = synthetic("rotated player value");

// ---------- In-memory SeedStore ----------

interface FakeUser extends UserWrite {
  id: string;
  isTestUser: boolean;
}

class MemoryStore implements SeedStore {
  users = new Map<string, FakeUser>();
  orgs = new Map<string, { id: string; slug: string; email: string | null; ownerId: string; name: string }>();
  clubs = new Map<string, { id: string; slug: string; email: string | null; name: string }>();
  tournaments = new Map<string, { id: string; slug: string; email: string | null; name: string }>();
  keyed = new Map<string, Map<string, string>>(); // table -> natural key -> id
  writes = 0;
  private nextId = 1;

  id(prefix: string) { return `${prefix}-${this.nextId++}`; }

  addRealUser(email: string, slug: string, extra: Partial<FakeUser> = {}): FakeUser {
    const user: FakeUser = {
      id: this.id("real"), email, slug, name: "Real Person", role: "player",
      isOrganizer: false, isAdmin: false, isHidden: false, passwordHash: "real-hash", isTestUser: false, ...extra,
    };
    this.users.set(user.id, user);
    return user;
  }

  snapshot() {
    return JSON.stringify({
      users: Array.from(this.users.values()), orgs: Array.from(this.orgs.values()), clubs: Array.from(this.clubs.values()),
      tournaments: Array.from(this.tournaments.values()), keyed: Array.from(this.keyed).map(([table, map]) => [table, Array.from(map)]),
    });
  }

  private ensure(table: string, key: string): { id: string; created: boolean } {
    let map = this.keyed.get(table);
    if (!map) this.keyed.set(table, (map = new Map()));
    const existing = map.get(key);
    if (existing) return { id: existing, created: false };
    const id = this.id(table);
    map.set(key, id);
    this.writes++;
    return { id, created: true };
  }

  count(table: string) { return this.keyed.get(table)?.size ?? 0; }

  private find(pred: (user: FakeUser) => boolean) {
    const user = Array.from(this.users.values()).find(pred);
    return user && { id: user.id, email: user.email, slug: user.slug, isTestUser: user.isTestUser };
  }

  async findUserByEmail(email: string) { return this.find(user => user.email === email); }
  async findUserBySlug(slug: string) { return this.find(user => user.slug === slug); }
  async findUserById(id: string) { return this.find(user => user.id === id); }
  async findOrganizationBySlug(slug: string) { return this.orgs.get(slug); }
  async findClubBySlug(slug: string) { return this.clubs.get(slug); }
  async findTournamentBySlug(slug: string) { return this.tournaments.get(slug); }

  async createTestUser(user: UserWrite) {
    const id = this.id("user");
    this.users.set(id, { ...user, id, isTestUser: true });
    this.writes++;
    return id;
  }
  async updateTestUser(id: string, user: UserWrite) {
    const existing = this.users.get(id);
    if (!existing || !existing.isTestUser) throw new Error("fake store: update of non-test user");
    this.users.set(id, { ...existing, ...user, passwordHash: user.passwordHash ?? existing.passwordHash });
    this.writes++;
  }
  async upsertPlayerProfile(userId: string) { return this.ensure("playerProfiles", userId).created; }
  async upsertCoachProfile(userId: string) { return this.ensure("coachProfiles", userId).created; }
  async upsertOrganization(existingId: string | undefined, org: FixtureSet["organization"], ownerId: string) {
    if (existingId) {
      this.orgs.set(org.slug, { ...this.orgs.get(org.slug)!, name: org.name, ownerId });
      this.writes++;
      return { id: existingId, created: false };
    }
    const row = { id: this.id("org"), slug: org.slug, email: org.email, ownerId, name: org.name };
    this.orgs.set(org.slug, row);
    this.writes++;
    return { id: row.id, created: true };
  }
  async ensureOrganizationOwner(orgId: string, userId: string) { return this.ensure("orgMembers", `${orgId}:${userId}`).created; }
  async ensureCommunityMembership(orgId: string, userId: string) { return this.ensure("community", `${orgId}:${userId}`).created; }
  async upsertClub(existingId: string | undefined, club: FixtureSet["clubs"][number]) {
    if (existingId) { this.writes++; return { id: existingId, created: false }; }
    const row = { id: this.id("club"), slug: club.slug, email: club.email, name: club.name };
    this.clubs.set(club.slug, row);
    this.writes++;
    return { id: row.id, created: true };
  }
  async ensureClubFollow(userId: string, clubId: string) { return this.ensure("clubFollows", `${userId}:${clubId}`).created; }
  async upsertTournament(existingId: string | undefined, tournament: FixtureSet["tournaments"][number]) {
    if (existingId) { this.writes++; return { id: existingId, created: false }; }
    const row = { id: this.id("tournament"), slug: tournament.slug, email: tournament.email, name: tournament.name };
    this.tournaments.set(tournament.slug, row);
    this.writes++;
    return { id: row.id, created: true };
  }
  async ensureSeason(orgId: string, _by: string, season: FixtureSet["season"]) { return this.ensure("seasons", `${orgId}:${season.name}`); }
  async ensureSeries(orgId: string, _season: string, _by: string, series: FixtureSet["series"]) { return this.ensure("series", `${orgId}:${series.name}`); }
  async upsertSession(orgId: string, _by: string, session: FixtureSet["sessions"][number]) { return this.ensure("sessions", `${orgId}:${session.title}`); }
  async ensureRegistration(sessionId: string, userId: string) { return this.ensure("registrations", `${sessionId}:${userId}`).created; }
  async ensureRound(sessionId: string, roundNumber: number) { return this.ensure("rounds", `${sessionId}:${roundNumber}`); }
  async ensureMatch(sessionId: string, roundId: string, match: { courtLabel: string }) {
    return this.ensure("matches", `${sessionId}:${roundId}:${match.courtLabel}`).created;
  }
  async ensureMessage(message: { senderId: string; recipientId: string; content: string }) {
    return this.ensure("messages", `${message.senderId}:${message.recipientId}:${message.content}`).created;
  }
}

function deps() {
  let n = 0;
  return { hashPassword, randomPassword: () => `random-${n++}-${Math.random()}`, baselinePasswords: PASSWORDS };
}

// ---------- Identities + run tokens ----------

test("classifyEmail: exact whole-address matches only", () => {
  assert.equal(classifyEmail("e2e-player@tennisconnect.test").kind, "baseline");
  assert.equal(classifyEmail("E2E-Admin@TennisConnect.test").kind, "baseline");
  assert.equal(classifyEmail("e2e-fixture-coach-07@tennisconnect.test").kind, "fixture");
  for (const email of [
    "e2e-player@tennisconnect.test.evil.com", "x-e2e-player@tennisconnect.test", "e2e-player@gmail.com",
    "e2e-player@tennisconnect.test,real@gmail.com", "e2e-superuser@tennisconnect.test", "player@test.com", 42, undefined,
  ]) {
    assert.equal(classifyEmail(email).kind, "other", String(email));
    assert.equal(isSeedOwnedEmail(email), false, String(email));
  }
});

test("run tokens: unguessable format, scoped emails, ownership by exact run only", () => {
  const runId = generateRunId(1_790_000_000_000, Buffer.from("0123456789abcdef", "hex"));
  assert.ok(isValidRunId(runId), runId);
  assert.equal(isValidRunId("r123"), false);
  assert.equal(isValidRunId("rabcdefg-XYZ"), false);
  const email = runScopedEmail(runId, "Player One!");
  assert.equal(email, `e2e-run-${runId}-player-one@tennisconnect.test`);
  assert.deepEqual(classifyEmail(email), { kind: "run", runId });
  assert.equal(isSeedOwnedEmail(email), false, "run-scoped data is never seed-owned");
  assert.equal(isOwnedByRun(email, runId), true);
  assert.equal(isOwnedByRun(email, generateRunId()), false);
  assert.equal(isOwnedByRun("e2e-player@tennisconnect.test", runId), false);
  assert.throws(() => runScopedEmail("bad", "x"));
  assert.throws(() => runScopedEmail(runId, "!!!"));
  assert.notEqual(generateRunId(), generateRunId());
});

// ---------- Fixtures ----------

test("fixtures are deterministic for the same anchor", () => {
  assert.deepEqual(buildFixtureSet(ANCHOR), buildFixtureSet(new Date(ANCHOR)));
  assert.notDeepEqual(buildFixtureSet(ANCHOR).sessions[0].startAt, buildFixtureSet(new Date("2027-01-01T00:00:00Z")).sessions[0].startAt);
});

test("fixtures satisfy invariants and pagination needs", () => {
  const set = buildFixtureSet(ANCHOR);
  assert.deepEqual(fixtureInvariantProblems(set), []);
  const listedCoaches = set.users.filter(user => user.listed && user.userRole === "coach" && user.coachProfile);
  const listedPlayers = set.users.filter(user => user.listed && user.userRole === "player" && user.playerProfile);
  assert.ok(listedCoaches.length > COACHES_PER_PAGE, `coaches ${listedCoaches.length} > ${COACHES_PER_PAGE}`);
  assert.ok(listedPlayers.length > PLAYERS_PER_PAGE, `players ${listedPlayers.length} > ${PLAYERS_PER_PAGE}`);
  assert.ok(set.users.filter(user => user.kind === "fixture" && user.userRole === "player").length >= 24);
  assert.ok(set.users.filter(user => user.kind === "fixture" && user.userRole === "coach").length >= 20);
  assert.deepEqual(set.users.filter(user => user.isAdmin).map(user => user.email), ["e2e-admin@tennisconnect.test"]);
  for (const user of set.users) {
    assert.ok(isSeedOwnedEmail(user.email), user.email);
    assert.equal(user.passwordEnv !== null, user.kind === "baseline", `${user.email}: only baseline accounts log in`);
  }
  assert.ok(set.sessions.some(session => session.registrations.some(r => r.status === "waitlisted")), "waitlist covered");
  assert.ok(set.sessions.some(session => session.rounds.length > 0), "rounds/scores covered");
});

test("fixture invariants catch a broken set", () => {
  const set = buildFixtureSet(ANCHOR);
  set.users[1] = { ...set.users[1], email: "someone@gmail.com" };
  set.users[2] = { ...set.users[2], isAdmin: true };
  const problems = fixtureInvariantProblems(set);
  assert.ok(problems.length >= 2, problems.join("; "));
});

// ---------- Gate: fails closed on anything missing, ambiguous or inconsistent ----------

const refuses = (env: Record<string, string | undefined>, argv: string[] = [], pattern: RegExp = /Refusing to seed/) =>
  assert.throws(() => assertSeedTarget(env, parseSeedArgs(argv)), (error: Error) => {
    assert.ok(error instanceof SeedSafetyError, error.message);
    assert.match(error.message, pattern);
    return true;
  });

test("gate: a complete, consistent Staging configuration passes (dry run by default)", () => {
  const result = assertSeedTarget(stagingEnv(), parseSeedArgs([]));
  assert.equal(result.mode, "dry-run");
  assert.equal(result.target.label, STAGING_LABEL);
});

test("gate: DB_ENV must be exactly staging", () => {
  for (const dbEnv of [undefined, "", "production", "prod", "unknown", "Staging", "STAGING", "staging ", " staging", "staging\n"]) {
    refuses(stagingEnv({ DB_ENV: dbEnv }), [], /DB_ENV/);
  }
});

test("gate: NODE_ENV must be exactly development (so .env, the Production config, is never loaded)", () => {
  for (const nodeEnv of [undefined, "", "production", "test", "Development"]) refuses(stagingEnv({ NODE_ENV: nodeEnv }), [], /NODE_ENV/);
});

test("gate: refuses CI in any form", () => {
  for (const ci of [{ CI: "true" }, { CI: "1" }, { CI: "false" }, { GITHUB_ACTIONS: "true" }]) refuses(stagingEnv(ci), [], /CI/);
});

test("gate: refuses every pg/libpq override variable", () => {
  for (const name of PG_OVERRIDE_ENVS) refuses(stagingEnv({ [name]: "prod-db.example.internal" }), [], new RegExp(name));
});

test("gate: DATABASE_URL must be a single, explicit, unambiguous postgres URL", () => {
  const bad = [
    undefined,
    "",
    " " + STAGING_URL,
    "mysql://u:p@h.example.internal/db",
    "not a url",
    "postgresql://staging-db.example.internal/tc_staging",                         // no user (PGUSER/OS user would fill in)
    "postgresql://seed_user:x@staging-db.example.internal",                         // no database
    "postgresql://seed_user:x@staging-db.example.internal/tc/extra",                // two path segments
    "postgresql://seed_user:x@%2Fvar%2Frun%2Fpostgresql/tc_staging",                // unix socket
    "postgresql://seed_user:x@staging-db.example.internal/tc_staging?host=prod-db.example.internal",
    "postgresql://seed_user:x@staging-db.example.internal/tc_staging?dbname=postgres",
    "postgresql://seed_user:x@staging-db.example.internal/tc_staging?options=-csearch_path%3Dprod",
    "postgresql://seed_user:x@staging-db.example.internal/tc_staging?service=prod",
    "postgresql://seed_user:x@staging-db.example.internal/tc_staging?sslmode=require&sslmode=disable",
    "postgresql://seed_user:x@staging-db.example.internal/%ZZ",
  ];
  for (const url of bad) refuses(stagingEnv({ DATABASE_URL: url }), [], /DATABASE_URL/);
  // Non-routing parameters are fine.
  assert.doesNotThrow(() =>
    assertSeedTarget(stagingEnv({ DATABASE_URL: `${STAGING_URL}?sslmode=require&application_name=e2e-seed` }), parseSeedArgs([]))
  );
});

test("gate: E2E_APPROVED_STAGING_DB must be set, well-formed and match", () => {
  refuses(stagingEnv({ E2E_APPROVED_STAGING_DB: undefined }), [], /E2E_APPROVED_STAGING_DB is not set/);
  refuses(stagingEnv({ E2E_APPROVED_STAGING_DB: "   " }), [], /E2E_APPROVED_STAGING_DB is not set/);
  for (const malformed of ["staging-db.example.internal/tc_staging", "seed_user@staging-db.example.internal", "a@b/c/d", "*"]) {
    refuses(stagingEnv({ E2E_APPROVED_STAGING_DB: malformed }), [], /must look like/);
  }
  refuses(stagingEnv({ E2E_APPROVED_STAGING_DB: "seed_user@other-db.example.internal/tc_staging" }), [], /not the approved/);
  refuses(stagingEnv({ E2E_APPROVED_STAGING_DB: "other_user@staging-db.example.internal/tc_staging" }), [], /not the approved/);
  // Case/padding differences in the approved value are normalised, not ambiguous.
  assert.doesNotThrow(() => assertSeedTarget(stagingEnv({ E2E_APPROVED_STAGING_DB: ` ${STAGING_LABEL.toUpperCase()} ` }), parseSeedArgs([])));
});

test("gate: Supabase-style shared pooler - the project ref (user) tells Staging and Production apart", () => {
  const stagingLabel = `postgres.stagingref@${POOLER}/postgres`;
  const pooled = (overrides: Record<string, string | undefined> = {}) =>
    stagingEnv({ DATABASE_URL: POOLER_STAGING_URL, E2E_APPROVED_STAGING_DB: stagingLabel, ...overrides });
  assert.equal(assertSeedTarget(pooled({ PROD_DATABASE_URL: POOLER_PROD_URL }), parseSeedArgs([])).target.label, stagingLabel);
  // DATABASE_URL accidentally set to Production: approved label no longer matches.
  refuses(pooled({ DATABASE_URL: POOLER_PROD_URL }), [], /not the approved/);
  // Operator approved the Production identity by mistake: PROD_DATABASE_URL catches it.
  refuses(
    pooled({ DATABASE_URL: POOLER_PROD_URL, E2E_APPROVED_STAGING_DB: `postgres.prodref@${POOLER}/postgres`, PROD_DATABASE_URL: POOLER_PROD_URL }),
    [],
    /PROD_DATABASE_URL/
  );
});

test("gate: PROD_DATABASE_URL must be parseable and different (identity and project ref)", () => {
  refuses(stagingEnv({ PROD_DATABASE_URL: STAGING_URL }), [], /PROD_DATABASE_URL/);
  refuses(stagingEnv({ PROD_DATABASE_URL: "postgresql://seed_user:x@other-host.example.internal/other" }), [], /PROD_DATABASE_URL/);
  refuses(stagingEnv({ PROD_DATABASE_URL: "garbage" }), [], /PROD_DATABASE_URL is set but/);
  refuses(stagingEnv({ PROD_DATABASE_URL: "postgresql://prod_user:x@prod.example.internal/tc?host=x" }), [], /PROD_DATABASE_URL is set but/);
  assert.doesNotThrow(() =>
    assertSeedTarget(stagingEnv({ PROD_DATABASE_URL: "postgresql://prod_user:x@prod-db.example.internal/tc_prod" }), parseSeedArgs([]))
  );
});

test("gate: --apply needs the exact typed confirmation; arguments are strict", () => {
  refuses(stagingEnv(), ["--apply"], /--confirm/);
  refuses(stagingEnv(), ["--apply", "--confirm=staging-db.example.internal/tc_staging"], /--confirm/);
  refuses(stagingEnv(), ["--apply", "--confirm="], /--confirm/);
  assert.equal(assertSeedTarget(stagingEnv(), parseSeedArgs(["--apply", `--confirm=${STAGING_LABEL}`])).mode, "apply");
  assert.throws(() => parseSeedArgs(["--force"]), /unknown argument/);
  assert.throws(() => parseSeedArgs(["--apply", "--dry-run"]), /mutually exclusive/);
  assert.throws(() => parseSeedArgs(["--confirm=a", "--confirm=b"]), /more than once/);
  assert.throws(() => parseSeedArgs(["--rotate-passwords"]), /only makes sense with --apply/);
});

test("gate: errors never contain the password", () => {
  const envs = [
    stagingEnv({ E2E_APPROVED_STAGING_DB: "x@y/z" }),
    stagingEnv({ DB_ENV: "production" }),
    stagingEnv({ DATABASE_URL: `${STAGING_URL}?host=evil.example.internal` }),
    stagingEnv({ PROD_DATABASE_URL: STAGING_URL }),
    stagingEnv({ PGHOST: "x" }),
  ];
  for (const env of envs) {
    try {
      assertSeedTarget(env, parseSeedArgs([]));
      assert.fail("expected refusal");
    } catch (error) {
      assert.ok(!(error as Error).message.includes("not-a-real-secret"), (error as Error).message);
    }
  }
  const described = describeDatabaseUrl(STAGING_URL);
  assert.ok("target" in described && !JSON.stringify(described).includes("not-a-real-secret"));
  assert.equal(parseDatabaseTarget(STAGING_URL)?.label, STAGING_LABEL);
});

test("connected-database check: database and user must match (Supabase pooler role accepted)", () => {
  const target = parseDatabaseTarget(STAGING_URL)!;
  assert.doesNotThrow(() => assertConnectedDatabase(target, { database: "tc_staging", user: "seed_user" }));
  assert.throws(() => assertConnectedDatabase(target, { database: "postgres", user: "seed_user" }), SeedSafetyError);
  assert.throws(() => assertConnectedDatabase(target, { database: "tc_staging", user: "postgres" }), SeedSafetyError);
  assert.throws(() => assertConnectedDatabase(target, { database: undefined, user: undefined }), SeedSafetyError);
  const pooled = parseDatabaseTarget(POOLER_STAGING_URL)!;
  assert.doesNotThrow(() => assertConnectedDatabase(pooled, { database: "postgres", user: "postgres" }));
  assert.doesNotThrow(() => assertConnectedDatabase(pooled, { database: "postgres", user: "postgres.stagingref" }));
  assert.throws(() => assertConnectedDatabase(pooled, { database: "postgres", user: "postgres.prodref" }), SeedSafetyError);
});

test("anchor: today by default; explicit anchors only within the last week", () => {
  const now = new Date("2026-10-24T15:30:00Z");
  assert.equal(parseAnchor(undefined, now).toISOString(), "2026-10-24T00:00:00.000Z");
  assert.equal(parseAnchor("2026-10-20", now).toISOString(), "2026-10-20T00:00:00.000Z");
  assert.equal(parseAnchor("2026-10-17", now).toISOString(), "2026-10-17T00:00:00.000Z");
  for (const stale of ["2026-10-16", "2025-01-01"]) assert.throws(() => parseAnchor(stale, now), /between 7 days ago and today/);
  assert.throws(() => parseAnchor("2026-10-25", now), /between 7 days ago and today/);
  assert.throws(() => parseAnchor("2026-02-30", now), /not a valid date/);
  assert.throws(() => parseAnchor("24/10/2026", now), /YYYY-MM-DD/);
});

test("baseline passwords: only the requested names, >=16 chars, values never in errors", () => {
  const names = BASELINE_IDENTITIES.map(identity => identity.passwordEnv);
  assert.equal(readBaselinePasswords(Object.fromEntries(PASSWORDS), names).size, names.length);
  assert.equal(readBaselinePasswords({}, []).size, 0, "nothing required when nothing will be written");
  try {
    readBaselinePasswords({ E2E_PLAYER_PASSWORD: "short-secret" }, names);
    assert.fail("expected refusal");
  } catch (error) {
    const message = (error as Error).message;
    assert.match(message, /E2E_ADMIN_PASSWORD/);
    assert.ok(!message.includes("short-secret"), message);
  }
});

// ---------- Dates ----------

test("dates: past items stay past; future items are >= the horizon after the anchor", () => {
  const set = buildFixtureSet(ANCHOR);
  const day = 86_400_000;
  const validUntil = fixtureValidUntil(set).getTime();
  assert.ok(validUntil >= ANCHOR.getTime() + FUTURE_HORIZON_DAYS * day, new Date(validUntil).toISOString());
  for (const session of set.sessions) {
    if (session.status === "completed") assert.ok(session.endAt.getTime() < ANCHOR.getTime(), session.key);
    else assert.ok(session.startAt.getTime() >= validUntil, session.key);
  }
  for (const tournament of set.tournaments) {
    const start = Date.parse(`${tournament.startDate}T00:00:00Z`);
    if (tournament.status === "past") assert.ok(start < ANCHOR.getTime(), tournament.slug);
    else assert.ok(start >= ANCHOR.getTime() + FUTURE_HORIZON_DAYS * day, tournament.slug);
  }
});

test("dates: even the oldest allowed anchor leaves months before anything expires", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const oldest = parseAnchor("2026-10-17", now);
  const remainingDays = (fixtureValidUntil(buildFixtureSet(oldest)).getTime() - now.getTime()) / 86_400_000;
  assert.ok(remainingDays > FUTURE_HORIZON_DAYS - 8, `${remainingDays} days`);
});

test("dates: invariants reject an upcoming item inside the horizon", () => {
  const set = buildFixtureSet(ANCHOR);
  const upcoming = set.sessions.find(session => session.status === "published")!;
  upcoming.startAt = new Date(ANCHOR.getTime() + 7 * 86_400_000);
  set.tournaments[0] = { ...set.tournaments[0], startDate: set.anchor };
  const problems = fixtureInvariantProblems(set);
  assert.ok(problems.some(problem => problem.includes(upcoming.key)), problems.join("; "));
  assert.ok(problems.some(problem => problem.includes(set.tournaments[0].slug)), problems.join("; "));
});

// ---------- Seeder against the in-memory store ----------

test("apply on an empty database creates everything; re-apply is idempotent", async () => {
  const set = buildFixtureSet(ANCHOR);
  const store = new MemoryStore();
  const first = await applySeed(set, store, deps());
  assert.equal(first.created.users, set.users.length);
  assert.equal(store.users.size, set.users.length);
  assert.equal(store.count("sessions"), set.sessions.length);
  assert.ok(store.count("registrations") > 0 && store.count("matches") > 0 && store.count("messages") === set.messages.length);

  const countsBefore = Array.from(store.keyed).map(([table, map]) => [table, map.size]);
  const second = await applySeed(set, store, deps());
  assert.equal(second.created.users ?? 0, 0);
  assert.equal(second.updated.users, set.users.length);
  assert.equal(store.users.size, set.users.length, "no duplicate users");
  assert.deepEqual(Array.from(store.keyed).map(([table, map]) => [table, map.size]), countsBefore, "no duplicate rows");
  assert.equal(store.orgs.size, 1);
  assert.equal(store.clubs.size, set.clubs.length);
  assert.equal(store.tournaments.size, set.tournaments.length);
});

test("seeded accounts: test-flagged, only e2e-admin is admin, baseline hashes verify", async () => {
  const store = new MemoryStore();
  await applySeed(buildFixtureSet(ANCHOR), store, deps());
  const users = Array.from(store.users.values());
  assert.ok(users.every(user => user.isTestUser));
  assert.deepEqual(users.filter(user => user.isAdmin).map(user => user.email), ["e2e-admin@tennisconnect.test"]);
  for (const identity of BASELINE_IDENTITIES) {
    const user = users.find(item => item.email === identity.email)!;
    assert.ok(await comparePasswords(PASSWORDS.get(identity.passwordEnv)!, user.passwordHash!), identity.email);
    assert.ok(!user.passwordHash!.includes(PASSWORDS.get(identity.passwordEnv)!));
  }
  const fixture = users.find(user => user.email.startsWith("e2e-fixture-"))!;
  for (const password of Array.from(PASSWORDS.values())) assert.equal(await comparePasswords(password, fixture.passwordHash!), false);
});

test("re-apply never resets existing passwords (baseline or fixture) by default", async () => {
  const set = buildFixtureSet(ANCHOR);
  const store = new MemoryStore();
  await applySeed(set, store, deps());
  const before = new Map(Array.from(store.users.values()).map(user => [user.id, user.passwordHash]));

  // A different env password must NOT change an existing account...
  const changed = new Map(PASSWORDS);
  changed.set("E2E_PLAYER_PASSWORD", CHANGED_VALUE);
  await applySeed(set, store, { ...deps(), baselinePasswords: changed });
  // ...and existing accounts need no passwords at all.
  await applySeed(set, store, { ...deps(), baselinePasswords: new Map() });

  for (const user of Array.from(store.users.values())) assert.equal(user.passwordHash, before.get(user.id), user.email);
  const player = Array.from(store.users.values()).find(user => user.email === "e2e-player@tennisconnect.test")!;
  assert.ok(await comparePasswords(PASSWORDS.get("E2E_PLAYER_PASSWORD")!, player.passwordHash!));
});

test("--rotate-passwords re-sets baseline passwords only; fixture hashes are kept", async () => {
  const set = buildFixtureSet(ANCHOR);
  const store = new MemoryStore();
  await applySeed(set, store, deps());
  const fixture = Array.from(store.users.values()).find(user => user.email.startsWith("e2e-fixture-"))!;
  const fixtureHash = fixture.passwordHash;

  const rotated = new Map(PASSWORDS);
  rotated.set("E2E_PLAYER_PASSWORD", ROTATED_VALUE);
  await applySeed(set, store, { ...deps(), baselinePasswords: rotated, rotatePasswords: true });

  const player = Array.from(store.users.values()).find(user => user.email === "e2e-player@tennisconnect.test")!;
  assert.ok(await comparePasswords(ROTATED_VALUE, player.passwordHash!));
  assert.equal(store.users.get(fixture.id)!.passwordHash, fixtureHash);
});

test("requiredPasswordEnvs: only accounts being created (or all baseline with rotation)", async () => {
  const set = buildFixtureSet(ANCHOR);
  const store = new MemoryStore();
  const allBaseline = BASELINE_IDENTITIES.map(identity => identity.passwordEnv).sort();
  assert.deepEqual(requiredPasswordEnvs(set, await planSeed(set, store), false).sort(), allBaseline);
  await applySeed(set, store, deps());
  assert.deepEqual(requiredPasswordEnvs(set, await planSeed(set, store), false), []);
  assert.deepEqual(requiredPasswordEnvs(set, await planSeed(set, store), true).sort(), allBaseline);
  await assert.rejects(applySeed(set, store, { ...deps(), baselinePasswords: new Map(), rotatePasswords: true }), /missing baseline password/);
});

test("a NON-test user with a baseline address keeps its password and data (conflict, no write)", async () => {
  const store = new MemoryStore();
  const real = store.addRealUser("e2e-admin@tennisconnect.test", "real-admin", { passwordHash: "real-users-own-hash" });
  await assert.rejects(applySeed(buildFixtureSet(ANCHOR), store, deps()), /nothing written/);
  assert.equal(store.users.get(real.id)!.passwordHash, "real-users-own-hash");
  assert.equal(store.users.size, 1);
});

test("real users are never touched", async () => {
  const store = new MemoryStore();
  const real = store.addRealUser("alex.real@gmail.com", "alex-real", { isAdmin: true });
  const realCopy = JSON.stringify(real);
  await applySeed(buildFixtureSet(ANCHOR), store, deps());
  await applySeed(buildFixtureSet(ANCHOR), store, deps());
  assert.equal(JSON.stringify(store.users.get(real.id)), realCopy);
});

async function assertConflictWritesNothing(store: MemoryStore, pattern: RegExp) {
  const set = buildFixtureSet(ANCHOR);
  const plan = await planSeed(set, store);
  assert.ok(plan.conflicts.some(conflict => pattern.test(conflict)), plan.conflicts.join("; "));
  const before = store.snapshot();
  const writesBefore = store.writes;
  await assert.rejects(applySeed(set, store, deps()), /nothing written/);
  assert.equal(store.writes, writesBefore, "no writes after a conflict");
  assert.equal(store.snapshot(), before);
}

test("conflict: a NON-test user holding a fixture email is not overwritten", async () => {
  const store = new MemoryStore();
  store.addRealUser("e2e-coach@tennisconnect.test", "someone-else");
  await assertConflictWritesNothing(store, /NON-test user/);
});

test("conflict: a fixture slug used by another account", async () => {
  const store = new MemoryStore();
  store.addRealUser("jordan@gmail.com", "e2e-player");
  await assertConflictWritesNothing(store, /slug "e2e-player"/);
});

test("conflict: org / club / tournament without the fixture marker", async () => {
  const set = buildFixtureSet(ANCHOR);
  const orgStore = new MemoryStore();
  orgStore.orgs.set(set.organization.slug, { id: "o1", slug: set.organization.slug, email: "real@club.com.au", ownerId: "x", name: "Real" });
  await assertConflictWritesNothing(orgStore, /organisation slug/);

  const clubStore = new MemoryStore();
  clubStore.clubs.set(set.clubs[0].slug, { id: "c1", slug: set.clubs[0].slug, email: null, name: "Real club" });
  await assertConflictWritesNothing(clubStore, /club slug/);

  const tournamentStore = new MemoryStore();
  tournamentStore.tournaments.set(set.tournaments[0].slug, { id: "t1", slug: set.tournaments[0].slug, email: "x@y.com", name: "Real" });
  await assertConflictWritesNothing(tournamentStore, /tournament slug/);
});

test("conflict: marked organisation owned by a non-seed account", async () => {
  const set = buildFixtureSet(ANCHOR);
  const store = new MemoryStore();
  const real = store.addRealUser("owner@gmail.com", "owner-real");
  store.orgs.set(set.organization.slug, { id: "o1", slug: set.organization.slug, email: FIXTURE_CONTACT_EMAIL, ownerId: real.id, name: "x" });
  await assertConflictWritesNothing(store, /non-seed account/);
});

test("admin cannot come from public registration paths in this module", () => {
  // The only writer of isAdmin is the operator seed; it writes isAdmin only for e2e-admin.
  const set = buildFixtureSet(ANCHOR);
  assert.deepEqual(set.users.filter(user => user.isAdmin).map(user => user.email), ["e2e-admin@tennisconnect.test"]);
  const hooks = readFileSync(join(HERE, "../../routes/testHooksRouter.ts"), "utf8");
  assert.ok(!/isAdmin\s*:\s*true/.test(hooks), "test hooks never create admins");
});

test("seed modules cannot send email, call Stripe or the network", () => {
  const dir = HERE;
  const files = readdirSync(dir).filter(name => name.endsWith(".ts") && !name.endsWith(".test.ts"));
  assert.ok(files.length >= 6, files.join(","));
  for (const name of files) {
    const source = readFileSync(join(dir, name), "utf8");
    assert.ok(!/emailService|resend|stripe|nodemailer/i.test(source.replace(/\/\/.*$/gm, "")), `${name} references email/Stripe`);
    assert.ok(!/\bfetch\(|from "(node:)?https?"|axios/.test(source), `${name} uses the network`);
    assert.ok(!/from "\.\.\/\.\.\/(auth|storage|routes)"/.test(source), `${name} imports app modules with side effects`);
  }
});

test("public registration cannot set privilege flags (insertUserSchema whitelist)", () => {
  // Static guard - the runtime schema needs drizzle-zod. /api/auth/register
  // parses req.body with insertUserSchema, whose .pick() whitelist must never
  // include a privilege or test flag (zod strips unknown keys).
  const schema = readFileSync(join(HERE, "../../../shared/schema.ts"), "utf8");
  const block = schema.match(/export const insertUserSchema = createInsertSchema\(users\)\s*\.pick\(\{([^}]*)\}\)/);
  assert.ok(block, "insertUserSchema .pick() block not found");
  for (const flag of ["isAdmin", "isOrganizer", "isTestUser", "isApproved", "emailVerified", "isHidden"]) {
    assert.ok(!new RegExp(`\\b${flag}\\b`).test(block[1]), `${flag} must not be accepted from registration`);
  }
  const routes = readFileSync(join(HERE, "../../routes.ts"), "utf8");
  const register = routes.slice(routes.indexOf('app.post("/api/auth/register"'), routes.indexOf('app.post("/api/auth/register"') + 600);
  assert.match(register, /insertUserSchema/);
});
