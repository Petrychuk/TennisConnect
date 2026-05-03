import dotenv from "dotenv";

const envFile =
  process.env.NODE_ENV === "development" ? ".env.dev" : ".env";

dotenv.config({ path: envFile });

export const env = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  SESSION_SECRET: process.env.SESSION_SECRET!,
  DATABASE_URL: process.env.DATABASE_URL!,
};

if (
  !env.SUPABASE_URL ||
  !env.SUPABASE_SERVICE_ROLE_KEY ||
  !env.SESSION_SECRET ||
  !env.DATABASE_URL
) {
  throw new Error("Missing required environment variables");
}


