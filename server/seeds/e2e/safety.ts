// Seed-target gate for the E2E fixture seed (server/seeds/e2e/run.ts).
//
// FAILS CLOSED. Any missing, ambiguous or inconsistent database setting
// refuses the run. Seeding is allowed only when ALL of these hold:
//
//   1. DB_ENV is exactly "staging" (missing, "", "unknown", "production",
//      different case or padding - all refused);
//   2. NODE_ENV is exactly "development", so server/db.ts's dotenv call can
//      only read .env.dev - never .env, the Production config in this repo;
//   3. not in CI (CI / GITHUB_ACTIONS) - seeding is an explicit operator action;
//   4. no libpq/pg override variable is set (PGHOST, PGDATABASE, PGUSER, ...):
//      they could silently redirect a connection away from DATABASE_URL;
//   5. DATABASE_URL is a single postgres URL with an explicit user, a plain
//      DNS/IPv4 host and a database name, and NO connection-routing query
//      parameters (pg honours ?host= / ?dbname= / ?options= over the URL);
//   6. E2E_APPROVED_STAGING_DB is set, well-formed ("<user>@<host>/<database>")
//      and equals DATABASE_URL's identity. The user is part of the identity
//      because Supabase projects can share one pooler host and all use the
//      database "postgres" - the project ref in the user name is what tells
//      Staging and Production apart;
//   7. PROD_DATABASE_URL, when present, must parse, and must not share
//      DATABASE_URL's identity or its user name (the same project ref);
//   8. writes (--apply) need --confirm=<the same identity>, typed by the operator.
//
// After connecting, run.ts re-runs this gate (server/db.ts's dotenv may have
// added variables) and checks current_database() / current_user.
//
// Never returns or prints credentials - only user@host/database. Pure
// module, unit-tested in server/seeds/e2e/e2eSeed.test.ts.

export class SeedSafetyError extends Error {
  constructor(message: string) {
    super(`[e2e-seed] Refusing to seed: ${message}`);
    this.name = "SeedSafetyError";
  }
}

export interface DbTarget {
  user: string;
  host: string;
  database: string;
  /** "<user>@<host>/<database>" - safe to print (no password, no port). */
  label: string;
}

/** Variables pg/libpq read that could change where a connection goes. */
export const PG_OVERRIDE_ENVS = [
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGSERVICE",
  "PGSERVICEFILE",
  "PGOPTIONS",
] as const;

/** Query parameters that cannot change which server/database is reached. */
const SAFE_QUERY_PARAMS = new Set(["sslmode", "application_name", "connect_timeout", "pgbouncer"]);

const HOST = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;
const USER = /^[a-z0-9_.-]{1,128}$/;
const DATABASE = /^[a-z0-9_-]{1,63}$/;
const APPROVED = /^([a-z0-9_.-]{1,128})@([a-z0-9.-]{1,253})\/([a-z0-9_-]{1,63})$/;

/**
 * Parses a connection string into its identity, or explains why it is
 * ambiguous. Never includes the password in the result or the reason.
 */
export function describeDatabaseUrl(url: string | undefined): { target: DbTarget } | { problem: string } {
  if (!url || !url.trim()) return { problem: "is missing" };
  if (url !== url.trim()) return { problem: "has leading/trailing whitespace" };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { problem: "is not a valid URL" };
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") return { problem: "is not a postgres:// URL" };

  const host = parsed.hostname.toLowerCase();
  if (!HOST.test(host)) return { problem: "must name exactly one plain DNS or IPv4 host (no socket paths, lists or encodings)" };

  let user: string;
  let database: string;
  try {
    user = decodeURIComponent(parsed.username).toLowerCase();
    database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).toLowerCase();
  } catch {
    return { problem: "has invalid percent-encoding" };
  }
  if (!USER.test(user)) return { problem: "must include an explicit user name" };
  if (!DATABASE.test(database)) return { problem: "must include exactly one database name" };

  const keys = Array.from(parsed.searchParams.keys());
  const unsafe = keys.filter(key => !SAFE_QUERY_PARAMS.has(key.toLowerCase()));
  if (unsafe.length) return { problem: `has connection-routing query parameters (${unsafe.join(", ")})` };
  if (new Set(keys.map(key => key.toLowerCase())).size !== keys.length) return { problem: "repeats a query parameter" };

  return { target: { user, host, database, label: `${user}@${host}/${database}` } };
}

/** Convenience: the target, or null when the URL is unusable. */
export function parseDatabaseTarget(url: string | undefined): DbTarget | null {
  const result = describeDatabaseUrl(url);
  return "target" in result ? result.target : null;
}

function normaliseLabel(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export interface SeedArgs {
  apply: boolean;
  confirm: string | undefined;
  anchor: string | undefined;
  /** Re-set existing baseline accounts' passwords from the environment. */
  rotatePasswords: boolean;
}

export function parseSeedArgs(argv: readonly string[]): SeedArgs {
  const args: SeedArgs = { apply: false, confirm: undefined, anchor: undefined, rotatePasswords: false };
  const seen = new Set<string>();
  for (const arg of argv) {
    const name = arg.split("=")[0];
    if (seen.has(name)) throw new SeedSafetyError(`argument ${name} given more than once`);
    seen.add(name);
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.apply = false;
    else if (arg === "--rotate-passwords") args.rotatePasswords = true;
    else if (arg.startsWith("--confirm=")) args.confirm = arg.slice("--confirm=".length);
    else if (arg.startsWith("--anchor=")) args.anchor = arg.slice("--anchor=".length);
    else {
      throw new SeedSafetyError(
        `unknown argument "${arg}" (allowed: --dry-run, --apply, --confirm=<user>@<host>/<db>, --anchor=YYYY-MM-DD, --rotate-passwords)`
      );
    }
  }
  if (seen.has("--apply") && seen.has("--dry-run")) throw new SeedSafetyError("--apply and --dry-run are mutually exclusive");
  if (args.rotatePasswords && !args.apply) throw new SeedSafetyError("--rotate-passwords only makes sense with --apply");
  return args;
}

export interface SeedGateResult {
  target: DbTarget;
  mode: "dry-run" | "apply";
}

const quote = (value: string | undefined) => (value === undefined ? "nothing" : `"${value}"`);

export function assertSeedTarget(env: Record<string, string | undefined>, args: SeedArgs): SeedGateResult {
  if (env.DB_ENV !== "staging") {
    throw new SeedSafetyError(`DB_ENV must be exactly "staging" (got ${quote(env.DB_ENV)}).`);
  }

  // server/db.ts calls dotenv on import: NODE_ENV=development makes that read
  // .env.dev, never .env (the Production config in this repo). dotenv never
  // overrides variables already set, and run.ts re-checks after the import.
  if (env.NODE_ENV !== "development") {
    throw new SeedSafetyError(
      `NODE_ENV must be "development" (got ${quote(env.NODE_ENV)}) so no Production .env file can be loaded. Use the npm script.`
    );
  }

  if ((env.CI ?? "") !== "" || (env.GITHUB_ACTIONS ?? "") !== "") {
    throw new SeedSafetyError("seeding never runs in CI - it is an explicit operator action.");
  }

  const overrides = PG_OVERRIDE_ENVS.filter(name => (env[name] ?? "") !== "");
  if (overrides.length) {
    throw new SeedSafetyError(`unset ${overrides.join(", ")} - they could redirect the connection away from DATABASE_URL.`);
  }

  const described = describeDatabaseUrl(env.DATABASE_URL);
  if ("problem" in described) throw new SeedSafetyError(`DATABASE_URL ${described.problem}.`);
  const { target } = described;

  const approvedRaw = env.E2E_APPROVED_STAGING_DB;
  const approved = normaliseLabel(approvedRaw);
  if (!approved) {
    throw new SeedSafetyError('E2E_APPROVED_STAGING_DB is not set (expected "<user>@<host>/<database>" of the Staging database).');
  }
  if (!APPROVED.test(approved)) {
    throw new SeedSafetyError('E2E_APPROVED_STAGING_DB must look like "<user>@<host>/<database>".');
  }
  if (target.label !== approved) {
    throw new SeedSafetyError(`DATABASE_URL points at ${target.label}, not the approved Staging database ${approved}.`);
  }

  if (env.PROD_DATABASE_URL !== undefined && env.PROD_DATABASE_URL !== "") {
    const prod = describeDatabaseUrl(env.PROD_DATABASE_URL);
    if ("problem" in prod) {
      throw new SeedSafetyError(`PROD_DATABASE_URL is set but ${prod.problem} - cannot prove DATABASE_URL is not Production.`);
    }
    if (prod.target.label === target.label || prod.target.user === target.user) {
      throw new SeedSafetyError("DATABASE_URL has the same identity (or user / project ref) as PROD_DATABASE_URL.");
    }
  }

  if (args.apply) {
    if (normaliseLabel(args.confirm) !== target.label) {
      throw new SeedSafetyError(`--apply needs --confirm=${target.label} (typed exactly) to write to this database.`);
    }
    return { target, mode: "apply" };
  }
  return { target, mode: "dry-run" };
}

/**
 * After connecting: the server must report the expected database and user.
 * Supabase's pooler reports the bare role ("postgres") for a tenant user
 * ("postgres.<project-ref>"), so that exact form is accepted as well.
 */
export function assertConnectedDatabase(
  target: DbTarget,
  connected: { database: string | undefined; user: string | undefined }
) {
  const database = (connected.database ?? "").toLowerCase();
  const user = (connected.user ?? "").toLowerCase();
  if (database !== target.database) {
    throw new SeedSafetyError(`connected database is "${connected.database ?? "unknown"}", expected "${target.database}".`);
  }
  const tenantRole = target.user.includes(".") ? target.user.slice(0, target.user.indexOf(".")) : target.user;
  if (user !== target.user && user !== tenantRole) {
    throw new SeedSafetyError(`connected as "${connected.user ?? "unknown"}", expected "${target.user}".`);
  }
}

/** Upcoming fixtures sit at least this far after the anchor. */
export const ANCHOR_MAX_AGE_DAYS = 7;

/**
 * The anchor is today (UTC) by default. An explicit anchor must be within
 * the last ANCHOR_MAX_AGE_DAYS days and not in the future, so a seed can
 * never write "upcoming" data that is already close to expiring.
 */
export function parseAnchor(value: string | undefined, now: Date = new Date()): Date {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (value === undefined) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new SeedSafetyError(`--anchor must be YYYY-MM-DD (got "${value}").`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new SeedSafetyError(`--anchor "${value}" is not a valid date.`);
  }
  const ageDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (ageDays < 0 || ageDays > ANCHOR_MAX_AGE_DAYS) {
    throw new SeedSafetyError(`--anchor must be between ${ANCHOR_MAX_AGE_DAYS} days ago and today (got ${value}).`);
  }
  return date;
}

/** Baseline passwords: at least 16 characters, never echoed. Only the names asked for are read. */
export function readBaselinePasswords(
  env: Record<string, string | undefined>,
  passwordEnvs: readonly string[]
): Map<string, string> {
  const missing: string[] = [];
  const weak: string[] = [];
  const result = new Map<string, string>();
  for (const name of passwordEnvs) {
    const value = env[name];
    if (!value) missing.push(name);
    else if (value.length < 16) weak.push(name);
    else result.set(name, value);
  }
  if (missing.length || weak.length) {
    throw new SeedSafetyError(
      [
        missing.length ? `missing ${missing.join(", ")}` : "",
        weak.length ? `shorter than 16 characters: ${weak.join(", ")}` : "",
      ].filter(Boolean).join("; ") + " (names only - values are never printed)."
    );
  }
  return result;
}
