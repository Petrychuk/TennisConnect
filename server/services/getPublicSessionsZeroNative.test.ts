// npx tsx server/services/getPublicSessionsZeroNative.test.ts
//
// Regression for: staging had 2 approved Strathfield external activities
// (Discovery Agent) and 0 published native TennisConnect sessions -
// GET /api/play/sessions returned {"sessions":[]}, even though both the
// raw SQL and the card-building logic were individually correct.
//
// Root cause: getPublicSessions() had `if (rows.length === 0) return [];`
// right after fetching NATIVE sessions - a harmless-looking optimisation
// to skip the registration-count query when there's nothing to count.
// But the external-activities merge (spec section 20) lives FURTHER DOWN
// in the same function, so that early return also skipped every approved
// external activity whenever there were zero native sessions to show
// alongside them. This never showed up in earlier testing because there
// was always at least one native session in the test data at the time.
//
// This test drives the REAL storage.getPublicSessions() end to end, with
// db.select() stubbed to answer its two queries in call order (native
// sessions, then external activities) - so it exercises the exact
// function whose control flow was broken, not a re-implementation of it.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-secret-fake-secret";

import assert from "node:assert/strict";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  }
}

const STRATHFIELD_ROWS = [
  {
    id: "c1a3-b9fa-4490-80b4-cdade56a89b7",
    title: "Saturday Social - Competitive/Advanced",
    reviewStatus: "APPROVED",
    discoveryStatus: "ACTIVE",
    duplicateOfSessionId: null,
    timeZone: "Australia/Sydney",
    startTime: "20:00",
    endTime: "21:30",
    recurrenceFrequency: "WEEKLY",
    recurrenceDayOfWeek: "SATURDAY",
    startDate: "2026-08-01",
    endDate: null,
    activityType: "social",
    normalisedLevel: "Advanced",
    suburb: null,
    city: null,
    state: "NSW",
    venueName: "Strathfield Sports Club",
    latitude: null,
    longitude: null,
    organiserName: null,
    sourceName: "Strathfield Sports Club - Saturday Social",
    registrationUrl: null,
    sourceUrl: "https://strathfieldsportsclub.com.au/events/saturday-social-2026-08-01/",
    lastCheckedAt: new Date(),
    price: 20,
    priceLabel: "Free for SSC tennis members · $20 per week for non-members",
  },
  {
    id: "d7af0214-642a-4854-80f3-a700c5b6aa75",
    title: "Saturday Social - Beginners",
    reviewStatus: "APPROVED",
    discoveryStatus: "ACTIVE",
    duplicateOfSessionId: null,
    timeZone: "Australia/Sydney",
    startTime: "18:30",
    endTime: "20:00",
    recurrenceFrequency: "WEEKLY",
    recurrenceDayOfWeek: "SATURDAY",
    startDate: "2026-08-01",
    endDate: null,
    activityType: "social",
    normalisedLevel: "Beginner",
    suburb: null,
    city: null,
    state: "NSW",
    venueName: "Strathfield Sports Club",
    latitude: null,
    longitude: null,
    organiserName: null,
    sourceName: "Strathfield Sports Club - Saturday Social",
    registrationUrl: null,
    sourceUrl: "https://strathfieldsportsclub.com.au/events/saturday-social-2026-08-01/",
    lastCheckedAt: new Date(),
    price: 20,
    priceLabel: "Free for SSC tennis members · $20 per week for non-members",
  },
];

/** Stubs db.select() to answer getPublicSessions's queries in the order
    it makes them: native sessions, then (only if any native rows exist)
    a registration-count query, then external activities. Restores the
    original afterwards. */
async function withStubbedDb(nativeRows: unknown[], externalRows: unknown[], run: () => Promise<void>) {
  const { db } = await import("../db");
  const original = db.select;
  const sequence = nativeRows.length > 0 ? [nativeRows, [] /* registration counts */, externalRows] : [nativeRows, externalRows];
  let call = 0;
  (db as any).select = (...args: unknown[]) => {
    const result = sequence[call] ?? [];
    call++;
    const builder: any = {
      from: () => builder,
      innerJoin: () => builder,
      where: () => builder,
      groupBy: () => builder,
      orderBy: () => builder,
      then: (resolve: any) => resolve(result),
    };
    return builder;
  };
  try {
    await run();
  } finally {
    (db as any).select = original;
  }
}

async function main() {
  console.log("getPublicSessions: external activities with zero native sessions\n");

  const { storage } = await import("../storage");

  await test("THE BUG: 0 native sessions + 2 approved recurring external activities -> Play is NOT empty", async () => {
    await withStubbedDb([], STRATHFIELD_ROWS, async () => {
      const cards = await storage.getPublicSessions({});
      // 2 recurring weekly activities, each with ~4 upcoming Saturdays in
      // the default occurrence horizon.
      assert.ok(cards.length > 0, "getPublicSessions({}) returned an empty array with 0 native sessions - the bug is back");
      assert.equal(cards.length, 8, `expected 8 upcoming occurrence cards, got ${cards.length}`);
      assert.ok(cards.every((c) => c.sourceType === "EXTERNAL"));
      assert.ok(cards.every((c) => c.id.startsWith(STRATHFIELD_ROWS[0].id) || c.id.startsWith(STRATHFIELD_ROWS[1].id)));
    });
  });

  await test("with 0 native sessions AND 0 external activities, Play is genuinely empty (not a bug, just nothing to show)", async () => {
    await withStubbedDb([], [], async () => {
      const cards = await storage.getPublicSessions({});
      assert.deepEqual(cards, []);
    });
  });

  await test("native and external cards still combine correctly when BOTH exist (the ordinary case, unaffected by this fix)", async () => {
    const nativeRow = {
      session: {
        id: "native-1",
        title: "Club Round Robin",
        type: "round-robin",
        status: "published",
        visibility: "public",
        startAt: new Date("2026-10-05T09:00:00.000Z"),
        endAt: new Date("2026-10-05T11:00:00.000Z"),
        timeZone: "Australia/Sydney",
        location: "Example Club",
        latitude: null,
        longitude: null,
        skillLevel: null,
        courtsCount: null,
        maxParticipants: null,
        coverImage: null,
        organizationId: "org-1",
      },
      organization: { id: "org-1", name: "Example Club", slug: "example-club", logo: null },
    };
    await withStubbedDb([nativeRow], STRATHFIELD_ROWS, async () => {
      const cards = await storage.getPublicSessions({});
      assert.equal(cards.filter((c) => c.sourceType === "EXTERNAL").length, 8);
      assert.equal(cards.filter((c) => (c as any).sourceType !== "EXTERNAL").length, 1);
      // Merged and sorted together, not two separate lists concatenated blindly.
      const sorted = [...cards].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      assert.deepEqual(cards.map((c) => c.id), sorted.map((c) => c.id));
    });
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
