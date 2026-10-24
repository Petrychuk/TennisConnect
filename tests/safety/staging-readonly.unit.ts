// npm run test:e2e:guard
//
// The staging-readonly selection (tests/safety/staging-readonly.ts) selects
// exactly the reviewed read-only tests - checked against the real
// playwright.config.ts with `playwright test --list` (no browser, no
// network) - and each selected test still looks read-only and
// credential-free in its source.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  STAGING_READONLY_EXCLUDED_IDS,
  STAGING_READONLY_IDS,
  STAGING_READONLY_TESTS,
  overlapWithStagingSmoke,
  stagingReadonlyArgs,
  stagingReadonlyGrep,
} from './staging-readonly';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const TEST_ID = /\b[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}\b/;

/** Splits a spec into test bodies keyed by test id (top-level and in describe blocks). */
function testBodies(source: string): Map<string, string> {
  const bodies = new Map<string, string>();
  // The title runs to the end of the `test(` line; titles may contain quotes.
  const starts = Array.from(source.matchAll(/^\s*test\(\s*['"`](.*)$/gm));
  starts.forEach((match, i) => {
    const id = match[1].match(TEST_ID)?.[0];
    if (!id) return;
    const start = match.index ?? 0;
    const end = i + 1 < starts.length ? starts[i + 1].index ?? source.length : source.length;
    bodies.set(id, source.slice(start, end));
  });
  return bodies;
}

describe('staging read-only selection', () => {
  it('has 32 unique ids, none shared with staging-smoke, none excluded', () => {
    assert.equal(STAGING_READONLY_IDS.length, 32);
    assert.equal(new Set(STAGING_READONLY_IDS).size, STAGING_READONLY_IDS.length);
    assert.deepEqual(overlapWithStagingSmoke(), []);
    for (const id of STAGING_READONLY_EXCLUDED_IDS) {
      assert.ok(!STAGING_READONLY_IDS.includes(id), `${id} must never be in the read-only suite`);
    }
  });

  it('fixes one worker, no retries and an HTML report', () => {
    const args = stagingReadonlyArgs();
    assert.ok(args.includes('--workers=1'));
    assert.ok(args.includes('--retries=0'));
    assert.ok(args.some(arg => arg.startsWith('--reporter=') && arg.includes('html')));
  });

  it('grep matches whole ids only', () => {
    const grep = new RegExp(stagingReadonlyGrep());
    assert.ok(grep.test('Desktop Chrome back-the-rally.spec.ts SUPPORT-001 Back The Rally Widget'));
    assert.ok(grep.test('@prod-safe PROD-SAFE-002 Homepage loads'));
    assert.ok(grep.test('@smoke MSG-SMOKE-002 Guest contact form'));
    assert.ok(!grep.test('SUPPORT-007 Continue To Payment'));
    assert.ok(!grep.test('PUBLIC-0011 Something'));
    assert.ok(!grep.test('MSG-0121 Something'));
  });

  it('lists exactly the reviewed ids against Staging', () => {
    const result = spawnSync(process.execPath, [CLI, ...stagingReadonlyArgs(['--list'])], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        TEST_ENV: 'staging',
        BASE_URL: 'https://tennisconnect-staging.up.railway.app',
        ALLOW_PROD: '',
        CI: '',
      },
    });
    const lines = `${result.stdout}\n${result.stderr}`
      .split(/\r?\n/)
      .filter(line => line.includes(' › ') && /\.spec\.ts:\d+/.test(line));
    const ids = lines.map(line => line.match(TEST_ID)?.[0]).sort();

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(ids, [...STAGING_READONLY_IDS].sort());
  });

  it('every selected test is still read-only and credential-free in source', () => {
    const forbidden: RegExp[] = [
      /\blogin\(/,
      /\blogout\(/,
      /\bregister\w*\(/,
      /becomeOrganiser|seedPlayers|seedSession|completeVerification|test-hooks/,
      /TEST_USERS\.\w+\.(email|password)/,
      /request\.(post|put|patch|delete|fetch)\(/,
      /setInputFiles/,
      /continue-to-payment'\)\.click|create-checkout-session/,
      /(save|submit|send|delete|publish|approve|reject)[\w-]*['"]\)\.click/i,
    ];

    for (const entry of STAGING_READONLY_TESTS) {
      assert.ok(existsSync(path.join(ROOT, entry.file)), `${entry.file} is missing`);
      const bodies = testBodies(readFileSync(path.join(ROOT, entry.file), 'utf8'));

      for (const id of entry.ids) {
        const body = bodies.get(id);
        assert.ok(body, `${id} not found in ${entry.file}`);
        for (const pattern of forbidden) {
          assert.doesNotMatch(body, pattern, `${id} must stay read-only / credential-free (${pattern})`);
        }
      }
    }
  });
});
