import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dotenv from "dotenv";
import * as schema from "@shared/schema";

// Определяем, какой .env файл грузить
const envFile = process.env.NODE_ENV === "development" ? ".env.dev" : ".env";
dotenv.config({ path: envFile });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    `DATABASE_URL must be set. Current NODE_ENV=${process.env.NODE_ENV}`
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// node-postgres emits 'error' on the pool whenever an *idle* client's
// connection is dropped (e.g. the DB closing a quiet connection) - if
// nothing is listening for that event, Node treats it as an unhandled
// error and crashes the whole process. A crashed process is what turns
// a single dropped idle connection into a site-wide 502 until the host
// restarts it, so this just logs and lets the pool reconnect on the
// next query instead.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client (main pool):", err);
});

export const db = drizzle(pool, { schema });
