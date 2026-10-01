#!/usr/bin/env node
// Fixes: GET /api/play/sessions returned an empty list whenever there
// were zero native TennisConnect sessions - approved Discovery Agent
// external activities never showed, regardless of their own status.
//
//   node fix-play-empty-zero-native.mjs --check   # report only, writes nothing
//   node fix-play-empty-zero-native.mjs           # apply
//
// Run from the repository root. Standalone from the priceLabel wiring
// patch - this only touches the `rows.length === 0` early return in
// getPublicSessions() and doesn't assume anything about the exact shape
// of the priceLabel changes already applied, so it's independent of
// which git patch (or none) put those there.
//
// Safety model: same as apply-price-label.mjs - all-or-nothing, matches
// ignoring whitespace, writes nothing if the anchor isn't found exactly
// once, idempotent (a second run is a no-op).

import fs from "node:fs";

const CHECK = process.argv.includes("--check");
const FILE = "server/storage.ts";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matcher = (anchor) => new RegExp(anchor.trim().split(/\s+/).map(esc).join("\\s+"), "g");
const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");
const withEol = (s, eol) => s.replace(/\r?\n/g, eol);

const MARKER = "[BUG][PLAY][DISCOVERY] This used to";

const OLD_ANCHOR = `if (rows.length === 0) return [];

    const sessionIds = rows.map((r) => r.session.id);
    const countRows = await db
      .select({ sessionId: registrations.sessionId, count: sql<number>\`count(*)\` })
      .from(registrations)
      .where(and(inArray(registrations.sessionId, sessionIds), ne(registrations.status, "cancelled")))
      .groupBy(registrations.sessionId);
    const countBySession = new Map(countRows.map((r) => [r.sessionId, Number(r.count)]));

    let cards = rows.map(({ session, organization }) =>
      this.toPublicSessionCard(session, organization, countBySession.get(session.id) ?? 0)
    );`;

const NEW_TEXT = `// [BUG][PLAY][DISCOVERY] This used to `+`\`return []\``+` here whenever there
    // were no native sessions - a harmless-looking optimisation to skip
    // the registration-count query below when there's nothing to count.
    // But the external-activities merge (spec section 20) lives further
    // down in this same function, so that early return also skipped
    // EVERY approved external activity whenever there happened to be zero
    // native sessions - exactly staging's actual state (0 published
    // sessions, 2 approved external activities), which made /play show
    // nothing at all despite Discovery working correctly end to end.
    let cards: PublicSessionCard[] = [];
    if (rows.length > 0) {
      const sessionIds = rows.map((r) => r.session.id);
      const countRows = await db
        .select({ sessionId: registrations.sessionId, count: sql<number>\`count(*)\` })
        .from(registrations)
        .where(and(inArray(registrations.sessionId, sessionIds), ne(registrations.status, "cancelled")))
        .groupBy(registrations.sessionId);
      const countBySession = new Map(countRows.map((r) => [r.sessionId, Number(r.count)]));

      cards = rows.map(({ session, organization }) =>
        this.toPublicSessionCard(session, organization, countBySession.get(session.id) ?? 0)
      );
    }`;

if (!fs.existsSync(FILE)) {
  console.error(`NOTHING WAS WRITTEN.\n  - ${FILE}: file not found (run from the repository root)`);
  process.exit(1);
}
const text = fs.readFileSync(FILE, "utf8");

if (text.includes(MARKER)) {
  console.log(CHECK ? "OK (check only): already applied, nothing to do." : "Already applied - nothing to do.");
  process.exit(0);
}

const re = matcher(OLD_ANCHOR);
const found = [...text.matchAll(re)];
if (found.length !== 1) {
  console.error(
    `NOTHING WAS WRITTEN.\n  - ${FILE}: anchor matched ${found.length}x (need exactly 1).\n` +
      `    Looking for the "if (rows.length === 0) return [];" block inside getPublicSessions().\n` +
      `    Send this message back and the anchor will be adjusted.`
  );
  process.exit(1);
}

const m = found[0];
const eol = eolOf(m[0]) === "\r\n" || eolOf(text) === "\r\n" ? "\r\n" : "\n";
const next = text.slice(0, m.index) + withEol(NEW_TEXT, eol) + text.slice(m.index + m[0].length);

if (CHECK) {
  console.log("OK (check only): 1 edit would apply.");
  process.exit(0);
}
fs.writeFileSync(FILE, next, "utf8");
console.log(`Applied the fix to ${FILE}.`);
console.log("Next: restart the dev server, then reload /play.");
