// npm run test:e2e:guard
//
// Stage 3 phase allowlists (tests/safety/staging-phases.ts): every test
// Playwright discovers is classified exactly once, and each phase's real
// selection (`playwright test --list` with the phase's files + grep, the
// real playwright.config.ts, no browser, no network) is exactly what the
// phase declares - nothing from another phase or from the read-only sets
// leaks in. Also the run requirements of the phase runner.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_ONLY_TESTS,
  STAGING_PHASE_ORDER,
  STAGING_PHASES,
  phaseGrep,
  phaseRunRequirements,
  stagingPhaseArgs,
  testIdOf,
  type PhaseEntry,
} from './staging-phases';
import { STAGING_READONLY_TESTS } from './staging-readonly';
import { STAGING_SMOKE_FILE, STAGING_SMOKE_TEST_IDS } from './staging-smoke';
import { generateRunId } from '../../server/seeds/e2e/identities';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const STAGING_ENV = { TEST_ENV: 'staging', BASE_URL: 'https://tennisconnect-staging.up.railway.app', ALLOW_PROD: '', CI: '' };

interface Listed {
  file: string;
  title: string;
}

/** Tests Playwright discovers for these args, as tests/<file> + title. */
function listTests(args: string[]): Listed[] {
  const result = spawnSync(process.execPath, [CLI, ...args, '--list', '--reporter=json'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...STAGING_ENV },
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const out: Listed[] = [];
  const walk = (suite: any) => {
    for (const spec of suite.specs ?? []) out.push({ file: `tests/${spec.file}`, title: spec.title });
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return out;
}

const key = (file: string, id: string) => `${file}#${id}`;
const keysOf = (entries: readonly PhaseEntry[]) => entries.flatMap(entry => entry.ids.map(id => key(entry.file, id)));

const READONLY_KEYS = [
  ...keysOf(STAGING_READONLY_TESTS),
  ...STAGING_SMOKE_TEST_IDS.map(id => key(STAGING_SMOKE_FILE, id)),
];

describe('staging phases', () => {
  const all = listTests(['test']);

  it('every discovered test is classified exactly once', () => {
    assert.ok(all.length >= 180, `expected the full suite, got ${all.length}`);
    const owners = new Map<string, string[]>();
    const add = (k: string, owner: string) => owners.set(k, [...(owners.get(k) ?? []), owner]);
    for (const k of READONLY_KEYS) add(k, 'read-only');
    for (const phase of STAGING_PHASE_ORDER) for (const k of keysOf(STAGING_PHASES[phase])) add(k, phase);
    for (const k of keysOf(LOCAL_ONLY_TESTS)) add(k, 'local-only');

    const duplicates = Array.from(owners).filter(([, list]) => list.length > 1);
    assert.deepEqual(duplicates, [], 'classified more than once');

    const unclassified = all.filter(test => {
      const id = testIdOf(test.title);
      return !id || !owners.has(key(test.file, id));
    });
    assert.deepEqual(unclassified, [], 'every test needs a phase, the read-only set or LOCAL_ONLY_TESTS');

    const discovered = new Set(all.map(test => key(test.file, testIdOf(test.title) ?? '')));
    const stale = Array.from(owners.keys()).filter(k => !discovered.has(k));
    assert.deepEqual(stale, [], 'listed ids that no longer exist');
  });

  for (const phase of STAGING_PHASE_ORDER) {
    it(`${phase}: the real selection is exactly the declared tests`, () => {
      const selected = listTests(stagingPhaseArgs(phase).filter(arg => arg !== '--reporter=list,html'));
      const expected = new Set(keysOf(STAGING_PHASES[phase]));
      const selectedKeys = selected.map(test => key(test.file, testIdOf(test.title) ?? test.title));
      assert.deepEqual(selectedKeys.filter(k => !expected.has(k)), [], `${phase} selects tests it does not declare`);
      assert.deepEqual(Array.from(expected).filter(k => !selectedKeys.includes(k)), [], `${phase} misses declared tests`);
    });
  }

  it('the stripe phase is only Stripe; security payloads run last; ADMIN-009 is local only', () => {
    assert.deepEqual(keysOf(STAGING_PHASES.stripe), [
      key('tests/support/back-the-rally.spec.ts', 'SUPPORT-007'),
      key('tests/support/back-the-rally.spec.ts', 'SUPPORT-008'),
    ]);
    assert.equal(STAGING_PHASE_ORDER.indexOf('security-last'), STAGING_PHASE_ORDER.length - 2);
    assert.ok(keysOf(LOCAL_ONLY_TESTS).includes(key('tests/admin/users/admin-user-delete.spec.ts', 'ADMIN-009')));
    for (const phase of STAGING_PHASE_ORDER) {
      assert.ok(!keysOf(STAGING_PHASES[phase]).some(k => k.endsWith('#ADMIN-009')), `ADMIN-009 must not be in ${phase}`);
    }
  });

  it('phase runs: one worker, no retries, traces off', () => {
    for (const phase of STAGING_PHASE_ORDER) {
      const args = stagingPhaseArgs(phase);
      assert.ok(args.includes('--workers=1') && args.includes('--retries=0') && args.includes('--trace=off'), phase);
    }
  });

  it('grep matches whole ids, including "SEC-NAME: payload" titles', () => {
    const grep = new RegExp(phaseGrep(['SEC-NAME', 'PLAY-001']));
    assert.ok(grep.test("SEC-NAME: ' OR 1=1 --"));
    assert.ok(grep.test('@smoke PLAY-001 Published session'));
    assert.ok(!grep.test('PLAY-0011 Something'));
    assert.ok(!grep.test('SEC-NAMES: x'));
  });
});

describe('phase runner requirements', () => {
  const runId = generateRunId();
  const env = { TEST_ENV: 'staging', E2E_RUN_ID: runId };

  it('needs Staging, a reviewed phase and a pre-generated run id', () => {
    assert.throws(() => phaseRunRequirements({ ...env, TEST_ENV: 'production' }, ['--phase=mutating-core']), /TEST_ENV=staging/);
    assert.throws(() => phaseRunRequirements({ ...env, TEST_ENV: undefined }, ['--phase=mutating-core']), /TEST_ENV=staging/);
    assert.throws(() => phaseRunRequirements(env, ['--phase=everything']), /unknown phase/);
    assert.throws(() => phaseRunRequirements(env, []), /unknown phase/);
    assert.throws(() => phaseRunRequirements({ ...env, E2E_RUN_ID: undefined }, ['--phase=mutating-core']), /E2E_RUN_ID/);
    assert.throws(() => phaseRunRequirements({ ...env, E2E_RUN_ID: 'forged' }, ['--phase=mutating-core']), /E2E_RUN_ID/);
  });

  it('writing phases clean up in teardown; the read-only phase does not need to', () => {
    assert.deepEqual(phaseRunRequirements(env, ['--phase=mutating-core']).env, { E2E_CLEANUP_ON_TEARDOWN: '1' });
    assert.deepEqual(phaseRunRequirements({ ...env, E2E_PHASE: 'hub-msg-admin' }, []).env, { E2E_CLEANUP_ON_TEARDOWN: '1' });
    assert.deepEqual(phaseRunRequirements(env, ['--phase=auth-readonly']).env, {});
  });

  it('the stripe phase needs E2E_ENABLE_STRIPE_TESTS=1', () => {
    assert.throws(() => phaseRunRequirements(env, ['--phase=stripe']), /E2E_ENABLE_STRIPE_TESTS=1/);
    assert.equal(phaseRunRequirements({ ...env, E2E_ENABLE_STRIPE_TESTS: '1' }, ['--phase=stripe']).phase, 'stripe');
  });
});
