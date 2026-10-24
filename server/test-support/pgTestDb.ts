// Test support only - never imported by the app.
//
// A throwaway Postgres schema for database integration tests
// (*.pg.test.ts). Opt-in: set E2E_TEST_PG_URL to a LOCAL server, e.g.
//   E2E_TEST_PG_URL=postgres://postgres@127.0.0.1:5432/tc_it
// (CI's db-integration job starts a postgres:16 service container).
// Without it the tests skip.
//
// Refuses anything that is not loopback (localhost / 127.0.0.1 / ::1), so
// it can never be pointed at Staging or Production. Each run creates its
// own schema "it_<random>", loads the DDL generated from shared/schema.ts
// (schemaDdl.ts) and drops the schema afterwards.

import { randomBytes } from "node:crypto";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { buildSchemaDdl } from "./schemaDdl";

export const TEST_PG_URL_ENV = "E2E_TEST_PG_URL";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export interface TestDb {
  db: NodePgDatabase<typeof schema>;
  pool: pg.Pool;
  schemaName: string;
  dispose(): Promise<void>;
}

export function testPgUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const url = env[TEST_PG_URL_ENV];
  if (!url) return undefined;
  const parsed = new URL(url);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${TEST_PG_URL_ENV} must be a postgres:// URL`);
  }
  if (!LOOPBACK.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${TEST_PG_URL_ENV} must point at a local (loopback) Postgres - refusing ${parsed.hostname}`);
  }
  return url;
}

export async function createTestDb(url: string): Promise<TestDb> {
  const schemaName = `it_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA ${schemaName}`);
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool({ connectionString: url, max: 2, options: `-c search_path=${schemaName}` });
  const ddl = buildSchemaDdl();
  const client = await pool.connect();
  try {
    for (const statement of ddl.tables) await client.query(statement);
    for (const statement of ddl.foreignKeys) await client.query(statement);
  } finally {
    client.release();
  }

  return {
    db: drizzle(pool, { schema }),
    pool,
    schemaName,
    async dispose() {
      await pool.query(`DROP SCHEMA ${schemaName} CASCADE`).catch(() => undefined);
      await pool.end();
    },
  };
}
