import dotenv from "dotenv";

const envFile =
  process.env.NODE_ENV === "development" ? ".env.dev" : ".env";

dotenv.config({ path: envFile });

export const env = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  SESSION_SECRET: process.env.SESSION_SECRET!,
  DATABASE_URL: process.env.DATABASE_URL!,
  // Not in the required-vars check below: email sending is best-effort
  // (forgot-password degrades to "logged to console" in development
  // without these), it shouldn't take the whole server down if unset.
  // server/services/emailService.ts logs loudly on every send if these
  // are missing, so a misconfiguration is still visible in prod logs.
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  // Explicit, per-environment marker - set DB_ENV=production in the real
  // prod .env and DB_ENV=staging in .env.dev/staging's env. Deliberately
  // NOT derived from NODE_ENV: "npm start" sets NODE_ENV=production for
  // every deployed instance (staging included), so NODE_ENV alone can't
  // tell staging and prod apart. tests/global-setup.ts asks the running
  // server "which one are you" via GET /api/health instead of trusting
  // BASE_URL's hostname alone - this is what that answer comes from.
  DB_ENV: process.env.DB_ENV || "unknown",
};

if (
  !env.SUPABASE_URL ||
  !env.SUPABASE_SERVICE_ROLE_KEY ||
  !env.SESSION_SECRET ||
  !env.DATABASE_URL
) {
  throw new Error("Missing required environment variables");
}


