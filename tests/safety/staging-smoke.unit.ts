// npm run test:e2e:guard
//
// The CI staging-smoke selection (tests/safety/staging-smoke.ts) selects
// exactly the reviewed read-only tests - checked against the real
// playwright.config.ts with `playwright test --list` (no browser, no network).

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { STAGING_SMOKE_FILE, STAGING_SMOKE_TEST_IDS, stagingSmokeArgs, stagingSmokeGrep } from './staging-smoke';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

function testBodies(source: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const starts = Array.from(source.matchAll(/^test\(\s*'([^']+)'/gm));
  starts.forEach((match, i) => {
    const start = match.index ?? 0;
    const end = i + 1 < starts.length ? starts[i + 1].index ?? source.length : source.length;
    bodies.set(match[1], source.slice(start, end));
  });
  return bodies;
}

describe('staging smoke selection', () => {
  it('lists exactly the reviewed ids against Staging', () => {
    const result = spawnSync(process.execPath, [CLI, ...stagingSmokeArgs(['--list'])], {
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
    const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(l => l.includes(' › ') && /\.spec\.ts:\d+/.test(l));
    const ids = lines.map(l => l.match(/@smoke (\S+)/)?.[1]).sort();

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(ids, [...STAGING_SMOKE_TEST_IDS].sort());
    for (const line of lines) assert.match(line, /smoke[\\/]smoke\.spec\.ts/);
  });

  it('grep matches whole ids only', () => {
    const grep = new RegExp(stagingSmokeGrep());
    assert.ok(grep.test('@smoke HOME-001 Homepage loads'));
    assert.ok(!grep.test('@smoke HOME-0011 Something'));
    assert.ok(!grep.test('@smoke REG-001 Player can register'));
    assert.ok(!grep.test('HOME-001 without the tag'));
  });

  it('every selected test is read-only and needs no credentials', () => {
    const source = readFileSync(path.join(ROOT, STAGING_SMOKE_FILE), 'utf8');
    const bodies = testBodies(source);

    for (const id of STAGING_SMOKE_TEST_IDS) {
      const entry = Array.from(bodies.entries()).find(([title]) => title.startsWith(`@smoke ${id} `));
      assert.ok(entry, `${id} not found as an @smoke test in ${STAGING_SMOKE_FILE}`);
      const body = entry[1];

      for (const forbidden of [/\blogin\(/, /\bregister\w*\(/, /TEST_USERS/, /\.fill\(/, /\.check\(/, /request\.(post|put|patch|delete)\(/, /setInputFiles/, /test-hooks/]) {
        assert.doesNotMatch(body, forbidden, `${id} must stay read-only / credential-free (${forbidden})`);
      }
    }
  });
});
