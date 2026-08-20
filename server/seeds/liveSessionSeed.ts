// TC Live Engine dev fixture - lets one developer test the full
// Registration -> Check-in -> Go Live -> Rounds -> Finish -> Leaderboard
// flow alone, without 16 real people.
//
//   npm run seed:live          creates/reuses the fixture, resets its live
//                               state (rounds/matches/registrations) fresh
//   npm run seed:live:reset    wipes just the live state of an existing
//                               fixture back to "ready to Go Live"
//
// Everything created here is tagged isTestUser: true and uses the fixed
// tc-test-* emails/slugs below, so it's always identifiable and safe to
// re-run - running either command repeatedly reuses the same rows
// (upsert on email/slug) rather than creating duplicates.
//
// SAFETY: refuses to run unless NODE_ENV is explicitly "development" -
// see §30 of the TC Live spec. This is deliberately an allow-list
// (NODE_ENV === "development") rather than a deny-list on "production",
// since server/env.ts/db.ts already treat anything that isn't
// "development" as loading the non-dev .env file - the allow-list can't
// accidentally admit a real environment the way a "!== production"
// check could if a staging environment used a different NODE_ENV value.

import { db } from "../db";
import { eq, inArray } from "drizzle-orm";
import { users, organizations, tennisSessions, registrations, sessionRounds, matches } from "@shared/schema";
import { hashPassword } from "../auth";

const TEST_PASSWORD = "TcLiveTest123!";
const ORGANIZER_EMAIL = "tc-test-organizer@tennisconnect.test";
const ORG_SLUG = "tc-live-test-club";
const SESSION_TITLE = "TC Live Test Session";
const PLAYER_COUNT = 16;
const COURTS_COUNT = 4;

export function assertDevEnvironment() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      `TC Live seed refuses to run outside development (NODE_ENV=${process.env.NODE_ENV}). ` +
        `This creates/deletes real rows and must never touch a real environment.`
    );
  }
}

function playerEmail(n: number) {
  return `tc-test-player-${String(n).padStart(2, "0")}@tennisconnect.test`;
}
function playerSlug(n: number) {
  return `tc-test-player-${String(n).padStart(2, "0")}`;
}
function playerName(n: number) {
  return `TC Test Player ${String(n).padStart(2, "0")}`;
}

async function upsertUser(values: typeof users.$inferInsert) {
  const [user] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.email, set: values })
    .returning();
  return user;
}

/** Creates the organizer, org, 16 players, and the session if they don't already exist - reuses them (by email/slug) if they do. */
async function ensureFixture() {
  const hashedPassword = await hashPassword(TEST_PASSWORD);

  const organizer = await upsertUser({
    email: ORGANIZER_EMAIL,
    password: hashedPassword,
    name: "TC Test Organizer",
    role: "player",
    slug: "tc-test-organizer",
    isOrganizer: true,
    isApproved: true,
    isTestUser: true,
    profileCompleted: true,
  });

  const [organization] = await db
    .insert(organizations)
    .values({
      slug: ORG_SLUG,
      name: "TC Live Test Club",
      ownerId: organizer.id,
      type: "community",
      status: "active",
      verified: true,
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { ownerId: organizer.id, status: "active" },
    })
    .returning();

  const players = [];
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const player = await upsertUser({
      email: playerEmail(i),
      password: hashedPassword,
      name: playerName(i),
      role: "player",
      slug: playerSlug(i),
      isApproved: true,
      isTestUser: true,
      profileCompleted: true,
    });
    players.push(player);
  }

  let [session] = await db
    .select()
    .from(tennisSessions)
    .where(eq(tennisSessions.organizationId, organization.id));

  const sessionValues = {
    organizationId: organization.id,
    createdBy: organizer.id,
    title: SESSION_TITLE,
    description: "Dev fixture for testing the TC Live Engine end-to-end, solo.",
    type: "social",
    status: "published" as const,
    location: "TC Live Test Courts",
    startAt: new Date(Date.now() + 60 * 60 * 1000), // an hour from now
    courtsCount: COURTS_COUNT,
    matchMode: "doubles",
    scoringFormat: "games",
    visibility: "public",
  };

  if (session && session.title === SESSION_TITLE) {
    [session] = await db
      .update(tennisSessions)
      .set(sessionValues)
      .where(eq(tennisSessions.id, session.id))
      .returning();
  } else {
    [session] = await db.insert(tennisSessions).values(sessionValues).returning();
  }

  return { organizer, organization, players, session };
}

/**
 * Wipes just the live state (matches, rounds, registrations) for the
 * fixture session and puts it back to "published" with all 16 players
 * freshly registered and checked in - ready to press Go Live. Safe to
 * call repeatedly; only ever touches rows scoped to this one session id.
 */
async function resetLiveState(sessionId: string, playerIds: string[]) {
  await db.delete(matches).where(eq(matches.sessionId, sessionId));
  await db.delete(sessionRounds).where(eq(sessionRounds.sessionId, sessionId));
  await db.delete(registrations).where(eq(registrations.sessionId, sessionId));

  await db.insert(registrations).values(
    playerIds.map((userId) => ({
      sessionId,
      userId,
      status: "registered" as const,
      checkedInAt: new Date(),
    }))
  );

  await db
    .update(tennisSessions)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(tennisSessions.id, sessionId));

  console.log(`[TC LIVE SEED] session ${sessionId}: reset - ${playerIds.length} players registered + checked in`);
}

async function seedLiveFixture() {
  assertDevEnvironment();
  const { players, session } = await ensureFixture();
  await resetLiveState(
    session.id,
    players.map((p) => p.id)
  );
  return {
    sessionId: session.id,
    organizerEmail: ORGANIZER_EMAIL,
    testPassword: TEST_PASSWORD,
    sessionTitle: SESSION_TITLE,
    courtsCount: COURTS_COUNT,
    playerCount: players.length,
  };
}

async function resetLiveFixture() {
  assertDevEnvironment();
  const [organization] = await db.select().from(organizations).where(eq(organizations.slug, ORG_SLUG));
  if (!organization) {
    throw new Error("No TC Live fixture found - run `npm run seed:live` first.");
  }
  const [session] = await db
    .select()
    .from(tennisSessions)
    .where(eq(tennisSessions.organizationId, organization.id));
  if (!session) {
    throw new Error("No TC Live fixture session found - run `npm run seed:live` first.");
  }
  const testPlayers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, Array.from({ length: PLAYER_COUNT }, (_, i) => playerEmail(i + 1))));

  await resetLiveState(
    session.id,
    testPlayers.map((p) => p.id)
  );
  return { sessionId: session.id, playerCount: testPlayers.length };
}

export { seedLiveFixture, resetLiveFixture };

// ---- CLI entrypoint (npm run seed:live / seed:live:reset) -------------

async function runFromCli() {
  const isReset = process.argv.includes("--reset");
  if (isReset) {
    const result = await resetLiveFixture();
    console.log(`[TC LIVE SEED] Reset complete - session ${result.sessionId} ready to Go Live again.`);
  } else {
    const result = await seedLiveFixture();
    console.log("\n[TC LIVE SEED] Ready.");
    console.log(`  Organizer login: ${result.organizerEmail} / ${result.testPassword}`);
    console.log(
      `  Session: "${result.sessionTitle}" (${result.sessionId}) - status: published, ${result.courtsCount} courts, doubles`
    );
    console.log(`  ${result.playerCount} test players registered + checked in - ready to Go Live.\n`);
  }
}

// Only auto-run when this file is executed directly (npm run seed:live) -
// importing seedLiveFixture/resetLiveFixture from server/routes/dev.ts
// must NOT trigger a seed run as a side effect of the import.
if (process.argv[1]?.endsWith("liveSessionSeed.ts")) {
  runFromCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[TC LIVE SEED] Failed:", err);
      process.exit(1);
    });
}
