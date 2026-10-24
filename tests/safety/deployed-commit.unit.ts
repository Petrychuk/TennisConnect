// npm run test:e2e:guard
//
// Deployed-commit verification (tests/safety/deployed-commit.ts) and the
// /api/health payload (server/lib/health.ts). No network: /api/health is
// stubbed, time is simulated.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildHealthPayload } from '../../server/lib/health';
import { EnvironmentGuardError, type FetchLike } from './environment-guard';
import { assertDeployedCommit, normaliseExpectedSha, waitForDeployedCommit } from './deployed-commit';

const STAGING_ENV = { TEST_ENV: 'staging', BASE_URL: 'https://tennisconnect-staging.up.railway.app' };
const SHA = 'a'.repeat(40);
const OLD_SHA = 'b'.repeat(40);

type Reply = { status?: number; body?: unknown; contentType?: string; throws?: boolean };

function stub(...replies: Reply[]): FetchLike & { calls: number } {
  let index = 0;
  const fn = (async () => {
    fn.calls++;
    const reply = replies[Math.min(index++, replies.length - 1)];
    if (reply.throws) throw new Error('ECONNRESET');
    const status = reply.status ?? 200;
    return {
      status,
      ok: status === 200,
      headers: { get: (name: string) => (name === 'content-type' ? reply.contentType ?? 'application/json' : null) },
      text: async () => JSON.stringify(reply.body ?? {}),
    };
  }) as unknown as FetchLike & { calls: number };
  fn.calls = 0;
  return fn;
}

function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
}

const rejectsGuard = (promise: Promise<unknown>, pattern: RegExp) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof EnvironmentGuardError, String(error));
    assert.match(error.message, pattern);
    return true;
  });

describe('server/lib/health.ts', () => {
  it('reports a full commit SHA on staging', () => {
    assert.deepEqual(buildHealthPayload({ dbEnv: 'staging', railwayGitCommitSha: SHA.toUpperCase() }), {
      dbEnv: 'staging',
      commit: SHA,
    });
  });

  it('never reports the commit on production', () => {
    assert.deepEqual(buildHealthPayload({ dbEnv: 'production', railwayGitCommitSha: SHA }), { dbEnv: 'production' });
  });

  it('omits missing or malformed values instead of guessing', () => {
    for (const value of [undefined, '', 'abc123', `${SHA}x`, 'z'.repeat(40)]) {
      assert.deepEqual(buildHealthPayload({ dbEnv: 'staging', railwayGitCommitSha: value }), { dbEnv: 'staging' });
    }
  });
});

describe('deployed-commit verification', () => {
  it('accepts only full 40-character SHAs', () => {
    assert.equal(normaliseExpectedSha(SHA.toUpperCase()), SHA);
    for (const bad of [undefined, '', 'aaaaaaa', `${SHA}a`, 'not-a-sha']) {
      assert.throws(() => normaliseExpectedSha(bad), /full 40-character/);
    }
  });

  it('passes when staging reports the expected commit', async () => {
    const fetchImpl = stub({ body: { dbEnv: 'staging', commit: SHA } });
    const result = await waitForDeployedCommit(STAGING_ENV, SHA, { fetchImpl, ...fakeClock() });
    assert.deepEqual(result, { origin: STAGING_ENV.BASE_URL, commit: SHA });
  });

  it('a healthy endpoint is not enough: missing commit fails closed (after waiting)', async () => {
    const fetchImpl = stub({ body: { dbEnv: 'staging' } });
    await rejectsGuard(
      waitForDeployedCommit(STAGING_ENV, SHA, { fetchImpl, timeoutMs: 60_000, intervalMs: 15_000, ...fakeClock() }),
      /does not report a deployed commit/
    );
    assert.ok(fetchImpl.calls >= 2);
  });

  it('waits while the old commit is still serving, then passes', async () => {
    const fetchImpl = stub(
      { body: { dbEnv: 'staging', commit: OLD_SHA } },
      { throws: true },
      { body: { dbEnv: 'staging', commit: SHA } }
    );
    const result = await waitForDeployedCommit(STAGING_ENV, SHA, { fetchImpl, intervalMs: 1000, ...fakeClock() });
    assert.equal(result.commit, SHA);
    assert.equal(fetchImpl.calls, 3);
  });

  it('fails after the wait budget if the commit never matches', async () => {
    const fetchImpl = stub({ body: { dbEnv: 'staging', commit: OLD_SHA } });
    await rejectsGuard(
      waitForDeployedCommit(STAGING_ENV, SHA, { fetchImpl, timeoutMs: 30_000, intervalMs: 10_000, ...fakeClock() }),
      new RegExp(`did not report commit ${SHA}.*runs commit ${OLD_SHA}`, 's')
    );
  });

  it('a non-staging server fails immediately (no waiting)', async () => {
    for (const dbEnv of ['production', 'development', 'unknown']) {
      const fetchImpl = stub({ body: { dbEnv, commit: SHA } });
      await rejectsGuard(
        waitForDeployedCommit(STAGING_ENV, SHA, { fetchImpl, ...fakeClock() }),
        new RegExp(`dbEnv="${dbEnv}"`)
      );
      assert.equal(fetchImpl.calls, 1);
    }
  });

  it('non-200, non-JSON and unreachable health all fail closed', async () => {
    for (const reply of [{ status: 503 }, { contentType: 'text/html' }, { throws: true }, { status: 302 }] as Reply[]) {
      await rejectsGuard(
        waitForDeployedCommit(STAGING_ENV, SHA, { fetchImpl: stub(reply), timeoutMs: 0, ...fakeClock() }),
        /did not report commit/
      );
    }
  });

  it('refuses anything but a guard-valid staging target - never Production', async () => {
    const fetchImpl = stub({ body: { dbEnv: 'staging', commit: SHA } });
    await rejectsGuard(
      waitForDeployedCommit({ TEST_ENV: 'staging', BASE_URL: 'https://tennisconnect.com.au' }, SHA, { fetchImpl }),
      /PRODUCTION host/
    );
    await rejectsGuard(
      waitForDeployedCommit({ TEST_ENV: 'production', BASE_URL: 'https://tennisconnect.com.au' }, SHA, { fetchImpl }),
      /TEST_ENV=staging only/
    );
    await rejectsGuard(waitForDeployedCommit({ TEST_ENV: 'staging' }, SHA, { fetchImpl }), /requires BASE_URL/);
    assert.equal(fetchImpl.calls, 0);
  });

  it('assertDeployedCommit compares exactly', () => {
    assertDeployedCommit({ dbEnv: 'staging', commit: SHA }, SHA, 'x');
    assert.throws(() => assertDeployedCommit({ dbEnv: 'staging', commit: OLD_SHA }, SHA, 'x'), /runs commit/);
  });
});
