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

// max is set well under the Supabase pooler's session-mode connection
// ceiling (its error message literally says "pool_size: 15"). This pool
// is now the ONLY pool in the whole app - see auth.ts, which used to
// open a second, separate Pool for the session store. Two independent
// pools each defaulting to pg's max of 10 could total up to 20
// connections, well past that 15 limit - which is exactly what "max
// clients reached in session mode" in the Railway logs was reporting.
// Reusing this single pool everywhere plus capping it here is the fix,
// not just logging the error and moving on.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Without this, a connection that goes stale mid-query - the laptop
  // sleeping, a brief WiFi drop between here and the remote Supabase
  // DB - just hangs until the OS's own TCP retransmission timeout
  // gives up, commonly around two minutes. That's the exact shape of
  // a "[SLOW REQUEST] ... 121177ms" on an otherwise ordinary query:
  // not the query being slow, the socket being dead and nobody
  // noticing yet. TCP keepalive probes let the OS notice much sooner
  // and fail the query with a normal connection error instead.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
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
