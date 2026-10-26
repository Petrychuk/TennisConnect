/*
  LOCAL STAGING E2E CONFIGURATION (.env.e2e.staging.local)

  Developers configure the Staging preflight once, in an untracked file at
  the repository root, instead of re-typing variables (and the secret) in
  every new PowerShell / terminal session:

    .env.e2e.staging.local     <- your values, gitignored, never committed
    .env.e2e.staging.example   <- committed template, placeholders only

  Loaded by `npm run e2e:staging:check` and the Staging phase runner only.
  Rules:
  - ONLY this file is read - never `.env` (which may hold another
    environment's configuration, e.g. Production's).
  - Values already set in the shell win (CI passes its secrets that way).
    A shell value that DIFFERS from the file is reported - a stale
    $env:E2E_TEST_HOOK_SECRET from an old session is a classic cause of 401.
  - Only the keys the Staging E2E tooling uses are accepted. Server-side
    configuration (database URLs, Stripe/Supabase keys, session secrets...)
    is refused outright: the preflight never needs it, and having it in a
    test file is how Production credentials end up somewhere they shouldn't.
  - Values are never printed. Reports name keys only.
*/

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { PRODUCTION_HOSTS } from './environment-guard';

export const STAGING_LOCAL_ENV_FILE = '.env.e2e.staging.local';
export const STAGING_EXAMPLE_ENV_FILE = '.env.e2e.staging.example';

/** Permanent Staging test-account passwords (server/seeds/e2e) - never printed. */
export const STAGING_TEST_ACCOUNT_PASSWORD_KEYS: readonly string[] = [
  'E2E_PLAYER_PASSWORD',
  'E2E_PLAYER_2_PASSWORD',
  'E2E_COACH_PASSWORD',
  'E2E_ORGANISER_PASSWORD',
  'E2E_ADMIN_PASSWORD',
];

/** Keys the Staging E2E tooling reads. Anything else in the file is refused. */
export const STAGING_LOCAL_ALLOWED_KEYS: readonly string[] = [
  'TEST_ENV',
  'BASE_URL',
  'E2E_TEST_HOOK_SECRET',
  'EXPECTED_DEPLOY_SHA',
  'E2E_REQUIRE_PAYMENTS',
  'E2E_REQUIRE_UPLOADS',
  'STAGING_SUPABASE_HOST',
  'PRODUCTION_SUPABASE_HOST',
  'E2E_STAGING_CHECK_TIMEOUT_MS',
  // Passwords of the permanent Staging test accounts (@tennisconnect.test),
  // needed by the read-only auth phase. Staging test credentials only.
  ...STAGING_TEST_ACCOUNT_PASSWORD_KEYS,
];

/**
 * Keys that must never come from the file, even though the tools read them:
 * confirmations and opt-ins for data-changing runs are given per run, on
 * the command line, never left switched on in a file.
 */
export const STAGING_LOCAL_PER_RUN_KEYS: readonly string[] = [
  'E2E_CONFIRM_WRITES',
  'E2E_RUN_ID',
  'E2E_ENABLE_STRIPE_TESTS',
  'E2E_CLEANUP_ON_TEARDOWN',
  'E2E_PHASE',
];

/** Server-side / database configuration - refused in the file with a specific message. */
const SERVER_SIDE_KEY = /(^|_)(DATABASE|DB|PG|POSTGRES|SUPABASE|STRIPE|SESSION|JWT|RESEND|SMTP|SENDGRID|RAILWAY)(_|$)|_(SERVICE_ROLE|PRIVATE)_?KEY$/i;

export interface StagingLocalEnvResult {
  /** Absolute path of the file looked for. */
  file: string;
  found: boolean;
  /** Keys copied from the file into the environment. */
  loaded: string[];
  /** Keys present in the file but already set in the shell, with the same value. */
  shellSame: string[];
  /** Keys present in the file but already set in the shell with a DIFFERENT value (the shell wins). */
  shellOverrides: string[];
  /** Refusals - when non-empty, nothing was loaded. */
  problems: string[];
}

export interface LoadOptions {
  rootDir: string;
  /** Injected for tests. */
  readFile?: (file: string) => string | undefined;
}

function defaultReadFile(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

const PRODUCTION_HOST_IN_VALUE = new RegExp(
  `(^|[/@.:\\s])(${PRODUCTION_HOSTS.map(host => host.replace(/\./g, '\\.')).join('|')})([/:?#\\s]|$)`,
  'i'
);

/**
 * Loads .env.e2e.staging.local into `env` (without overriding existing
 * values). Refuses the whole file - loading nothing - if it contains keys
 * or values that don't belong there.
 */
export function loadStagingLocalEnv(env: Record<string, string | undefined>, options: LoadOptions): StagingLocalEnvResult {
  const file = path.join(options.rootDir, STAGING_LOCAL_ENV_FILE);
  const result: StagingLocalEnvResult = { file, found: false, loaded: [], shellSame: [], shellOverrides: [], problems: [] };
  const text = (options.readFile ?? defaultReadFile)(file);
  if (text === undefined) return result;
  result.found = true;

  // Windows PowerShell 5.1 (`Out-File`, `>`) writes UTF-16 by default; read as UTF-8 that parses to nothing.
  if (text.includes('\u0000') || text.startsWith('��')) {
    result.problems.push(
      `${STAGING_LOCAL_ENV_FILE} is saved as UTF-16 - save it as UTF-8 (create it with Copy-Item from the example and edit it in VS Code or Notepad; don't use Out-File or ">")`
    );
    return result;
  }

  const values = parse(text);
  for (const [key, value] of Object.entries(values)) {
    if (STAGING_LOCAL_PER_RUN_KEYS.includes(key)) {
      result.problems.push(`${key} must not be stored in ${STAGING_LOCAL_ENV_FILE} - give it on the command line for the one run that needs it`);
    } else if (SERVER_SIDE_KEY.test(key) && !STAGING_LOCAL_ALLOWED_KEYS.includes(key)) {
      result.problems.push(`${key} is server-side configuration and must not be in ${STAGING_LOCAL_ENV_FILE} (the preflight never needs database, Stripe, Supabase or session credentials)`);
    } else if (!STAGING_LOCAL_ALLOWED_KEYS.includes(key)) {
      result.problems.push(`${key} is not a Staging E2E setting (allowed: ${STAGING_LOCAL_ALLOWED_KEYS.join(', ')})`);
    }
    if (key === 'TEST_ENV' && value.trim().toLowerCase() !== 'staging') {
      result.problems.push(`TEST_ENV in ${STAGING_LOCAL_ENV_FILE} must be "staging" (got "${value.trim()}")`);
    }
    if (/\b[sr]k_live_/.test(value)) {
      result.problems.push(`${key} holds a LIVE Stripe key - remove it`);
    } else if (/^postgres(ql)?:\/\//i.test(value.trim())) {
      result.problems.push(`${key} holds a database connection string - remove it`);
    } else if (key !== 'PRODUCTION_SUPABASE_HOST' && PRODUCTION_HOST_IN_VALUE.test(value)) {
      result.problems.push(`${key} points at a PRODUCTION host - this file is for Staging only`);
    }
  }
  if (result.problems.length > 0) return result;

  for (const [key, value] of Object.entries(values)) {
    const current = env[key];
    if (current === undefined || current === '') {
      env[key] = value;
      result.loaded.push(key);
    } else if (current === value) {
      result.shellSame.push(key);
    } else {
      result.shellOverrides.push(key);
    }
  }
  return result;
}
