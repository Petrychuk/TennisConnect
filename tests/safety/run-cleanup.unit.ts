// npx tsx --test tests/safety/run-cleanup.unit.ts   (part of npm run test:cleanup)
//
// Client side of the Stage 3 run cleanup: the hook client
// (tests/helpers/run-cleanup.ts), the operator CLI arguments
// (tests/safety/cleanup-run-cli.ts) and global teardown
// (tests/global-teardown.ts). fetch is stubbed - nothing leaves the process.

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRunCleanup, planRunCleanup, summarisePlan, type CleanupPlanResponse } from '../helpers/run-cleanup';
import { parseCleanupArgs } from './cleanup-run-cli';
import globalTeardown from '../global-teardown';
import { generateRunId } from '../../server/seeds/e2e/identities';

const RUN = generateRunId(1_790_000_000_000, Buffer.from('a1b2c3d4e5f60718', 'hex'));
const SECRET = `unit-${'s'.repeat(40)}`;
const STAGING = {
  TEST_ENV: 'staging',
  BASE_URL: 'https://tennisconnect-staging.up.railway.app',
  E2E_TEST_HOOK_SECRET: SECRET,
};

interface Call {
  url: string;
  headers: Record<string, string>;
  body: any;
}

function plan(overrides: Partial<CleanupPlanResponse> = {}): CleanupPlanResponse {
  return {
    mode: 'dry-run',
    runId: RUN,
    users: [{ id: 'u1', email: `e2e-run-${RUN}-player@tennisconnect.test` }],
    organizationIds: [],
    counts: { messages: 2 },
    refusals: [],
    storageFiles: 0,
    storageCleanup: 'disabled',
    ...overrides,
  };
}

async function withFetch(responses: unknown[], fn: (calls: Call[]) => Promise<void>) {
  const saved = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const next = responses.shift();
    if (next === undefined) throw new Error('unexpected request');
    return new Response(JSON.stringify(next), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = saved;
  }
}

async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved = { ...process.env };
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    await fn();
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
}

// ---------- Hook client ----------

test('client: dry run sends the run id header and no apply flag', () =>
  withFetch([plan()], async (calls) => {
    await planRunCleanup(RUN, STAGING);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /^https:\/\/tennisconnect-staging\.up\.railway\.app\/api\/test-hooks\/cleanup-run$/);
    assert.equal(calls[0].headers['X-E2E-Run-Id'], RUN);
    assert.deepEqual(calls[0].body, {});
  })
);

test('client: apply repeats the run id as confirmRunId', () =>
  withFetch([{ mode: 'apply', usersDeleted: 1, storage: { removed: 0, skipped: true }, organizations: null }], async (calls) => {
    await applyRunCleanup(RUN, STAGING);
    assert.deepEqual(calls[0].body, { apply: true, confirmRunId: RUN });
    assert.equal(calls[0].headers['X-E2E-Run-Id'], RUN);
  })
);

test('client: refuses Production, unknown targets and malformed run ids before any request', () =>
  withFetch([], async (calls) => {
    assert.throws(() => planRunCleanup(RUN, { ...STAGING, TEST_ENV: 'production' }), /local\/staging only/);
    assert.throws(() => applyRunCleanup(RUN, { ...STAGING, TEST_ENV: 'prod' }), /local\/staging only/);
    assert.throws(() => planRunCleanup('forged', STAGING), /invalid run id/);
    assert.throws(() => applyRunCleanup(`${RUN},${RUN}`, STAGING), /invalid run id/);
    assert.equal(calls.length, 0);
  })
);

test('summary names refusals and the file-cleanup state, never secrets', () => {
  const text = summarisePlan(plan({ refusals: ['1 message(s) exchanged with users outside the run'], storageFiles: 3 }));
  assert.match(text, /REFUSED: 1 message/);
  assert.match(text, /files=3 \(file cleanup disabled\)/);
  assert.ok(!text.includes(SECRET));
});

// ---------- CLI arguments ----------

test('cli: dry run by default; one explicit run per call; --verify needs --apply', () => {
  assert.deepEqual(parseCleanupArgs([`--run-id=${RUN}`], {}), { runId: RUN, apply: false, verify: false, residue: false });
  assert.equal(parseCleanupArgs([], { E2E_RUN_ID: RUN }).runId, RUN);
  assert.equal(parseCleanupArgs([`--run-id=${RUN}`, '--apply', '--verify'], {}).apply, true);
  assert.throws(() => parseCleanupArgs([`--run-id=${RUN}`, '--verify'], {}), /--verify only makes sense with --apply/);
  assert.throws(() => parseCleanupArgs([], {}), /--run-id/);
  assert.throws(() => parseCleanupArgs(['--all'], {}), /unknown argument/);
  assert.throws(() => parseCleanupArgs(['--run-id=*'], {}).runId && planRunCleanup('*', STAGING), /invalid run id/);
  assert.equal(parseCleanupArgs(['--residue'], {}).residue, true);
});

// ---------- Global teardown ----------

test('teardown: does nothing on Production, without a secret or without a run id', async () => {
  for (const env of [
    { ...STAGING, TEST_ENV: 'production', E2E_RUN_ID: RUN },
    { ...STAGING, E2E_TEST_HOOK_SECRET: undefined, E2E_RUN_ID: RUN },
    { ...STAGING, E2E_RUN_ID: undefined },
  ]) {
    await withEnv(env, () => withFetch([], async (calls) => {
      await globalTeardown();
      assert.equal(calls.length, 0, JSON.stringify(env.TEST_ENV));
    }));
  }
});

test('teardown: dry run by default - reports, never applies', () =>
  withEnv({ ...STAGING, E2E_RUN_ID: RUN, E2E_CLEANUP_ON_TEARDOWN: undefined }, () =>
    withFetch([plan()], async (calls) => {
      await globalTeardown();
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].body, {});
    })
  )
);

test('teardown with E2E_CLEANUP_ON_TEARDOWN=1: applies after a clean plan', () =>
  withEnv({ ...STAGING, E2E_RUN_ID: RUN, E2E_CLEANUP_ON_TEARDOWN: '1' }, () =>
    withFetch([plan(), { mode: 'apply', usersDeleted: 1, storage: { removed: 0, skipped: true }, organizations: null }], async (calls) => {
      await globalTeardown();
      assert.equal(calls.length, 2);
      assert.deepEqual(calls[1].body, { apply: true, confirmRunId: RUN });
    })
  )
);

test('teardown with E2E_CLEANUP_ON_TEARDOWN=1: a refused plan fails the run and applies nothing', () =>
  withEnv({ ...STAGING, E2E_RUN_ID: RUN, E2E_CLEANUP_ON_TEARDOWN: '1' }, () =>
    withFetch([plan({ refusals: ['2 registration(s) in this run\'s sessions by users outside the run'] })], async (calls) => {
      await assert.rejects(globalTeardown(), /cleanup refused/);
      assert.equal(calls.length, 1, 'no apply request');
    })
  )
);
