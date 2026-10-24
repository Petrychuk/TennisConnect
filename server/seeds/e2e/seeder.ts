// E2E fixture seeder - storage-agnostic core (Stage 2).
//
// Two phases:
//   1. planSeed()  READ-ONLY. Resolves every fixture's natural key against
//      the database and collects ALL conflicts. A conflict is any existing
//      record that holds a fixture's identity but is not seed-owned:
//        - a user with a fixture email who is not isTestUser;
//        - a fixture slug already used by a different user;
//        - an organisation/club/tournament with a fixture slug but without
//          the fixture contact-email marker, or an organisation owned by
//          someone other than a seed-owned test user.
//      Any conflict -> nothing is written (fail closed).
//   2. applySeed() writes only after a clean plan, through SeedStore. It
//      only ever creates or updates seed-owned records, matched by natural
//      key, so re-running is idempotent and real users are never touched.
//
// No email, Stripe or network code is reachable from here: records are
// written directly, never through registration or messaging flows.
// SeedStore implementations: drizzleStore.ts (real), the in-memory fake in
// e2eSeed.test.ts (tests).

import { classifyEmail, isSeedOwnedEmail } from "./identities";
import {
  FIXTURE_CONTACT_EMAIL,
  fixtureInvariantProblems,
  type ClubFixture,
  type CoachProfileFixture,
  type FixtureSet,
  type OrganizationFixture,
  type PlayerProfileFixture,
  type SeasonFixture,
  type SeriesFixture,
  type SessionFixture,
  type TournamentFixture,
} from "./fixtures";

// ---------- Store contract ----------

export interface ExistingUser {
  id: string;
  email: string;
  slug: string;
  isTestUser: boolean;
}

export interface ExistingMarked {
  id: string;
  email: string | null;
}

export interface UserWrite {
  email: string;
  slug: string;
  name: string;
  role: "player" | "coach";
  isOrganizer: boolean;
  isAdmin: boolean;
  isHidden: boolean;
  /** Present on create, and on update for baseline accounts only. */
  passwordHash?: string;
}

export interface Ensured {
  id: string;
  created: boolean;
}

export interface SeedStore {
  findUserByEmail(email: string): Promise<ExistingUser | undefined>;
  findUserBySlug(slug: string): Promise<ExistingUser | undefined>;
  findUserById(id: string): Promise<ExistingUser | undefined>;
  findOrganizationBySlug(slug: string): Promise<(ExistingMarked & { ownerId: string }) | undefined>;
  findClubBySlug(slug: string): Promise<ExistingMarked | undefined>;
  findTournamentBySlug(slug: string): Promise<ExistingMarked | undefined>;

  createTestUser(user: UserWrite): Promise<string>;
  updateTestUser(id: string, user: UserWrite): Promise<void>;
  upsertPlayerProfile(userId: string, profile: PlayerProfileFixture): Promise<boolean>;
  upsertCoachProfile(userId: string, profile: CoachProfileFixture): Promise<boolean>;
  upsertOrganization(existingId: string | undefined, org: OrganizationFixture, ownerId: string): Promise<Ensured>;
  ensureOrganizationOwner(organizationId: string, userId: string): Promise<boolean>;
  ensureCommunityMembership(organizationId: string, userId: string, status: string): Promise<boolean>;
  upsertClub(existingId: string | undefined, club: ClubFixture): Promise<Ensured>;
  ensureClubFollow(userId: string, clubId: string): Promise<boolean>;
  upsertTournament(existingId: string | undefined, tournament: TournamentFixture): Promise<Ensured>;
  ensureSeason(organizationId: string, createdBy: string, season: SeasonFixture): Promise<Ensured>;
  ensureSeries(organizationId: string, seasonId: string, createdBy: string, series: SeriesFixture): Promise<Ensured>;
  upsertSession(
    organizationId: string,
    createdBy: string,
    session: SessionFixture,
    seasonId: string | null,
    seriesId: string | null
  ): Promise<Ensured>;
  ensureRegistration(sessionId: string, userId: string, status: string, checkedInAt: Date | null): Promise<boolean>;
  ensureRound(sessionId: string, roundNumber: number, completedAt: Date): Promise<Ensured>;
  ensureMatch(
    sessionId: string,
    roundId: string,
    match: { courtLabel: string; teamAIds: string[]; teamBIds: string[]; teamAGames: number; teamBGames: number; confirmedAt: Date }
  ): Promise<boolean>;
  ensureMessage(message: {
    senderId: string;
    senderName: string;
    senderEmail: string;
    recipientId: string;
    recipientType: string;
    subject: string;
    content: string;
  }): Promise<boolean>;
}

export interface SeedDeps {
  hashPassword: (password: string) => Promise<string>;
  /** Unguessable password for fixture accounts that never log in. */
  randomPassword: () => string;
  /** Baseline passwords by env-var name - only those requiredPasswordEnvs() names. */
  baselinePasswords: Map<string, string>;
  /**
   * false (default): an EXISTING account's password is never touched.
   * true (--rotate-passwords): existing baseline accounts are re-set from
   * the environment. Fixture accounts are never re-set either way.
   */
  rotatePasswords?: boolean;
}

// ---------- Phase 1: plan (read-only) ----------

export interface SeedPlan {
  conflicts: string[];
  users: { email: string; action: "create" | "update"; existingId?: string }[];
  organization: { action: "create" | "update"; existingId?: string };
  clubs: { slug: string; action: "create" | "update"; existingId?: string }[];
  tournaments: { slug: string; action: "create" | "update"; existingId?: string }[];
}

export async function planSeed(set: FixtureSet, store: SeedStore): Promise<SeedPlan> {
  const conflicts = fixtureInvariantProblems(set).map(problem => `invalid fixtures: ${problem}`);
  const plan: SeedPlan = { conflicts, users: [], organization: { action: "create" }, clubs: [], tournaments: [] };

  for (const user of set.users) {
    if (!isSeedOwnedEmail(user.email)) {
      conflicts.push(`fixture ${user.email} is not a baseline/fixture identity`);
      continue;
    }
    const byEmail = await store.findUserByEmail(user.email);
    const bySlug = await store.findUserBySlug(user.slug);

    if (byEmail && !byEmail.isTestUser) {
      conflicts.push(`${user.email} already exists as a NON-test user - it will not be modified`);
      continue;
    }
    if (bySlug && (!byEmail || bySlug.id !== byEmail.id)) {
      conflicts.push(`slug "${user.slug}" is already used by another account - it will not be modified`);
      continue;
    }
    plan.users.push(byEmail ? { email: user.email, action: "update", existingId: byEmail.id } : { email: user.email, action: "create" });
  }

  const org = await store.findOrganizationBySlug(set.organization.slug);
  if (org) {
    const owner = await store.findUserById(org.ownerId);
    if (org.email !== FIXTURE_CONTACT_EMAIL) {
      conflicts.push(`organisation slug "${set.organization.slug}" exists without the fixture marker - it will not be modified`);
    } else if (!owner || !owner.isTestUser || !isSeedOwnedEmail(owner.email)) {
      conflicts.push(`organisation "${set.organization.slug}" is owned by a non-seed account - it will not be modified`);
    } else {
      plan.organization = { action: "update", existingId: org.id };
    }
  }

  for (const club of set.clubs) {
    const existing = await store.findClubBySlug(club.slug);
    if (existing && existing.email !== FIXTURE_CONTACT_EMAIL) {
      conflicts.push(`club slug "${club.slug}" exists without the fixture marker - it will not be modified`);
    } else {
      plan.clubs.push(existing ? { slug: club.slug, action: "update", existingId: existing.id } : { slug: club.slug, action: "create" });
    }
  }

  for (const tournament of set.tournaments) {
    const existing = await store.findTournamentBySlug(tournament.slug);
    if (existing && existing.email !== FIXTURE_CONTACT_EMAIL) {
      conflicts.push(`tournament slug "${tournament.slug}" exists without the fixture marker - it will not be modified`);
    } else {
      plan.tournaments.push(
        existing ? { slug: tournament.slug, action: "update", existingId: existing.id } : { slug: tournament.slug, action: "create" }
      );
    }
  }

  return plan;
}

/** Env-var names of the baseline passwords this apply will actually write. */
export function requiredPasswordEnvs(set: FixtureSet, plan: SeedPlan, rotatePasswords: boolean): string[] {
  const byEmail = new Map(set.users.map(user => [user.email, user]));
  return plan.users
    .filter(planned => planned.action === "create" || rotatePasswords)
    .map(planned => byEmail.get(planned.email)?.passwordEnv)
    .filter((name): name is string => !!name);
}

export function summarisePlan(plan: SeedPlan): string[] {
  const count = (items: { action: string }[], action: string) => items.filter(item => item.action === action).length;
  return [
    `users:       ${count(plan.users, "create")} to create, ${count(plan.users, "update")} to update`,
    `organisation: ${plan.organization.action}`,
    `clubs:       ${count(plan.clubs, "create")} to create, ${count(plan.clubs, "update")} to update`,
    `tournaments: ${count(plan.tournaments, "create")} to create, ${count(plan.tournaments, "update")} to update`,
    `conflicts:   ${plan.conflicts.length}`,
  ];
}

// ---------- Phase 2: apply (only after a clean plan) ----------

export interface SeedReport {
  created: Record<string, number>;
  updated: Record<string, number>;
}

export async function applySeed(set: FixtureSet, store: SeedStore, deps: SeedDeps): Promise<SeedReport> {
  const plan = await planSeed(set, store);
  if (plan.conflicts.length > 0) {
    throw new Error(`[e2e-seed] ${plan.conflicts.length} conflict(s) - nothing written:\n  - ${plan.conflicts.join("\n  - ")}`);
  }

  const report: SeedReport = { created: {}, updated: {} };
  const bump = (kind: string, created: boolean) => {
    const bucket = created ? report.created : report.updated;
    bucket[kind] = (bucket[kind] ?? 0) + 1;
  };

  // ---------- Users + profiles ----------
  const userIds = new Map<string, string>();
  const usersByEmail = new Map(set.users.map(user => [user.email, user]));

  for (const planned of plan.users) {
    const user = usersByEmail.get(planned.email)!;
    if (classifyEmail(user.email).kind === "other") throw new Error(`[e2e-seed] refusing to write non-seed identity ${user.email}`);

    // Passwords are written on CREATE only. An existing account keeps its
    // password (a tester may have it in a local .env); baseline passwords
    // are re-set only with an explicit --rotate-passwords.
    let passwordHash: string | undefined;
    const setBaselinePassword = user.passwordEnv && (planned.action === "create" || deps.rotatePasswords === true);
    if (setBaselinePassword) {
      const password = deps.baselinePasswords.get(user.passwordEnv!);
      if (!password) throw new Error(`[e2e-seed] missing baseline password ${user.passwordEnv}`);
      passwordHash = await deps.hashPassword(password);
    } else if (!user.passwordEnv && planned.action === "create") {
      passwordHash = await deps.hashPassword(deps.randomPassword());
    }

    const write: UserWrite = {
      email: user.email,
      slug: user.slug,
      name: user.name,
      role: user.userRole,
      isOrganizer: user.isOrganizer,
      isAdmin: user.isAdmin,
      isHidden: !user.listed,
      passwordHash,
    };

    if (planned.action === "create") {
      userIds.set(user.email, await store.createTestUser(write));
      bump("users", true);
    } else {
      await store.updateTestUser(planned.existingId!, write);
      userIds.set(user.email, planned.existingId!);
      bump("users", false);
    }

    const userId = userIds.get(user.email)!;
    if (user.playerProfile) bump("playerProfiles", await store.upsertPlayerProfile(userId, user.playerProfile));
    if (user.coachProfile) bump("coachProfiles", await store.upsertCoachProfile(userId, user.coachProfile));
  }

  const idOf = (email: string) => {
    const id = userIds.get(email);
    if (!id) throw new Error(`[e2e-seed] unresolved fixture user ${email}`);
    return id;
  };

  // ---------- Organisation + community ----------
  const organiserId = idOf(set.organization.ownerEmail);
  const org = await store.upsertOrganization(plan.organization.existingId, set.organization, organiserId);
  bump("organizations", org.created);
  bump("organizationMembers", await store.ensureOrganizationOwner(org.id, organiserId));
  for (const membership of set.communityMemberships) {
    bump("communityMemberships", await store.ensureCommunityMembership(org.id, idOf(membership.userEmail), membership.status));
  }

  // ---------- Clubs + follows ----------
  const clubIds = new Map<string, string>();
  for (const planned of plan.clubs) {
    const club = set.clubs.find(item => item.slug === planned.slug)!;
    const result = await store.upsertClub(planned.existingId, club);
    clubIds.set(club.slug, result.id);
    bump("clubs", result.created);
  }
  for (const follow of set.clubFollows) {
    bump("clubFollows", await store.ensureClubFollow(idOf(follow.userEmail), clubIds.get(follow.clubSlug)!));
  }

  // ---------- Tournaments ----------
  for (const planned of plan.tournaments) {
    const tournament = set.tournaments.find(item => item.slug === planned.slug)!;
    bump("tournaments", (await store.upsertTournament(planned.existingId, tournament)).created);
  }

  // ---------- Organiser Hub ----------
  const season = await store.ensureSeason(org.id, organiserId, set.season);
  bump("seasons", season.created);
  const series = await store.ensureSeries(org.id, season.id, organiserId, set.series);
  bump("series", series.created);

  for (const session of set.sessions) {
    const result = await store.upsertSession(
      org.id,
      organiserId,
      session,
      session.inSeries ? season.id : null,
      session.inSeries ? series.id : null
    );
    bump("sessions", result.created);

    for (const registration of session.registrations) {
      bump(
        "registrations",
        await store.ensureRegistration(result.id, idOf(registration.userEmail), registration.status, registration.checkedIn ? session.startAt : null)
      );
    }

    for (const round of session.rounds) {
      const roundResult = await store.ensureRound(result.id, round.roundNumber, session.endAt);
      bump("rounds", roundResult.created);
      for (const match of round.matches) {
        bump(
          "matches",
          await store.ensureMatch(result.id, roundResult.id, {
            courtLabel: match.courtLabel,
            teamAIds: match.teamA.map(idOf),
            teamBIds: match.teamB.map(idOf),
            teamAGames: match.teamAGames,
            teamBGames: match.teamBGames,
            confirmedAt: session.endAt,
          })
        );
      }
    }
  }

  // ---------- Messages ----------
  for (const message of set.messages) {
    const sender = usersByEmail.get(message.fromEmail)!;
    bump(
      "messages",
      await store.ensureMessage({
        senderId: idOf(message.fromEmail),
        senderName: sender.name,
        senderEmail: sender.email,
        recipientId: idOf(message.toEmail),
        recipientType: message.recipientType,
        subject: message.subject,
        content: message.content,
      })
    );
  }

  return report;
}
