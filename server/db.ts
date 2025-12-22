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

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
