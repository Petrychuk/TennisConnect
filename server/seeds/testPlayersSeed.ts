// General-purpose test player/coach accounts - NOT tied to any one
// session (unlike server/seeds/liveSessionSeed.ts, which owns its own
// fixed session). These are meant to be registered, by hand, to
// whatever session you're testing at the moment: create/publish a
// session in the Organizer Hub as usual, then register these players
// against it (as the organizer, or by logging in as each one) to
// exercise the real registration flow, check-in, approvals, etc.
//
//   npm run seed:test-players          create/refresh the pool
//   npm run seed:test-players:reset    unregister the pool from every
//                                       session (accounts/profiles stay)
//
// Each account has isApproved: true, profileCompleted: true, AND a
// real player_profiles/coach_profiles row with isDraft: false - all
// three are required for a player/coach to show up anywhere in the
// public directory (see storage.ts getAllPlayers / getAllCoachesWithProfiles),
// which is exactly the gap that made earlier test users invisible there.
//
// Same safety model as liveSessionSeed.ts: refuses to run unless
// NODE_ENV=development (allow-list, not a "!== production" deny-list).

import { db } from "../db";
import { eq, inArray } from "drizzle-orm";
import { users, playerProfiles, coachProfiles, registrations } from "@shared/schema";
import { hashPassword } from "../auth";
import { assertDevEnvironment } from "./liveSessionSeed";

const TEST_PASSWORD = "TcTestPlayer123!";
const PLAYER_COUNT = 20;
const COACH_COUNT = 5;
const LOCATIONS = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"];
const SKILL_LEVELS = ["Social", "Beginner", "Intermediate", "Advanced"];

function playerEmail(n: number) {
  return `test-player-${String(n).padStart(2, "0")}@tennisconnect.test`;
}
function playerSlug(n: number) {
  return `test-player-${String(n).padStart(2, "0")}`;
}
function playerName(n: number) {
  return `Test Player ${String(n).padStart(2, "0")}`;
}
function coachEmail(n: number) {
  return `test-coach-${String(n).padStart(2, "0")}@tennisconnect.test`;
}
function coachSlug(n: number) {
  return `test-coach-${String(n).padStart(2, "0")}`;
}
function coachName(n: number) {
  return `Test Coach ${String(n).padStart(2, "0")}`;
}

// pravatar.cc serves stable, free placeholder headshots by index (1-70) -
// exactly what test data needs: a real photo so avatar rendering/cropping
// can actually be tested, without hosting or licensing any images
// ourselves. Players and coaches use non-overlapping index ranges so no
// two seeded accounts share a face.
function avatarUrl(index: number) {
  return `https://i.pravatar.cc/300?img=${((index - 1) % 70) + 1}`;
}

async function upsertUser(values: typeof users.$inferInsert) {
  const [user] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.email, set: values })
    .returning();
  return user;
}

/** player_profiles/coach_profiles have no unique constraint on userId, so upsert is done by hand: update if a row exists, insert if not. */
async function upsertPlayerProfile(userId: string, values: Omit<typeof playerProfiles.$inferInsert, "userId">) {
  const [existing] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId));
  if (existing) {
    await db.update(playerProfiles).set(values).where(eq(playerProfiles.id, existing.id));
  } else {
    await db.insert(playerProfiles).values({ ...values, userId });
  }
}

async function upsertCoachProfile(userId: string, values: Omit<typeof coachProfiles.$inferInsert, "userId">) {
  const [existing] = await db.select().from(coachProfiles).where(eq(coachProfiles.userId, userId));
  if (existing) {
    await db.update(coachProfiles).set(values).where(eq(coachProfiles.id, existing.id));
  } else {
    await db.insert(coachProfiles).values({ ...values, userId });
  }
}

async function seedTestPlayers() {
  assertDevEnvironment();
  const hashedPassword = await hashPassword(TEST_PASSWORD);

  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const user = await upsertUser({
      email: playerEmail(i),
      password: hashedPassword,
      name: playerName(i),
      role: "player",
      slug: playerSlug(i),
      avatar: avatarUrl(i),
      isApproved: true,
      isTestUser: true,
      profileCompleted: true,
    });
    await upsertPlayerProfile(user.id, {
      location: LOCATIONS[i % LOCATIONS.length],
      skillLevel: SKILL_LEVELS[i % SKILL_LEVELS.length],
      bio: "Seeded test player account.",
      isDraft: false,
    });
  }

  for (let i = 1; i <= COACH_COUNT; i++) {
    const user = await upsertUser({
      email: coachEmail(i),
      password: hashedPassword,
      name: coachName(i),
      role: "coach",
      slug: coachSlug(i),
      avatar: avatarUrl(PLAYER_COUNT + i),
      isApproved: true,
      isTestUser: true,
      profileCompleted: true,
    });
    await upsertCoachProfile(user.id, {
      title: "Tennis Coach",
      location: LOCATIONS[i % LOCATIONS.length],
      bio: "Seeded test coach account.",
      experience: "5 years",
      isDraft: false,
    });
  }

  return { playerCount: PLAYER_COUNT, coachCount: COACH_COUNT, password: TEST_PASSWORD };
}

/** Unregisters the whole test pool from every session (any status) - accounts, profiles, and approvals are untouched, so they're immediately ready to register again for a fresh test run. */
async function resetTestPlayers() {
  assertDevEnvironment();
  const emails = [
    ...Array.from({ length: PLAYER_COUNT }, (_, i) => playerEmail(i + 1)),
    ...Array.from({ length: COACH_COUNT }, (_, i) => coachEmail(i + 1)),
  ];
  const testUsers = await db.select({ id: users.id }).from(users).where(inArray(users.email, emails));
  const userIds = testUsers.map((u) => u.id);
  if (userIds.length === 0) {
    return { unregistered: 0 };
  }
  const deleted = await db.delete(registrations).where(inArray(registrations.userId, userIds)).returning();
  return { unregistered: deleted.length };
}

export { seedTestPlayers, resetTestPlayers, TEST_PASSWORD };

// ---- CLI entrypoint -----------------------------------------------

async function runFromCli() {
  const isReset = process.argv.includes("--reset");
  if (isReset) {
    const result = await resetTestPlayers();
    console.log(`[TEST PLAYERS SEED] Unregistered the test pool from ${result.unregistered} session(s).`);
  } else {
    const result = await seedTestPlayers();
    console.log("\n[TEST PLAYERS SEED] Ready.");
    console.log(`  ${result.playerCount} players: test-player-01..${String(result.playerCount).padStart(2, "0")}@tennisconnect.test`);
    console.log(`  ${result.coachCount} coaches: test-coach-01..${String(result.coachCount).padStart(2, "0")}@tennisconnect.test`);
    console.log(`  Password for all: ${result.password}`);
    console.log(`  All approved + profile complete - ready to register for any session, or already visible in the public directory.\n`);
  }
}

if (process.argv[1]?.endsWith("testPlayersSeed.ts")) {
  runFromCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[TEST PLAYERS SEED] Failed:", err);
      process.exit(1);
    });
}
