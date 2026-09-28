// The Discovery Agent's V1 pilot: 3 real sources from 3 states, chosen
// to cover 3 different page structures (spec section 23).
//
//   npm run seed:discovery-pilot
//
// Idempotent - matched on the main page URL, so running it twice never
// adds a second copy (and never overwrites edits made in the Sources tab).
// Same safety model as the other seeds: refuses to run unless
// NODE_ENV=development. For staging/production, add the same three
// sources from Admin -> Discovery -> Sources (the values below are exactly
// what to enter).
//
// Adding a source does NOT scan it. The first scan is a deliberate admin
// action: Sources tab -> Run, with "Dry run" ticked.

import { db } from "../db";
import { eq } from "drizzle-orm";
import { discoverySources } from "@shared/schema";
import { assertDevEnvironment } from "./liveSessionSeed";

const PILOT_SOURCES = [
  {
    // Structure: an EVENT LISTING page - several dated events on one page.
    name: "Tennis Victoria - What's On",
    baseUrl: "https://www.tennis.com.au/vic/events/whats-on",
    sourceType: "TENNIS_ORGANISATION",
    state: "VIC",
    city: null, // a state body: events are in many cities, so no single city
  },
  {
    // Structure: an INDIVIDUAL EVENT page - one club's standing Saturday session.
    name: "Strathfield Sports Club - Saturday Social",
    baseUrl: "https://strathfieldsportsclub.com.au/events/saturday-social-2026-08-01/",
    sourceType: "CLUB",
    state: "NSW",
    city: "Sydney",
  },
  {
    // Structure: a RECURRING PROGRAM page - weekly sessions, no calendar dates.
    name: "Queensland Tennis Centre - Social Tennis",
    baseUrl: "https://www.queenslandtenniscentre.com.au/adults/programs-fixtures/social-tennis/",
    sourceType: "CLUB",
    state: "QLD",
    city: "Brisbane",
  },
] as const;

async function main() {
  assertDevEnvironment();
  for (const source of PILOT_SOURCES) {
    const [existing] = await db.select({ id: discoverySources.id }).from(discoverySources).where(eq(discoverySources.baseUrl, source.baseUrl));
    if (existing) {
      console.log(`exists   ${source.name}`);
      continue;
    }
    await db.insert(discoverySources).values({
      ...source,
      country: "Australia",
      enabled: true,
      discoveryMethod: "AI_EXTRACTION",
      extraUrls: [],
    });
    console.log(`created  ${source.name}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
