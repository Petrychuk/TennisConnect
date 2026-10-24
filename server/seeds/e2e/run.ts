// E2E fixture seed CLI - Staging only, explicit operator action (Stage 2).
//
//   npm run e2e:seed:staging                       # dry run (default): read-only plan
//   npm run e2e:seed:staging -- --apply --confirm=<user>@<host>/<database>
//   optional: --anchor=YYYY-MM-DD  (default today; at most 7 days ago)
//             --rotate-passwords   (re-set EXISTING baseline passwords from env)
//
// Order matters:
//   1. the gate (safety.ts) runs on the raw process environment BEFORE any
//      database module is imported - server/db.ts opens a pool and calls
//      dotenv on import, so nothing may load it until the target is approved;
//   2. db + store are imported dynamically, then the gate is re-checked (the
//      values must not have changed, and dotenv must not have added PG*
//      overrides) and current_database() / current_user must match;
//   3. the plan is read-only; conflicts abort before anything is written;
//   4. --apply writes inside ONE transaction - any error rolls everything back.
//
// Prints user@host/database, counts and conflicts only - never credentials,
// passwords or hashes. Never runs in CI (the gate refuses).

import { randomBytes } from "node:crypto";
import {
  SeedSafetyError,
  assertConnectedDatabase,
  assertSeedTarget,
  parseAnchor,
  parseSeedArgs,
  readBaselinePasswords,
} from "./safety";
import { buildFixtureSet, fixtureValidUntil } from "./fixtures";

async function main(): Promise<number> {
  const args = parseSeedArgs(process.argv.slice(2));
  const gate = assertSeedTarget(process.env, args);
  const anchor = parseAnchor(args.anchor);
  const set = buildFixtureSet(anchor);

  console.log(`[e2e-seed] target ${gate.target.label} (DB_ENV=staging), mode ${gate.mode}, anchor ${set.anchor}`);
  console.log(`[e2e-seed] upcoming fixtures stay upcoming until ${fixtureValidUntil(set).toISOString().slice(0, 10)} - re-run the seed before then`);

  const snapshot = { url: process.env.DATABASE_URL, dbEnv: process.env.DB_ENV, approved: process.env.E2E_APPROVED_STAGING_DB };
  const { db, pool } = await import("../../db");
  try {
    if (
      process.env.DATABASE_URL !== snapshot.url ||
      process.env.DB_ENV !== snapshot.dbEnv ||
      process.env.E2E_APPROVED_STAGING_DB !== snapshot.approved
    ) {
      throw new SeedSafetyError("database settings changed while loading the database module.");
    }
    // dotenv (.env.dev) may have ADDED variables such as PGHOST - the whole
    // gate runs again before the first query opens a connection.
    const recheck = assertSeedTarget(process.env, args);
    if (recheck.target.label !== gate.target.label || recheck.mode !== gate.mode) {
      throw new SeedSafetyError("gate result changed while loading the database module.");
    }

    const { sql } = await import("drizzle-orm");
    const result = await db.execute(sql`select current_database() as database, current_user as "user"`);
    const rows = (result as unknown as { rows?: { database?: string; user?: string }[] }).rows ?? [];
    assertConnectedDatabase(gate.target, { database: rows[0]?.database, user: rows[0]?.user });

    const { createDrizzleSeedStore } = await import("./drizzleStore");
    const { planSeed, summarisePlan, applySeed, requiredPasswordEnvs } = await import("./seeder");

    const plan = await planSeed(set, createDrizzleSeedStore(db));
    for (const line of summarisePlan(plan)) console.log(`[e2e-seed]   ${line}`);
    if (plan.conflicts.length > 0) {
      console.error(`[e2e-seed] ${plan.conflicts.length} conflict(s) - nothing written:`);
      for (const conflict of plan.conflicts) console.error(`[e2e-seed]   - ${conflict}`);
      return 2;
    }
    if (gate.mode === "dry-run") {
      const needed = requiredPasswordEnvs(set, plan, false);
      console.log(`[e2e-seed] --apply will need: ${needed.length ? needed.join(", ") : "no passwords (all baseline accounts exist; their passwords are kept)"}`);
      console.log(`[e2e-seed] dry run - nothing written. Re-run with --apply --confirm=${gate.target.label} to write.`);
      return 0;
    }

    // Only the passwords this apply will write: accounts being created, or
    // every baseline account with --rotate-passwords. Existing passwords are kept.
    const baselinePasswords = readBaselinePasswords(process.env, requiredPasswordEnvs(set, plan, args.rotatePasswords));
    const { hashPassword } = await import("../../lib/passwords");
    const report = await db.transaction(tx =>
      applySeed(set, createDrizzleSeedStore(tx), {
        hashPassword,
        randomPassword: () => randomBytes(32).toString("base64url"),
        baselinePasswords,
        rotatePasswords: args.rotatePasswords,
      })
    );
    console.log(`[e2e-seed] applied. created ${JSON.stringify(report.created)}, updated ${JSON.stringify(report.updated)}`);
    return 0;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().then(
  code => process.exit(code),
  error => {
    // SeedSafetyError messages carry names/labels only; other errors are
    // reduced to their message so no connection string or stack leaks.
    console.error(error instanceof SeedSafetyError ? error.message : `[e2e-seed] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
);
