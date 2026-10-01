// npx tsx server/routes/partnerEvents.test.ts
//
// Covers the Partner Events feature end to end, both paths:
//  - THE PRIMARY PATH: an existing Discovery-found (EXTERNAL) row is
//    upgraded in place to PARTNER when a club confirms the partnership
//    (POST /activities/:id/confirm-partner) - no second row, no
//    duplicate, same card, just a different badge from here on.
//  - THE FALLBACK PATH: an admin creates a brand-new Partner Event from
//    scratch when there's no existing Discovery row to upgrade
//    (POST /partner-events), including what happens when it turns out
//    to duplicate something that already exists (resolved by priority:
//    TENNISCONNECT -> PARTNER -> EXTERNAL, confirmed on Approve).
//
// Same faking strategy as organizerRequests.test.ts / organizerGrantDirect.test.ts
// (see those files for the full rationale): storage's DB-touching
// methods are patched with an in-memory implementation; auth is a
// header-based stub standing in for a real Passport session. The REAL
// server/routes/adminDiscovery.ts router runs behind a real HTTP server.

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
  registrationType: string | null;
  partnerId: string | null;
  partnerName: string | null;
  organiserName: string | null;
  sourceName: string;
  sourceUrl: string;
  registrationUrl: string | null;
  duplicateOfExternalId: string | null;
  duplicateOfSessionId: string | null;
  duplicateConfidence: number | null;
  suburb: string | null;
  state: string | null;
  venueName: string | null;
  startDate: string | null;
  startTime: string | null;
  recurrenceDayOfWeek: string | null;
  createdAt: Date;
  [key: string]: unknown;
}

function makeDb() {
  const rows = new Map<string, Row>();
  const organizations = new Map<string, { id: string; name: string }>();
  let seq = 0;
  return { rows, organizations, nextId: (p: string) => `${p}-${++seq}` };
}
type FakeDb = ReturnType<typeof makeDb>;

function baseFields(over: Partial<Row> & { id: string; title: string }): Row {
  return {
    reviewStatus: "APPROVED",
    discoveryStatus: "ACTIVE",
    sourceType: "EXTERNAL",
    registrationType: null,
    partnerId: null,
    partnerName: null,
    organiserName: null,
    sourceName: "Example Tennis Club",
    sourceUrl: "https://example-club.com.au/social",
    registrationUrl: null,
    duplicateOfExternalId: null,
    duplicateOfSessionId: null,
    duplicateConfidence: null,
    suburb: "Manly",
    state: "NSW",
    venueName: "Example Tennis Club",
    startDate: null,
    startTime: "18:00",
    recurrenceDayOfWeek: "SATURDAY",
    createdAt: new Date("2026-01-01"),
    ...over,
  };
}

/** Patches the real `storage` singleton's DB-touching methods used by
    createPartnerEvent / the admin routes, with an in-memory
    implementation. Mirrors the REAL methods' control flow (same
    conditions), documented inline, same rationale as prior integration
    tests in this file set: proves the WIRING, not the raw SQL. */
function patchStorage(storage: any, db: FakeDb) {
  const originals: Record<string, any> = {};
  const patch = (name: string, fn: (...args: any[]) => any) => {
    originals[name] = storage[name];
    storage[name] = fn;
  };

  patch("getExternalActivityById", async (id: string) => {
    const row = db.rows.get(id);
    return row ? { ...row } : undefined;
  });
  patch("getOrganizationById", async (id: string) => {
    const org = db.organizations.get(id);
    return org ? { ...org } : undefined;
  });
  patch("getExternalActivitiesForDuplicateCheck", async () => Array.from(db.rows.values()));
  patch("getPublicSessionsForDuplicateCheck", async () => []);
  patch("createExternalActivity", async (record: Partial<Row>) => {
    const id = db.nextId("ext");
    const row = baseFields({ ...record, id, title: record.title! } as any);
    db.rows.set(id, row);
    return row;
  });
  patch("updateExternalActivity", async (id: string, data: Partial<Row>) => {
    const row = db.rows.get(id);
    if (!row) return undefined;
    Object.assign(row, data);
    return row;
  });
  patch("reviewExternalActivity", async (id: string, data: Partial<Row>) => {
    const row = db.rows.get(id);
    if (!row) return undefined;
    Object.assign(row, data);
    return row;
  });

  return () => Object.assign(storage, originals);
}

async function startServer(db: FakeDb) {
  const { storage } = await import("../storage");
  const unpatch = patchStorage(storage, db);
  const { default: adminDiscoveryRouter } = await import("./adminDiscovery");

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const isAdmin = req.header("x-test-admin") === "1";
    (req as any).user = isAdmin ? { id: "admin-1", isAdmin: true } : undefined;
    (req as any).isAuthenticated = () => !!(req as any).user;
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

async function call(baseUrl: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-test-admin": "1" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const VALID_EVENT = {
  title: "Saturday Social Tennis",
  description: null,
  activityType: "social",
  gameFormat: "doubles",
  startDate: null,
  endDate: null,
  startTime: "18:00",
  endTime: "20:00",
  recurrenceFrequency: "WEEKLY",
  recurrenceDayOfWeek: "SATURDAY",
  venueName: "Manly Lawn Tennis Courts",
  address: null,
  suburb: "Manly",
  city: "Sydney",
  state: "NSW",
  postcode: "2095",
  normalisedLevel: "Intermediate",
  price: null,
  priceLabel: null,
  registrationUrl: "https://manlylawntennis.com.au/book",
  partnerId: null,
  partnerName: "Manly Lawn Tennis Courts",
};

async function main() {
  console.log("Partner Events (real adminDiscovery router, real HTTP)\n");

  await test("FALLBACK PATH: creating a Partner Event with no partnerId (not yet a TC organisation)", async () => {
    const db = makeDb();
    const { baseUrl, close } = await startServer(db);
    try {
      const res = await call(baseUrl, "POST", "/partner-events", VALID_EVENT);
      assert.equal(res.status, 201, JSON.stringify(res.json));
      assert.equal(res.json.sourceType, "PARTNER");
      assert.equal(res.json.registrationType, "EXTERNAL");
      assert.equal(res.json.reviewStatus, "PENDING", "still needs the ordinary Approve/confirm step");
      assert.equal(res.json.partnerName, "Manly Lawn Tennis Courts");
      assert.equal(res.json.partnerId, null);
      assert.equal(res.json.sourceId, null, "no Discovery Source behind an admin-created Partner Event");
    } finally {
      await close();
    }
  });

  await test("a registered partner: partnerId must match a real organisation", async () => {
    const db = makeDb();
    db.organizations.set("org-1", { id: "org-1", name: "Manly Lawn Tennis Courts" });
    const { baseUrl, close } = await startServer(db);
    try {
      const ok = await call(baseUrl, "POST", "/partner-events", { ...VALID_EVENT, partnerId: "org-1" });
      assert.equal(ok.status, 201);
      assert.equal(ok.json.partnerId, "org-1");

      const bad = await call(baseUrl, "POST", "/partner-events", { ...VALID_EVENT, partnerId: "does-not-exist" });
      assert.equal(bad.status, 400, "a partnerId that isn't a real organisation must be rejected");
    } finally {
      await close();
    }
  });

  await test("registrationUrl is required - this is specifically the external-registration path", async () => {
    const db = makeDb();
    const { baseUrl, close } = await startServer(db);
    try {
      const { registrationUrl, ...noUrl } = VALID_EVENT;
      const res = await call(baseUrl, "POST", "/partner-events", noUrl);
      assert.equal(res.status, 400);
    } finally {
      await close();
    }
  });

  await test("PRIMARY PATH: confirming an EXISTING Discovery row as Partner upgrades it IN PLACE - no second row", async () => {
    const db = makeDb();
    const existing = baseFields({
      id: "ext-strathfield",
      title: "Saturday Social - Beginners",
      sourceType: "EXTERNAL",
      reviewStatus: "APPROVED",
    });
    db.rows.set(existing.id, existing);
    const { baseUrl, close } = await startServer(db);
    try {
      const res = await call(baseUrl, "POST", `/activities/${existing.id}/confirm-partner`, {
        partnerId: null,
        partnerName: "Strathfield Sports Club",
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.id, existing.id, "the SAME row, not a new one");
      assert.equal(res.json.sourceType, "PARTNER");
      assert.equal(res.json.registrationType, "EXTERNAL");
      assert.equal(res.json.partnerName, "Strathfield Sports Club");
      // Already-approved and visible in Play stays that way - upgrading
      // is not a new review cycle.
      assert.equal(res.json.reviewStatus, "APPROVED");
      assert.equal(db.rows.size, 1, "no second row was created for the same real event");
    } finally {
      await close();
    }
  });

  await test("confirming as partner on a still-PENDING row leaves it pending - still needs the ordinary Approve afterwards", async () => {
    const db = makeDb();
    const existing = baseFields({ id: "ext-new", title: "New Find", reviewStatus: "PENDING" });
    db.rows.set(existing.id, existing);
    const { baseUrl, close } = await startServer(db);
    try {
      const res = await call(baseUrl, "POST", `/activities/${existing.id}/confirm-partner`, { partnerId: null, partnerName: "A Partner" });
      assert.equal(res.json.sourceType, "PARTNER");
      assert.equal(res.json.reviewStatus, "PENDING");
    } finally {
      await close();
    }
  });

  await test("DEDUP PRIORITY: approving a new Partner Event that duplicates an existing approved EXTERNAL row retires the EXTERNAL one", async () => {
    const db = makeDb();
    // An existing, already-approved Discovery find for the same real event.
    const existingExternal = baseFields({
      id: "ext-old",
      title: "Saturday Social Tennis",
      sourceType: "EXTERNAL",
      reviewStatus: "APPROVED",
    });
    db.rows.set(existingExternal.id, existingExternal);

    const { baseUrl, close } = await startServer(db);
    try {
      // Admin creates a new Partner Event for the same event, not realising
      // Discovery already found it (the fallback path's whole reason to exist).
      const created = await call(baseUrl, "POST", "/partner-events", VALID_EVENT);
      assert.equal(created.status, 201);
      assert.equal(created.json.duplicateOfExternalId, existingExternal.id, "the new row should have been flagged against the existing one");

      // Admin approves the Partner Event - this IS the human confirmation
      // that it's the real, authoritative one.
      const approved = await call(baseUrl, "POST", `/activities/${created.json.id}/approve`, {});
      assert.equal(approved.status, 200);
      assert.equal(approved.json.reviewStatus, "APPROVED");
      assert.equal(approved.json.duplicateOfExternalId, null, "approving clears its OWN duplicate flag");

      // The OLD, lower-priority row must now be retired so Play never
      // shows both.
      const old = db.rows.get(existingExternal.id)!;
      assert.equal(old.reviewStatus, "DUPLICATE", "the superseded EXTERNAL row must be retired");
      assert.equal(old.duplicateOfExternalId, created.json.id, "pointing at the Partner Event that supersedes it");
    } finally {
      await close();
    }
  });

  await test("approving an ORDINARY (non-duplicate) Partner Event never touches any other row", async () => {
    const db = makeDb();
    const unrelated = baseFields({
      id: "ext-unrelated",
      title: "Completely Different Event",
      sourceType: "EXTERNAL",
      reviewStatus: "APPROVED",
      suburb: "Perth",
      state: "WA",
      venueName: "Totally Different Venue",
      startTime: "09:00",
      recurrenceDayOfWeek: "TUESDAY",
    });
    db.rows.set(unrelated.id, unrelated);
    const { baseUrl, close } = await startServer(db);
    try {
      const created = await call(baseUrl, "POST", "/partner-events", VALID_EVENT);
      assert.equal(created.json.duplicateOfExternalId, null);
      await call(baseUrl, "POST", `/activities/${created.json.id}/approve`, {});
      assert.equal(db.rows.get(unrelated.id)!.reviewStatus, "APPROVED", "an unrelated row must never be touched");
    } finally {
      await close();
    }
  });

  await test("approving a PLAIN (non-Partner) Discovery find never retires anything - only Partner approval does", async () => {
    const db = makeDb();
    const existingExternal = baseFields({ id: "ext-old-2", title: "Sunday Round Robin", sourceType: "EXTERNAL", reviewStatus: "APPROVED" });
    const newPendingExternal = baseFields({
      id: "ext-new-2",
      title: "Sunday Round Robin",
      sourceType: "EXTERNAL",
      reviewStatus: "PENDING",
      duplicateOfExternalId: "ext-old-2",
    });
    db.rows.set(existingExternal.id, existingExternal);
    db.rows.set(newPendingExternal.id, newPendingExternal);
    const { baseUrl, close } = await startServer(db);
    try {
      await call(baseUrl, "POST", `/activities/${newPendingExternal.id}/approve`, {});
      assert.equal(db.rows.get(existingExternal.id)!.reviewStatus, "APPROVED", "a plain EXTERNAL approval must not retire anything");
    } finally {
      await close();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
