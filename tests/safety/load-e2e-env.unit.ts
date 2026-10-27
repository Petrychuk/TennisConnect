// npm run test:e2e:guard
//
// Regression for: `npm run test:e2e:staging` never read .env.e2e.staging.local
// (playwright.config.ts loaded `.env` via dotenv/config), so Staging runs had
// no test-hook secret or account passwords and failed test after test.
// Covers tests/safety/load-e2e-env.ts, tests/safety/staging-run-config.ts
// and their wiring into playwright.config.ts / tests/global-setup.ts.
// No network: global setup is called with a fetch that fails the test if used.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeE2EEnvLoad, loadE2EEnv } from './load-e2e-env';
import { STAGING_LOCAL_ENV_FILE, STAGING_TEST_ACCOUNT_PASSWORD_KEYS } from './staging-local-env';
import { FULL_REGRESSION_CONFIRMATION, stagingRunProblems, stagingScope } from './staging-run-config';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Generated per run - never real credentials.
const SECRET = `unit-${Math.random().toString(36).slice(2)}-${'k'.repeat(40)}`;
const PASSWORD = `pw-${Math.random().toString(36).slice(2)}`;
const SHA = 'c'.repeat(40);
const STAGING = 'https://tennisconnect-staging.up.railway.app';

const passwords = Object.fromEntries(STAGING_TEST_ACCOUNT_PASSWORD_KEYS.map(key => [key, PASSWORD]));
const localFile = [
  `BASE_URL=${STAGING}`,
  `E2E_TEST_HOOK_SECRET=${SECRET}`,
  `EXPECTED_DEPLOY_SHA=${SHA}`,
  ...STAGING_TEST_ACCOUNT_PASSWORD_KEYS.map(key => `${key}=${PASSWORD}`),
].join('\n');

function spies(files: Record<string, string>) {
  const read: string[] = [];
  const dotEnvLoads: string[] = [];
  return {
    read,
    dotEnvLoads,
    readFile: (file: string) => (read.push(path.basename(file)), files[path.basename(file)]),
    loadDotEnv: (file: string, env: Record<string, string | undefined>) => {
      dotEnvLoads.push(path.basename(file));
      for (const line of (files[path.basename(file)] ?? '').split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key) env[key] = rest.join('=');
      }
    },
  };
}

describe('loadE2EEnv - which file a run reads', () => {
  it('TEST_ENV=staging loads .env.e2e.staging.local and never .env', () => {
    const io = spies({ [STAGING_LOCAL_ENV_FILE]: localFile, '.env': 'E2E_TEST_HOOK_SECRET=from-dot-env\nDATABASE_URL=postgres://x' });
    const env: Record<string, string | undefined> = { TEST_ENV: 'staging' };
    const load = loadE2EEnv(env, { rootDir: ROOT, ...io });
    assert.deepEqual(io.read, [STAGING_LOCAL_ENV_FILE]);
    assert.deepEqual(io.dotEnvLoads, [], '.env is not read for Staging');
    assert.equal(env.E2E_TEST_HOOK_SECRET, SECRET);
    assert.equal(env.E2E_ADMIN_PASSWORD, PASSWORD);
    assert.equal(env.DATABASE_URL, undefined);
    assert.equal(load.source, STAGING_LOCAL_ENV_FILE);
  });

  it('shell values win over the file, and the summary names keys only', () => {
    const io = spies({ [STAGING_LOCAL_ENV_FILE]: localFile });
    const env: Record<string, string | undefined> = { TEST_ENV: 'staging', E2E_TEST_HOOK_SECRET: `${SECRET}-shell` };
    const load = loadE2EEnv(env, { rootDir: ROOT, ...io });
    assert.equal(env.E2E_TEST_HOOK_SECRET, `${SECRET}-shell`);
    const line = describeE2EEnvLoad(load);
    assert.match(line, /shell overrides the file for E2E_TEST_HOOK_SECRET/);
    assert.ok(!line.includes(SECRET) && !line.includes(PASSWORD), 'no values in the log line');
  });

  it('a refused local file refuses the run (nothing half-loaded)', () => {
    const io = spies({ [STAGING_LOCAL_ENV_FILE]: `${localFile}\nE2E_CONFIRM_WRITES=full-regression` });
    const env: Record<string, string | undefined> = { TEST_ENV: 'staging' };
    assert.throws(() => loadE2EEnv(env, { rootDir: ROOT, ...io }), /was refused[\s\S]*E2E_CONFIRM_WRITES must not be stored/);
    assert.equal(env.E2E_TEST_HOOK_SECRET, undefined);
  });

  it('local runs keep reading .env (without overriding the shell) and never the Staging file', () => {
    const io = spies({ '.env': 'TEST_EMAIL=from-dot-env\nBASE_URL=http://localhost:9999', [STAGING_LOCAL_ENV_FILE]: localFile });
    const env: Record<string, string | undefined> = { TEST_ENV: 'local', BASE_URL: 'http://localhost:3000' };
    loadE2EEnv(env, { rootDir: ROOT, ...io });
    assert.deepEqual(io.read, []);
    assert.equal(env.TEST_EMAIL, 'from-dot-env');
    assert.equal(env.BASE_URL, 'http://localhost:3000');
    assert.equal(env.E2E_TEST_HOOK_SECRET, undefined);
  });

  it('a .env that says TEST_ENV=staging cannot start a Staging run fed from .env', () => {
    const io = spies({ '.env': `TEST_ENV=staging\nE2E_TEST_HOOK_SECRET=from-dot-env` });
    const env: Record<string, string | undefined> = {};
    assert.throws(() => loadE2EEnv(env, { rootDir: ROOT, ...io }), /never used for Staging runs/);
    assert.equal(env.E2E_TEST_HOOK_SECRET, undefined);
  });
});

describe('stagingRunProblems - what a Staging run needs before it starts', () => {
  const complete = { TEST_ENV: 'staging', E2E_TEST_HOOK_SECRET: SECRET, EXPECTED_DEPLOY_SHA: SHA, ...passwords };

  it('the reviewed read-only and smoke selections need nothing extra (CI unchanged)', () => {
    assert.deepEqual(stagingRunProblems({ TEST_ENV: 'staging', E2E_STAGING_SCOPE: 'readonly' }), []);
    assert.deepEqual(stagingRunProblems({ TEST_ENV: 'staging', E2E_STAGING_SCOPE: 'smoke' }), []);
  });

  it('a phase needs the secret, every password and the expected commit', () => {
    const problems = stagingRunProblems({ TEST_ENV: 'staging', E2E_STAGING_SCOPE: 'phase:auth-readonly' });
    const text = problems.join('\n');
    assert.match(text, /E2E_TEST_HOOK_SECRET is not set/);
    for (const key of STAGING_TEST_ACCOUNT_PASSWORD_KEYS) assert.match(text, new RegExp(key));
    assert.match(text, /EXPECTED_DEPLOY_SHA is not set/);
    assert.deepEqual(stagingRunProblems({ ...complete, E2E_STAGING_SCOPE: 'phase:auth-readonly' }), []);
  });

  it('an unphased run (npm run test:e2e:staging) also needs this run\'s write confirmation', () => {
    assert.match(stagingRunProblems(complete).join('\n'), /unphased Staging run/);
    assert.match(stagingRunProblems({ ...complete, E2E_CONFIRM_WRITES: 'yes' }).join('\n'), /unphased Staging run/);
    assert.deepEqual(stagingRunProblems({ ...complete, E2E_CONFIRM_WRITES: FULL_REGRESSION_CONFIRMATION }), []);
  });

  it('a wrong-looking secret is reported by format, never by value', () => {
    const problems = stagingRunProblems({ ...complete, E2E_TEST_HOOK_SECRET: `"${SECRET}"`, E2E_CONFIRM_WRITES: FULL_REGRESSION_CONFIRMATION });
    assert.match(problems.join('\n'), /quote/);
    assert.ok(!problems.join('\n').includes(SECRET));
  });

  it('unknown scopes are refused', () => {
    assert.throws(() => stagingScope({ E2E_STAGING_SCOPE: 'everything' }), /not a known scope/);
  });
});

describe('wiring', () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    globalThis.fetch = realFetch;
  });

  it('global setup refuses a Staging run with missing configuration before any request', async () => {
    const { default: globalSetup } = await import('../global-setup');
    let requests = 0;
    globalThis.fetch = (async () => {
      requests++;
      throw new Error('no request expected');
    }) as typeof fetch;
    for (const key of ['E2E_TEST_HOOK_SECRET', 'EXPECTED_DEPLOY_SHA', 'E2E_STAGING_SCOPE', 'E2E_CONFIRM_WRITES', ...STAGING_TEST_ACCOUNT_PASSWORD_KEYS]) {
      delete process.env[key];
    }
    Object.assign(process.env, { TEST_ENV: 'staging', BASE_URL: STAGING, ALLOW_PROD: '' });

    await assert.rejects(globalSetup({ projects: [] } as never), (error: unknown) => {
      const message = String((error as Error).message);
      assert.match(message, /missing configuration - no test was started/);
      assert.match(message, /E2E_TEST_HOOK_SECRET is not set/);
      assert.match(message, /E2E_ADMIN_PASSWORD/);
      return true;
    });
    assert.equal(requests, 0);
  });

  it('playwright.config.ts loads configuration through loadE2EEnv, not dotenv/config', () => {
    const source = readFileSync(path.join(ROOT, 'playwright.config.ts'), 'utf8');
    assert.doesNotMatch(source, /['"]dotenv\/config['"]/);
    const load = source.indexOf('loadE2EEnv(process.env');
    assert.ok(load > 0, 'loadE2EEnv is called');
    assert.ok(load < source.indexOf('resolveTarget(process.env)'), 'before the target is resolved');
  });

  it('each Staging runner declares its scope; the cleanup CLI loads the same configuration', () => {
    const read = (file: string) => readFileSync(path.join(ROOT, 'tests/safety', file), 'utf8');
    assert.match(read('run-staging-readonly.ts'), /E2E_STAGING_SCOPE: 'readonly'/);
    assert.match(read('run-staging-smoke.ts'), /E2E_STAGING_SCOPE: 'smoke'/);
    assert.match(read('run-staging-phase.ts'), /E2E_STAGING_SCOPE: `phase:\$\{requirements\.phase\}`/);
    assert.match(read('cleanup-run-cli.ts'), /loadE2EEnv\(process\.env/);
  });
});
