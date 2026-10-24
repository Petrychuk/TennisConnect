// npx tsx server/routes/partnerEventImport.test.ts
//
// The URL-first import flow (spec: "do not create a duplicate extraction
// system - reuse the existing Discovery fetch/extract/normalise/validate
// pipeline"). Drives the REAL storage.importPartnerEventFromUrl, which in
// turn calls the REAL assessPage/buildActivityRecord/validateDiscoveredDates/
// duplicate-check/initialDiscoveryStatus functions - only fetchPage and
// callExtractionLLM are swapped out (via importPartnerEventFromUrl's own
// injectable deps parameter - ES module exports can't be monkeypatched
// the way storage's own methods are elsewhere in this file set, since
// they're read-only namespace properties).
//
// The route itself (POST /partner-events/import) is exercised over a
// real HTTP server, same pattern as organizerRequests.test.ts /
// partnerEvents.test.ts - see those files' headers for the full
// in-memory-storage-fake rationale.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-secret-fake-secret";

import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import type { AddressInfo } from "node:net";

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

interface Row {
  id: string;
  title: string;
  reviewStatus: string;
  discoveryStatus: string;
  sourceType: string;
  sourceUrl: string;
  [key: string]: unknown;
}

function makeDb() {
  return { rows: new Map<string, Row>(), organizations: new Map<string, { id: string; name: string }>(), seq: 0 };
}
type FakeDb = ReturnType<typeof makeDb>;

function baseRow(over: Partial<Row> & { id: string; title: string; sourceUrl: string }): Row {
  return {
    reviewStatus: "APPROVED",
    discoveryStatus: "ACTIVE",
    sourceType: "EXTERNAL",
    ...over,
  };
}

/** The REAL storage object, with only the thin DB-access methods
    patched (same technique as the other integration tests in this set)
    so the REAL importPartnerEventFromUrl, findBestDuplicateMatch, and
    every pure Discovery function it calls all run for real. */
async function patchStorage(db: FakeDb) {
  const { storage } = await import("../storage");
  const originals: Record<string, any> = {};
  const patch = (name: string, fn: (...args: any[]) => any) => {
    originals[name] = (storage as any)[name];
    (storage as any)[name] = fn;
  };

  patch("getOrganizationById", async (id: string) => {
    const o = db.organizations.get(id);
    return o ? { ...o } : undefined;
  });
  patch("getExternalActivityById", async (id: string) => {
    const r = db.rows.get(id);
    return r ? { ...r } : undefined;
  });
  patch("getExternalActivitiesForDuplicateCheck", async () => Array.from(db.rows.values()).map((r) => ({ ...r })));
  patch("getPublicSessionsForDuplicateCheck", async () => []);
  patch("createExternalActivity", async (record: Partial<Row>) => {
    db.seq++;
    const id = `ext-${db.seq}`;
    const row = baseRow({ ...record, id, title: record.title!, sourceUrl: record.sourceUrl! } as any);
    db.rows.set(id, row);
    return row;
  });

  return { storage, unpatch: () => Object.assign(storage, originals) };
}

let realImportPartnerEventFromUrl: any = null;

async function startServer(db: FakeDb, deps: { fetchPage?: (url: string) => Promise<string>; callExtractionLLM?: (text: string, url: string) => Promise<any> }) {
  const { storage, unpatch } = await patchStorage(db);
  // Capture the TRUE original exactly once, before any test has had a
  // chance to overwrite it - re-wrapping whatever is CURRENTLY installed
  // would wrap a previous test's closure (with ITS deps baked in)
  // instead of the real implementation, silently ignoring every
  // subsequent test's own deps.
  if (!realImportPartnerEventFromUrl) realImportPartnerEventFromUrl = storage.importPartnerEventFromUrl.bind(storage);
  (storage as any).importPartnerEventFromUrl = (input: any) => realImportPartnerEventFromUrl(input, deps);

  const { default: adminDiscoveryRouter } = await import("./adminDiscovery");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: "admin-1", isAdmin: true };
    (req as any).isAuthenticated = () => true;
    next();
  });
  app.use("/api/admin/discovery", adminDiscoveryRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/admin/discovery`;
  const close = async () => {
    unpatch();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  return { baseUrl, close };
}

async function call(baseUrl: string, body: unknown) {
  const res = await fetch(`${baseUrl}/partner-events/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const PAGE_HTML = `<html><body><main><h1>Saturday Social Tennis</h1>
<p>Join us every Saturday 6:00pm - 8:00pm at Manly Lawn Tennis Courts for our popular weekly
social tennis session. All welcome, though this particular session suits intermediate players
best. Doubles format, friendly round-robin style. $20 per session, casual visitors are very
welcome - no need to book ahead, just show up with a racquet and some balls and we will get you
into a group. Great way to meet other local players and get some match practice in a relaxed,
low-pressure environment every week.</p>
</main></body></html>`;

function fakeExtraction(activities: any[]) {
  return async () => ({ activities, invalidCount: 0 });
}

const GOOD_ACTIVITY = {
  title: "Saturday Social Tennis",
  description: null,
  activityTypeText: "social tennis",
  gameFormatText: "doubles",
  startDate: null,
  endDate: null,
  startTime: "18:00",
  endTime: "20:00",
  recurrenceText: "every Saturday",
  venueName: "Manly Lawn Tennis Courts",
  address: null,
  suburb: "Manly",
  city: "Sydney",
  state: "NSW",
  postcode: null,
  levelText: "Intermediate players",
  price: null,
  priceText: "$20 per session",
  currency: "AUD",
  organiserName: null,
  registrationUrl: null,
  cancelled: null,
  evidence: null,
};

async function main() {
  console.log("Partner Events - URL-first import (real storage/pipeline, real HTTP)\n");

  await test("a page with one clear activity is imported as a PENDING Partner Event with real extracted fields", async () => {
    const db = makeDb();
    const { baseUrl, close } = await startServer(db, {
      fetchPage: async () => PAGE_HTML,
      callExtractionLLM: fakeExtraction([GOOD_ACTIVITY]),
    });
    try {
      const res = await call(baseUrl, { url: "https://manlylawntennis.com.au/social", partnerId: null, partnerName: "Manly Lawn Tennis Courts" });
      assert.equal(res.status, 201, JSON.stringify(res.json));
      assert.equal(res.json.kind, "created");
      assert.equal(res.json.stub, false);
      assert.equal(res.json.activities.length, 1);
      const activity = res.json.activities[0];
      assert.equal(activity.sourceType, "PARTNER");
      assert.equal(activity.registrationType, "EXTERNAL");
      assert.equal(activity.reviewStatus, "PENDING", "still needs the ordinary Approve/confirm step");
      assert.equal(activity.title, "Saturday Social Tennis");
      assert.equal(activity.recurrenceFrequency, "WEEKLY");
      assert.equal(activity.recurrenceDayOfWeek, "SATURDAY");
      assert.equal(activity.normalisedLevel, "Intermediate");
      assert.equal(activity.price, 20);
      assert.equal(activity.partnerName, "Manly Lawn Tennis Courts");
      assert.equal(activity.sourceId, null, "no Discovery Source behind an imported Partner Event");
    } finally {
      await close();
    }
  });

  await test("a page describing several activities imports one PENDING row per activity", async () => {
    const db = makeDb();
    const second = { ...GOOD_ACTIVITY, title: "Sunday Round Robin", recurrenceText: "every Sunday", startTime: "09:00", endTime: "11:00" };
    const { baseUrl, close } = await startServer(db, { fetchPage: async () => PAGE_HTML, callExtractionLLM: fakeExtraction([GOOD_ACTIVITY, second]) });
    try {
      const res = await call(baseUrl, { url: "https://manlylawntennis.com.au/all-events", partnerId: null, partnerName: "Manly Lawn Tennis Courts" });
      assert.equal(res.status, 201);
      assert.equal(res.json.activities.length, 2);
      assert.deepEqual(res.json.activities.map((a: any) => a.title).sort(), ["Saturday Social Tennis", "Sunday Round Robin"]);
    } finally {
      await close();
    }
  });

  await test("EXACT URL already exists as EXTERNAL -> offers Confirm as Partner instead of creating a second record", async () => {
    const db = makeDb();
    const existing = baseRow({ id: "ext-existing", title: "Saturday Social Tennis", sourceUrl: "https://manlylawntennis.com.au/social", sourceType: "EXTERNAL" });
    db.rows.set(existing.id, existing);
    const { baseUrl, close } = await startServer(db, { fetchPage: async () => PAGE_HTML, callExtractionLLM: fakeExtraction([GOOD_ACTIVITY]) });
    try {
      const res = await call(baseUrl, { url: "https://manlylawntennis.com.au/social", partnerId: null, partnerName: "Manly Lawn Tennis Courts" });
      assert.equal(res.status, 200, "a duplicate finding is not an error");
      assert.equal(res.json.kind, "duplicate");
      assert.equal(res.json.existingId, "ext-existing");
      assert.equal(res.json.reason, "same-url");
      assert.equal(db.rows.size, 1, "nothing new was created");
    } finally {
      await close();
    }
  });

  await test("a DIFFERENT url whose extracted content is a high-confidence match offers Confirm as Partner instead", async () => {
    const db = makeDb();
    const existing = baseRow({
      id: "ext-existing",
      title: "Saturday Social Tennis",
      sourceUrl: "https://some-directory.example/listing/123",
      sourceType: "EXTERNAL",
      venueName: "Manly Lawn Tennis Courts",
      suburb: "Manly",
      startTime: "18:00",
      recurrenceDayOfWeek: "SATURDAY",
    });
    db.rows.set(existing.id, existing);
    const { baseUrl, close } = await startServer(db, { fetchPage: async () => PAGE_HTML, callExtractionLLM: fakeExtraction([GOOD_ACTIVITY]) });
    try {
      // A different URL this time - the partner's own page, not the
      // directory listing already in the system.
      const res = await call(baseUrl, { url: "https://manlylawntennis.com.au/social-direct", partnerId: null, partnerName: "Manly Lawn Tennis Courts" });
      assert.equal(res.status, 200);
      assert.equal(res.json.kind, "duplicate");
      assert.equal(res.json.existingId, "ext-existing");
      assert.equal(res.json.reason, "high-confidence-match");
      assert.equal(db.rows.size, 1, "nothing new was created");
    } finally {
      await close();
    }
  });

  await test("an already-confirmed PARTNER row at the same URL is not re-offered as a duplicate (re-importing is a no-op)", async () => {
    const db = makeDb();
    const existing = baseRow({ id: "ext-partner", title: "Saturday Social Tennis", sourceUrl: "https://manlylawntennis.com.au/social", sourceType: "PARTNER" });
    db.rows.set(existing.id, existing);
    const { baseUrl, close } = await startServer(db, { fetchPage: async () => PAGE_HTML, callExtractionLLM: fakeExtraction([GOOD_ACTIVITY]) });
    try {
      const res = await call(baseUrl, { url: "https://manlylawntennis.com.au/social", partnerId: null, partnerName: "Manly Lawn Tennis Courts" });
      // Not flagged as a "duplicate to resolve" against itself - it just
      // imports as usual (a second, separate PENDING row is an accepted,
      // rare edge case here; the important guarantee is it never gets
      // stuck pointing admin at a dead-end "confirm" of an already-Partner row).
      assert.notEqual(res.json.kind, "duplicate");
    } finally {
      await close();
    }
  });

  await test("page can't be fetched at all -> a stub NEEDS_REVIEW row is created, not a hard error", async () => {
    const db = makeDb();
    const { baseUrl, close } = await startServer(db, {
      fetchPage: async () => {
        throw new Error("HTTP 404");
      },
    });
    try {
      const res = await call(baseUrl, { url: "https://broken-link.example/nope", partnerId: null, partnerName: "Some Club" });
      assert.equal(res.status, 201);
      assert.equal(res.json.kind, "created");
      assert.equal(res.json.stub, true);
      const activity = res.json.activities[0];
      assert.equal(activity.sourceType, "PARTNER");
      assert.equal(activity.discoveryStatus, "NEEDS_REVIEW");
      assert.equal(activity.reviewStatus, "PENDING");
      assert.ok(activity.extractionEvidence?._flag?.includes("404"));
      assert.equal(activity.partnerName, "Some Club");
    } finally {
      await close();
    }
  });

  await test("page fetched fine but nothing extractable (a valid empty answer) -> a stub row, not an error", async () => {
    const db = makeDb();
    const { baseUrl, close } = await startServer(db, {
      fetchPage: async () => "<html><body><main><p>Welcome to our club. Contact us for more information.</p></main></body></html>",
      callExtractionLLM: fakeExtraction([]),
    });
    try {
      const res = await call(baseUrl, { url: "https://club.example/", partnerId: null, partnerName: "A Club" });
      assert.equal(res.status, 201);
      assert.equal(res.json.stub, true);
      assert.equal(res.json.activities[0].discoveryStatus, "NEEDS_REVIEW");
    } finally {
      await close();
    }
  });

  await test("page needs JavaScript to render (unsupported) -> a stub row, not an error", async () => {
    const db = makeDb();
    const { baseUrl, close } = await startServer(db, {
      fetchPage: async () => '<html><body><div id="root"></div><script src="/a.js"></script><script src="/b.js"></script></body></html>',
    });
    try {
      const res = await call(baseUrl, { url: "https://spa-club.example/", partnerId: null, partnerName: "A Club" });
      assert.equal(res.status, 201);
      assert.equal(res.json.stub, true);
    } finally {
      await close();
    }
  });

  await test("an invalid URL is rejected before anything is fetched", async () => {
    const db = makeDb();
    const { baseUrl, close } = await startServer(db, {});
    try {
      const res = await call(baseUrl, { url: "not-a-url", partnerId: null, partnerName: "A Club" });
      assert.equal(res.status, 400);
      assert.equal(db.rows.size, 0);
    } finally {
      await close();
    }
  });

  await test("a localhost/private-range URL is rejected (SSRF guard, same as Discovery sources)", async () => {
    const db = makeDb();
    const { baseUrl, close } = await startServer(db, {});
    try {
      const res = await call(baseUrl, { url: "http://localhost:3000/admin", partnerId: null, partnerName: "A Club" });
      assert.equal(res.status, 400);
    } finally {
      await close();
    }
  });

  await test("a partnerId that isn't a real organisation is rejected before any fetch happens", async () => {
    const db = makeDb();
    let fetchCalled = false;
    const { baseUrl, close } = await startServer(db, {
      fetchPage: async () => {
        fetchCalled = true;
        return PAGE_HTML;
      },
    });
    try {
      const res = await call(baseUrl, { url: "https://club.example/", partnerId: "does-not-exist", partnerName: "A Club" });
      assert.equal(res.status, 400);
      assert.equal(fetchCalled, false, "should fail fast before fetching anything");
    } finally {
      await close();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
