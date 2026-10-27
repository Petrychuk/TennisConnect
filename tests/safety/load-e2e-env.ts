/*
  ENVIRONMENT LOADING FOR PLAYWRIGHT AND THE STAGING E2E COMMANDS

  Before: playwright.config.ts did `import 'dotenv/config'`, i.e. it read
  `.env` - for every TEST_ENV - and never `.env.e2e.staging.local`. So
  `npm run test:e2e:staging` ran without E2E_TEST_HOOK_SECRET and the test
  account passwords (only `npm run e2e:staging:check` and the phase runner
  read the local file) and produced dozens of misleading failures. Worse,
  `.env` holds this machine's application configuration (possibly
  Production's), which has no business leaking into a Staging run.

  Now, by TEST_ENV:
    staging     .env.e2e.staging.local ONLY (staging-local-env.ts rules:
                shell wins, allowed keys only, refused file => the run is
                refused). `.env` is never read for a Staging run.
    local       `.env`, as before.
    production  `.env`, as before (prod-safe suite only - environment-guard).
  No value is ever printed; the summary names keys only.
*/

import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { EnvironmentGuardError } from './environment-guard';
import { STAGING_LOCAL_ENV_FILE, loadStagingLocalEnv, type StagingLocalEnvResult } from './staging-local-env';

export interface E2EEnvLoad {
  /** Which file was used ("none" when nothing was found). */
  source: string;
  staging?: StagingLocalEnvResult;
}

export interface LoadE2EEnvOptions {
  rootDir: string;
  /** Injected for tests. */
  readFile?: (file: string) => string | undefined;
  /** Injected for tests (default: dotenv's config() on `.env`, never overriding). */
  loadDotEnv?: (file: string, env: Record<string, string | undefined>) => void;
}

function defaultLoadDotEnv(file: string, env: Record<string, string | undefined>) {
  if (!existsSync(file)) return;
  dotenvConfig({ path: file, processEnv: env as Record<string, string>, override: false, quiet: true });
}

export function loadE2EEnv(env: Record<string, string | undefined>, options: LoadE2EEnvOptions): E2EEnvLoad {
  const testEnv = (env.TEST_ENV ?? '').trim().toLowerCase();

  if (testEnv === 'staging') {
    const staging = loadStagingLocalEnv(env, { rootDir: options.rootDir, readFile: options.readFile });
    if (staging.problems.length > 0) {
      throw new EnvironmentGuardError(
        `${STAGING_LOCAL_ENV_FILE} was refused - nothing was loaded from it:\n  - ${staging.problems.join('\n  - ')}`
      );
    }
    return { source: staging.found ? STAGING_LOCAL_ENV_FILE : 'none (shell variables only)', staging };
  }

  // Read .env into a scratch object first: a .env that itself says
  // TEST_ENV=staging must not turn this into a Staging run fed from .env.
  const dotEnvFile = path.join(options.rootDir, '.env');
  const fromDotEnv: Record<string, string | undefined> = {};
  (options.loadDotEnv ?? defaultLoadDotEnv)(dotEnvFile, fromDotEnv);
  if (!testEnv && (fromDotEnv.TEST_ENV ?? '').trim().toLowerCase() === 'staging') {
    throw new EnvironmentGuardError(
      `TEST_ENV=staging comes from .env, which is never used for Staging runs. ` +
      `Use the Staging commands (npm run test:e2e:staging ...), which set TEST_ENV, and put Staging values in ${STAGING_LOCAL_ENV_FILE}.`
    );
  }
  for (const [key, value] of Object.entries(fromDotEnv)) {
    if (env[key] === undefined && value !== undefined) env[key] = value;
  }
  return { source: '.env' };
}

/** One line for the run log: where the configuration came from (key names only). */
export function describeE2EEnvLoad(load: E2EEnvLoad): string {
  if (!load.staging) return `[e2e-env] configuration: ${load.source}`;
  const s = load.staging;
  const parts = [`[e2e-env] configuration: ${load.source}`];
  if (s.loaded.length) parts.push(`loaded ${s.loaded.join(', ')}`);
  if (s.shellOverrides.length) {
    parts.push(`WARNING shell overrides the file for ${s.shellOverrides.join(', ')} (stale? PowerShell: Remove-Item Env:NAME)`);
  }
  return parts.join('; ');
}
