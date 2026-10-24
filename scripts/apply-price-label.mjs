#!/usr/bin/env node
// Wires conditional pricing (priceLabel) through the Discovery Agent and Play.
//
//   node scripts/apply-price-label.mjs --check    # report only, writes nothing
//   node scripts/apply-price-label.mjs            # apply
//
// Run from the repository root, AFTER applying patch 0101 (which adds
// discoveryPrice.ts and migration 0031).
//
// Safety model:
//  - ALL-OR-NOTHING. Every edit is computed in memory first; if any anchor
//    is missing or ambiguous, nothing is written and each problem is listed.
//  - Anchors are matched ignoring whitespace differences (indentation, CRLF
//    vs LF), and must match EXACTLY ONCE.
//  - Idempotent: an edit whose result is already present is skipped, so a
//    second run is a no-op.
//  - It only edits the listed files. Review with `git diff` before committing.

import fs from "node:fs";

const CHECK = process.argv.includes("--check");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whitespace-insensitive matcher for an anchor written as normal source.
const matcher = (anchor) =>
  new RegExp(anchor.trim().split(/\s+/).map(esc).join("\\s+"), "g");

const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");
const withEol = (s, eol) => s.replace(/\r?\n/g, eol);

/** edit kinds: after (append to the anchor), replace, before (prepend to it) */
const edits = [];
const E = (file, marker, kind, anchor, text, opts = {}) => edits.push({ file, marker, kind, anchor, text, ...opts });

// ---------------------------------------------------------------- schema
E("shared/schema.ts", 'priceLabel: text("price_label")', "replace",
  'price: integer("price"), // whole-dollar AUD; null when not stated - never invented currency: text("currency")',
  `price: integer("price"), // whole-dollar AUD; null when not stated - never invented
  // Display value for price, and the source of truth for what players see.
  // Keeps member / non-member pricing ("Free for SSC tennis members · $20 per
  // week for non-members"). \`price\` above is the general / non-member amount,
  // for filtering and sorting only - never a member-only figure.
  priceLabel: text("price_label"),
  currency: text("currency")`);

E("shared/schema.ts", "priceSummary?: string | null", "after",
  "externalLastCheckedAt?: string | null;",
  `
  // Only populated for EXTERNAL cards. priceSummary is the compact card form
  // ("$20 · Free for members"); priceLabel is the full text for Quick View.
  priceSummary?: string | null;
  priceLabel?: string | null;`);

// --------------------------------------------------------------- storage
E("server/storage.ts", "summariseLabelForCard", "after",
  'import { expandOccurrences, makeOccurrenceId, parseOccurrenceId } from "./services/discoveryOccurrences";',
  '\nimport { summariseLabelForCard } from "./services/discoveryPrice";');

E("server/storage.ts", "priceSummary: summariseLabelForCard", "after",
  "externalLastCheckedAt: lastChecked,",
  `
        priceSummary: summariseLabelForCard(activity.priceLabel, activity.price),
        priceLabel: activity.priceLabel,`);

E("server/storage.ts", 'activity.price === 0 ? "Free"', "replace",
  "price: activity.price != null ? String(activity.price) : null,",
  'price: activity.price != null ? (activity.price === 0 ? "Free" : String(activity.price)) : null,');

// ------------------------------------------------------------ extraction
E("server/services/discoveryExtraction.ts", "EXTRACTION_VERSION", "after",
  "export const MAX_ACTIVITIES_PER_PAGE = 20;",
  `

/**
 * Part of every page's cache key (see discoveryOrchestration). Bump it
 * whenever the prompt, or the rules that interpret the model's answer,
 * change - otherwise an unchanged page is never re-extracted and stale
 * results (e.g. a wrong price) would live on. Version 2: price is now
 * derived from the source's wording (priceText), not asked of the model.
 */
export const EXTRACTION_VERSION = 2;`);

E("server/services/discoveryExtraction.ts", "priceText: z.string()", "after",
  "price: z.number().min(0).max(10000).nullable(),",
  `

  // The source's own price wording, verbatim, INCLUDING conditions ("FREE for
  // members. $20 for non-members"). The amount and label are derived from
  // this by discoveryPrice.ts - the model is not trusted to pick a number.
  priceText: z.string().max(400).nullable().optional(),`);

E("server/services/discoveryExtraction.ts", '"priceText": string | null', "replace",
  `"price": number | null (a plain number in whole dollars, only if a specific price is stated - never invent one. If members and non-members pay different amounts, report the non-member / casual / visitor price and quote both in evidence; if the activity is stated to be free, use 0),`,
  `"priceText": string | null (EVERY statement of price for THIS activity, copied word-for-word from the page, including free / member / non-member wording - e.g. "FREE for SSC tennis members. $20 pp applicable to non-tennis members each week." Do not summarise, do not choose between prices, do not drop a condition. null if the page states no price for this activity),
  "price": null (always null - the price is worked out from priceText by our own code; do not fill this in),`);

// ---------------------------------------------------------------- record
E("server/services/discoveryRecord.ts", 'from "./discoveryPrice"', "after",
  'import { parseRecurrenceText, type ParsedRecurrence } from "./discoveryOccurrences";',
  '\nimport { resolvePrice } from "./discoveryPrice";');

E("server/services/discoveryRecord.ts", "priceLabel: string | null;", "replace",
  "price: number | null; currency: string;",
  `price: number | null;
    /** Display value; keeps member / non-member pricing. */
    priceLabel: string | null;
    currency: string;`);

E("server/services/discoveryRecord.ts", "priceReview: string | null;", "replace",
  "recurrenceUnderstood: boolean; }",
  `recurrenceUnderstood: boolean;
  /** Why an admin should look at the price (null when the wording was clear). */
  priceReview: string | null;
  /** The source's own price wording, kept as evidence. */
  priceWording: string | null;
}`);

E("server/services/discoveryRecord.ts", "resolvePrice(priceWording)", "after",
  "const recurrence = parseRecurrenceText(extracted.recurrenceText);",
  `
  // Price: the model only COPIES the source's wording; the amount and the
  // label are decided here (discoveryPrice.ts). A bare number with no
  // wording behind it is unsupported - never trusted, and flagged.
  const priceWording = extracted.priceText ?? extracted.evidence?.price ?? null;
  const priced = resolvePrice(priceWording);
  const unsupportedPrice = priceWording === null && extracted.price != null;`);

E("server/services/discoveryRecord.ts", "price: priced.price,", "replace",
  `// The column is whole dollars; a stated $12.50 rounds rather than
      // failing the insert.
      price: extracted.price != null ? Math.round(extracted.price) : null,`,
  `// numeric: what a general (non-member) player pays, or null. 0 ONLY when
      // the source says it's free. priceLabel: what players are shown.
      price: priced.price,
      priceLabel: priced.label,`);

E("server/services/discoveryRecord.ts", "priceReview: unsupportedPrice", "replace",
  `!recurrence || (recurrence.understood && (recurrence.frequency !== "FORTNIGHTLY" || !!extracted.startDate)),
  };`,
  `!recurrence || (recurrence.understood && (recurrence.frequency !== "FORTNIGHTLY" || !!extracted.startDate)),
    priceWording,
    priceReview: unsupportedPrice ? "A price was returned with no price wording from the page" : priced.review,
  };`);

// --------------------------------------------------------- orchestration
E("server/services/discoveryOrchestration.ts", "EXTRACTION_VERSION", "replace",
  'import { callExtractionLLM, classifyConfidence, type ExtractedActivity } from "./discoveryExtraction";',
  'import { callExtractionLLM, classifyConfidence, EXTRACTION_VERSION, type ExtractedActivity } from "./discoveryExtraction";');

E("server/services/discoveryOrchestration.ts", "${EXTRACTION_VERSION}", "replace",
  "const hash = sha256(pageText);",
  `// The extraction version is part of the cache key: when the prompt or the
  // rules that interpret it change, pages are re-extracted even though their
  // text hasn't.
  const hash = sha256(\`v\${EXTRACTION_VERSION}\\n\${pageText}\`);`);

E("server/services/discoveryOrchestration.ts", "evidence.price = built.priceWording", "after",
  "if (extracted.recurrenceText) evidence.recurrence = extracted.recurrenceText;",
  `
  // The source's own price wording - so an admin can see exactly what the
  // price and label were derived from.
  if (built.priceWording) evidence.price = built.priceWording;`);

E("server/services/discoveryOrchestration.ts", "priceUnclear: !!built.priceReview", "after",
  "recurrenceUnderstood: built.recurrenceUnderstood,",
  `
    priceUnclear: !!built.priceReview,`);

E("server/services/discoveryOrchestration.ts", "priceLabel: row.priceLabel", "replace",
  "price: row.price, registrationUrl: row.registrationUrl,",
  `price: row.price,
    priceLabel: row.priceLabel,
    registrationUrl: row.registrationUrl,`);

// ----------------------------------------------------------------- queue
E("server/services/discoveryQueue.ts", "priceUnclear?: boolean", "replace",
  "recurrenceUnderstood?: boolean; }",
  `recurrenceUnderstood?: boolean;
  /** The source's price wording couldn't be reduced to one honest number. */
  priceUnclear?: boolean;
}`);

E("server/services/discoveryQueue.ts", "Price is unclear", "after",
  `if (input.recurrenceUnderstood === false) reasons.push("Repeat pattern couldn't be turned into dates");`,
  `
  if (input.priceUnclear === true) reasons.push("Price is unclear - check the source's wording");`);

// ------------------------------------------------------------- freshness
E("server/services/discoveryFreshness.ts", '"priceLabel"', "replace",
  '"price", "registrationUrl", ] as const;',
  `"price",
  "priceLabel",
  "registrationUrl",
] as const;`);

// ----------------------------------------------------------- admin route
E("server/routes/adminDiscovery.ts", "priceLabel: optText(200)", "after",
  "price: z.preprocess(blankToNull, z.number().int().min(0).max(10000).nullable()),",
  `
    priceLabel: optText(200),`);

// -------------------------------------------------------------- admin UI
E("client/src/pages/admin-discovery.tsx", "priceLabel: string | null;", "after",
  "price: number | null;",
  `
  priceLabel: string | null;`);

E("client/src/pages/admin-discovery.tsx", "item.priceLabel ??", "replace",
  "item.price != null && `$${item.price}`,",
  'item.priceLabel ?? (item.price != null ? (item.price === 0 ? "Free" : `$${item.price}`) : null),');

E("client/src/pages/admin-discovery.tsx", "const evidenceEntries", "after",
  "const statusBadge = STATUS_BADGES[item.discoveryStatus];",
  `
                      // The source's own wording behind each extracted field (price,
                      // recurrence, ...) - lets an admin check the Agent against the page.
                      const evidenceEntries = Object.entries(item.extractionEvidence ?? {}).filter(([k]) => !k.startsWith("_"));`);

E("client/src/pages/admin-discovery.tsx", "discovery-item-${item.id}-wording", "before",
  "{changed && (",
  `{(evidenceEntries.length > 0 || item.originalLevelText) && (
                              <details className="text-xs text-muted-foreground" data-testid={\`discovery-item-\${item.id}-wording\`}>
                                <summary className="cursor-pointer">Source wording</summary>
                                <ul className="mt-1 space-y-0.5">
                                  {evidenceEntries.map(([k, v]) => (
                                    <li key={k}>
                                      <span className="font-medium">{k}:</span> {v}
                                    </li>
                                  ))}
                                  {item.originalLevelText && (
                                    <li>
                                      <span className="font-medium">level:</span> {item.originalLevelText}
                                    </li>
                                  )}
                                </ul>
                              </details>
                            )}
                            `);

E("client/src/pages/admin-discovery.tsx", "priceLabel: editDraft.priceLabel", "after",
  "price: editDraft.price ?? null,",
  `
      priceLabel: editDraft.priceLabel ?? null,`);

E("client/src/pages/admin-discovery.tsx", "Price label (shown to players)", "before",
  "<div> <Label>Registration link</Label>",
  `<div>
              <Label>Price label (shown to players)</Label>
              <Input
                value={editDraft.priceLabel ?? ""}
                onChange={(e) => setEditDraft((d) => ({ ...d, priceLabel: e.target.value }))}
                placeholder="e.g. Free for members · $20 for non-members"
              />
            </div>
            `);

// ------------------------------------------------------------- Play card
E("client/src/components/play/session-card.tsx", "-price`}", "after",
  '<p className="text-sm text-muted-foreground">{formatWhen(session)}</p>',
  `

        {session.priceSummary && (
          <p className="text-sm text-muted-foreground" data-testid={\`play-session-card-\${session.id}-price\`}>
            {session.priceSummary}
          </p>
        )}`);

E("client/src/components/play/EventQuickViewModal.tsx", "session.priceLabel", "replace",
  `{session.price && ( <p className="flex items-center gap-2" data-testid="event-modal-price"> <DollarSign className="w-4 h-4 shrink-0" /> {session.price}`,
  `{(session.priceLabel || session.price) && (
                  <p className="flex items-start gap-2" data-testid="event-modal-price">
                    <DollarSign className="w-4 h-4 shrink-0 mt-0.5" />{" "}
                    <span className="flex flex-col">
                      {(session.priceLabel ? session.priceLabel.split(" · ") : [session.price]).map((line, i) => (
                        <span key={i}>{line}</span>
                      ))}
                    </span>`);

// ------------------------------------------------- pilot test (existing)
const PT = "server/services/discoveryPilot.test.ts";
E(PT, "priceText: null,", "replace",
  "levelText: null, price: null, currency: null, organiserName: null, registrationUrl: null,",
  "levelText: null, price: null, priceText: null, currency: null, organiserName: null, registrationUrl: null,");
E(PT, 'priceText: "Free entry and afternoon tea provided."', "replace",
  'venueName: "Keon Park Tennis Club", price: 0 }',
  'venueName: "Keon Park Tennis Club", priceText: "Free entry and afternoon tea provided." }');
E(PT, "This free 10 week program", "replace",
  'venueName: "Fawkner Tennis Club", price: 0,',
  'venueName: "Fawkner Tennis Club", priceText: "This free 10 week program is free and inclusive to any women and girls",');
E(PT, "const STRATHFIELD_PRICE", "before",
  "const nsw = run(NSW, {",
  `const STRATHFIELD_PRICE = "FREE for SSC tennis members. $20 pp applicable to non-tennis members each week.";
`);
E(PT, 'levelText: "Beginners Social", priceText', "replace",
  'levelText: "Beginners Social", price: 20, currency: "AUD", registrationUrl: signUp,',
  'levelText: "Beginners Social", priceText: STRATHFIELD_PRICE, currency: "AUD", registrationUrl: signUp,');
E(PT, 'levelText: "Competitive/Advanced Social", priceText', "replace",
  'levelText: "Competitive/Advanced Social", price: 20, currency: "AUD", registrationUrl: signUp,',
  'levelText: "Competitive/Advanced Social", priceText: STRATHFIELD_PRICE, currency: "AUD", registrationUrl: signUp,');
// QTC: two rows carry the same price fields
E(PT, "Member Rates: $20/session", "replace",
  'levelText: "all standards", price: 24, currency: "AUD",',
  'levelText: "all standards", priceText: "Member Rates: $20/session. Non-Member Rates: $24/session", currency: "AUD",',
  { expect: 2 });
E(PT, "Pricing: conditional prices are kept", "before",
  "// Pilot success criteria, summarised",
  `// ---------------------------------------------------------------
// Pricing: conditional prices are kept, never collapsed to $0
// ---------------------------------------------------------------
test("NSW: 'FREE for members. $20 for non-members' is stored as $20 with BOTH prices in the label - never $0", () => {
  for (const e of nsw) {
    assert.equal(e.record.price, 20);
    assert.equal(e.record.priceLabel, "Free for SSC tennis members · $20 per week for non-members");
    assert.equal(e.record.currency, "AUD");
  }
});

test("QLD: member and non-member rates are both kept; the numeric price is the non-member one", () => {
  for (const e of qld) {
    assert.equal(e.record.price, 24);
    assert.equal(e.record.priceLabel, "$20 per session for members · $24 per session for non-members");
  }
});

test("VIC: an explicitly free event is 0/'Free'; an event with no price stated is null - not 0", () => {
  assert.equal(byTitle(vic, "Growing the Game: Women and Girl's Tennis").record.price, 0);
  assert.equal(byTitle(vic, "Growing the Game: Women and Girl's Tennis").record.priceLabel, "Free");
  assert.equal(byTitle(vic, "Friday Night Smash").record.price, null);
  assert.equal(byTitle(vic, "Friday Night Smash").record.priceLabel, null);
});

test("a model that returns a bare price number with no wording behind it is not trusted", () => {
  const [e] = run(NSW, { activities: [act({ title: "Saturday Social", price: 0 })] });
  assert.equal(e.record.price, null); // NOT 0
  assert.ok(e.priceReview);
});

`);

// ==================================================================== run
const files = [...new Set(edits.map((e) => e.file))];
const content = {};
const problems = [];
for (const f of files) {
  if (!fs.existsSync(f)) {
    problems.push(`${f}: file not found (run from the repository root)`);
    continue;
  }
  content[f] = fs.readFileSync(f, "utf8");
}

let applied = 0;
let skipped = 0;
for (const e of edits) {
  const text = content[e.file];
  if (text === undefined) continue;
  if (text.includes(e.marker)) {
    skipped++;
    continue; // already applied
  }
  const re = matcher(e.anchor);
  const found = [...text.matchAll(re)];
  const want = e.expect ?? 1;
  if (found.length !== want) {
    problems.push(`${e.file}: anchor matched ${found.length}x (expected ${want}): ${e.anchor.trim().slice(0, 90).replace(/\s+/g, " ")}...`);
    continue;
  }
  // Apply from the last match to the first so earlier offsets stay valid.
  let out = text;
  for (const m of [...found].reverse()) {
    const eol = eolOf(m[0]) === "\r\n" || eolOf(text) === "\r\n" ? "\r\n" : "\n";
    const add = withEol(e.text, eol);
    const next = e.kind === "after" ? m[0] + add : e.kind === "before" ? add + m[0] : add;
    out = out.slice(0, m.index) + next + out.slice(m.index + m[0].length);
  }
  content[e.file] = out;
  applied++;
}

if (problems.length) {
  console.error(`\nNOTHING WAS WRITTEN. ${problems.length} problem(s):\n`);
  for (const p of problems) console.error("  - " + p);
  console.error("\nSend this list back and the anchors will be adjusted.");
  process.exit(1);
}

if (CHECK) {
  console.log(`OK (check only): ${applied} edit(s) would apply, ${skipped} already present, across ${files.length} files.`);
  process.exit(0);
}
for (const f of files) fs.writeFileSync(f, content[f], "utf8");
console.log(`Applied ${applied} edit(s), skipped ${skipped} already present, across ${files.length} files.`);
console.log("Next: apply migration 0031, run `npx tsc --noEmit`, then the discovery test files.");
