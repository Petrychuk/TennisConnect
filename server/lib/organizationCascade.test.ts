// npx tsx --test server/lib/organizationCascade.test.ts   (part of npm run test:cleanup)
//
// Regression guard for organisation / account deletion: reads the REAL
// schema (shared/schema.ts) and checks that every foreign key into a table
// the cascades delete from is handled. A new table referencing
// organisations, sessions, seasons, series, rounds or users fails here
// until the cascade (and its coverage map) handles it - the bug class that
// left seasons/series/session templates/session updates undeleted.
// No database needed; behaviour against Postgres is in *.pg.test.ts.

import test from "node:test";
import assert from "node:assert/strict";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { getTableName, is } from "drizzle-orm";
import * as schema from "@shared/schema";
import { ORGANIZATION_CASCADE_COVERAGE, ORGANIZATION_CASCADE_TABLES } from "./organizationCascade";
import { USER_CASCADE_COVERAGE } from "./userCascade";

function foreignKeysInto(targets: ReadonlySet<string>): string[] {
  const found = new Set<string>();
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value as PgTable);
    for (const fk of config.foreignKeys) {
      const reference = fk.reference();
      if (targets.has(getTableName(reference.foreignTable))) {
        for (const column of reference.columns) found.add(`${config.name}.${column.name}`);
      }
    }
  }
  return Array.from(found).sort();
}

test("organisation cascade handles every foreign key into the tables it deletes from", () => {
  // Rows are deleted from these tables; "users" is the user cascade's job.
  const intoCascaded = foreignKeysInto(new Set(ORGANIZATION_CASCADE_TABLES));
  const covered = Object.keys(ORGANIZATION_CASCADE_COVERAGE).sort();
  const missing = intoCascaded.filter((key) => !covered.includes(key));
  assert.deepEqual(missing, [], `unhandled foreign keys - add them to organizationCascade.ts: ${missing.join(", ")}`);
});

test("organisation coverage map lists no foreign key that does not exist", () => {
  const intoCascaded = foreignKeysInto(new Set(ORGANIZATION_CASCADE_TABLES));
  const stale = Object.keys(ORGANIZATION_CASCADE_COVERAGE).filter((key) => !intoCascaded.includes(key));
  assert.deepEqual(stale, []);
});

test("the four tables that used to break organisation deletion are covered", () => {
  for (const key of [
    "seasons.organization_id",
    "series.organization_id",
    "session_templates.organization_id",
    "session_updates.session_id",
  ]) {
    assert.equal(ORGANIZATION_CASCADE_COVERAGE[key], "delete", key);
  }
});

test("user cascade handles every foreign key into users (exactly)", () => {
  const intoUsers = foreignKeysInto(new Set(["users"]));
  const covered = Object.keys(USER_CASCADE_COVERAGE).sort();
  assert.deepEqual(
    intoUsers.filter((key) => !covered.includes(key)),
    [],
    "unhandled foreign keys into users - add them to userCascade.ts"
  );
  assert.deepEqual(covered.filter((key) => !intoUsers.includes(key)), [], "stale entries in USER_CASCADE_COVERAGE");
  assert.equal(USER_CASCADE_COVERAGE["external_activities.reviewed_by"], "set-null");
});
