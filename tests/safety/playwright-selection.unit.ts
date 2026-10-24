// npm run test:e2e:guard
//
// Runs the REAL playwright.config.ts with `playwright test --list` (no
// browser, no network, globalSetup does not run for --list) and checks
// which tests each TEST_ENV would select. Proves the Production allowlist
// holds even when --grep or file paths are passed on the CLI.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { PROD_SAFE_ALLOWLIST } from './environment-guard';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLAYWRIGHT_CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

const PROD = 'https://tennisconnect.com.au';
const STAGING = 'https://staging.example-tennisconnect.app';

const ALLOWLISTED_IDS = PROD_SAFE_ALLOWLIST.flatMap(entry => entry.testIds).sort();

interface ListResult {
  status: number | null;
  output: string;
  tests: string[];
}

function list(env: Record<string, string>, args: string[] = []): ListResult {
  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', '--list', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      // Explicit empty values so neither the parent shell nor a local .env
      // (loaded by dotenv in playwright.config.ts) can leak a target in.
      TEST_ENV: '',
      BASE_URL: '',
      ALLOW_PROD: '',
      CI: '',
      ...env,
    },
  });

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const tests = output
    .split(/\r?\n/)
    .filter(line => line.includes(' › ') && /\.spec\.ts:\d+:\d+/.test(line))
    .map(line => line.trim());

  return { status: result.status, output, tests };
}

const ids = (tests: string[]) =>
  tests.map(line => line.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}\b/)?.[0] ?? line).sort();

describe('test selection per TEST_ENV (playwright --list)', () => {

  const local = list({ TEST_ENV: 'local' });

  it('local: existing tests remain discoverable', () => {
    assert.equal(local.status, 0, local.output);
    assert.ok(local.tests.length > 50, `expected the full suite, got ${local.tests.length}`);

    for (const file of [
      'smoke/smoke.spec.ts',
      'auth/reg-player.spec.ts',
      'security/security-regression.spec.ts',
      'admin/users/admin-user-delete.spec.ts',
      'prod-safe/prod-safe.spec.ts',
    ]) {
      assert.ok(local.tests.some(line => line.replace(/\\/g, '/').includes(file)), `${file} not listed`);
    }
  });

  it('no TEST_ENV and no BASE_URL behaves as local', () => {
    const implicit = list({});
    assert.equal(implicit.status, 0, implicit.output);
    assert.equal(implicit.tests.length, local.tests.length);
  });

  it('staging: the full suite is selected', () => {
    const staging = list({ TEST_ENV: 'staging', BASE_URL: STAGING });
    assert.equal(staging.status, 0, staging.output);
    assert.equal(staging.tests.length, local.tests.length);
  });

  it('production: only the allowlisted @prod-safe tests are selected', () => {
    const prod = list({ TEST_ENV: 'production', BASE_URL: PROD });
    assert.equal(prod.status, 0, prod.output);
    assert.deepEqual(ids(prod.tests), ALLOWLISTED_IDS);
    for (const line of prod.tests) {
      assert.match(line, /prod-safe[\\/]prod-safe\.spec\.ts/);
      assert.doesNotMatch(line, /@smoke/);
    }
  });

  it('production: --grep @smoke selects nothing', () => {
    const prod = list({ TEST_ENV: 'production', BASE_URL: PROD }, ['--grep', '@smoke']);
    assert.equal(prod.tests.length, 0, prod.output);
  });

  it('production: --grep .* (full suite attempt) selects nothing outside the allowlist', () => {
    const prod = list({ TEST_ENV: 'production', BASE_URL: PROD }, ['--grep', '.*']);
    for (const line of prod.tests) {
      assert.match(line, /prod-safe[\\/]prod-safe\.spec\.ts/, line);
    }
  });

  it('production: naming a destructive spec file on the CLI selects nothing', () => {
    const prod = list({ TEST_ENV: 'production', BASE_URL: PROD }, [
      'tests/auth/reg-player.spec.ts',
      'tests/smoke/smoke.spec.ts',
    ]);
    assert.equal(prod.tests.length, 0, prod.output);
  });

  it('config refuses to load with ALLOW_PROD=1', () => {
    const result = list({ ALLOW_PROD: '1', BASE_URL: PROD });
    assert.notEqual(result.status, 0);
    assert.match(result.output, /ALLOW_PROD has been removed/);
    assert.equal(result.tests.length, 0);
  });

  it('config refuses to load with a TEST_ENV / BASE_URL mismatch', () => {
    const stagingOnProd = list({ TEST_ENV: 'staging', BASE_URL: PROD });
    assert.notEqual(stagingOnProd.status, 0);
    assert.match(stagingOnProd.output, /PRODUCTION host/);

    const prodOnStaging = list({ TEST_ENV: 'production', BASE_URL: STAGING });
    assert.notEqual(prodOnStaging.status, 0);
    assert.match(prodOnStaging.output, /not a known production host/);

    const missingEnv = list({ BASE_URL: PROD });
    assert.notEqual(missingEnv.status, 0);
    assert.match(missingEnv.output, /TEST_ENV is not/);
  });

});
