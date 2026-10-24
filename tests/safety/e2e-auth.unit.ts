// npx tsx --test tests/safety/e2e-auth.unit.ts
//
// Stage 2 auth helpers (tests/helpers/e2e-auth.ts) and run ownership
// (tests/fixtures/run-id.ts). Fake request context - no server, no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { E2EAuthError, assertE2EAuthAllowed, e2eCredentials, loginViaApi, storageStatePath } from '../helpers/e2e-auth';
import { RUN_ID_ENV, RunOwnershipError, currentRunId, ensureRunId, requireRunOwnedEmail, runOwnedEmail } from '../fixtures/run-id';
import { TEST_RUN_ID_HEADER, testHookHeaders } from '../helpers/test-hooks';
import { generateTestUser } from '../fixtures/test-users';
import { classifyEmail, isOwnedByRun } from '../../server/seeds/e2e/identities';

// Synthetic login value for the fake request below - never a real account's.
// Derived at runtime from a fixed label, so it is deterministic and unique
// (the "never leaked in errors" checks stay meaningful) without a
// credential-shaped literal in the source for secret scanners to flag.
const SYNTHETIC_ORGANISER_LOGIN = `synthetic-${createHash('sha256').update('e2e-auth.unit organiser fixture').digest('hex').slice(0, 24)}`;
const ENV = { TEST_ENV: 'staging', E2E_ORGANISER_PASSWORD: SYNTHETIC_ORGANISER_LOGIN };

function fakeResponse(status: number, body: unknown) {
  return { status: () => status, ok: () => status >= 200 && status < 300, json: async () => body };
}

function fakeRequest(login: { status: number; body?: unknown }, me: { status: number; body?: unknown }) {
  const calls: { method: string; url: string; data?: unknown }[] = [];
  return {
    calls,
    post: async (url: string, options?: { data?: unknown }) => {
      calls.push({ method: 'POST', url, data: options?.data });
      return fakeResponse(login.status, login.body ?? {});
    },
    get: async (url: string) => {
      calls.push({ method: 'GET', url });
      return fakeResponse(me.status, me.body ?? {});
    },
  } as any;
}

test('auth helpers are refused on production', () => {
  assert.throws(() => assertE2EAuthAllowed({ TEST_ENV: 'production' }), E2EAuthError);
  assert.throws(() => assertE2EAuthAllowed({ TEST_ENV: 'prod' }), E2EAuthError);
  assert.doesNotThrow(() => assertE2EAuthAllowed({ TEST_ENV: 'staging' }));
  assert.doesNotThrow(() => assertE2EAuthAllowed({}));
});

test('credentials come from env; a missing one names the variable only', () => {
  assert.deepEqual(e2eCredentials('organiser', ENV), {
    email: 'e2e-organiser@tennisconnect.test',
    password: ENV.E2E_ORGANISER_PASSWORD,
    slug: 'e2e-organiser',
  });
  assert.throws(() => e2eCredentials('admin', ENV), /E2E_ADMIN_PASSWORD is not set/);
});

test('state files are per role and per worker, under the gitignored dir', () => {
  const paths = new Set([
    storageStatePath('player', 0), storageStatePath('player', 1), storageStatePath('coach', 0),
    storageStatePath('player', 0, 0), storageStatePath('player', 0, 1),
  ]);
  assert.equal(paths.size, 5);
  for (const p of Array.from(paths)) assert.match(p.replace(/\\/g, '/'), /^playwright\/\.auth\/e2e-[a-z-]+-w\d+(-fresh\d+)?\.json$/);
  assert.throws(() => storageStatePath('player', -1));
});

test('loginViaApi posts credentials and verifies the session identity', async () => {
  const request = fakeRequest(
    { status: 200 },
    { status: 200, body: { authenticated: true, email: 'e2e-organiser@tennisconnect.test', id: 'u1' } }
  );
  assert.deepEqual(await loginViaApi(request, 'organiser', ENV), { email: 'e2e-organiser@tennisconnect.test', userId: 'u1' });
  assert.deepEqual(request.calls.map((call: { method: string; url: string }) => `${call.method} ${call.url}`), [
    'POST /api/auth/login', 'GET /api/auth/me',
  ]);
  // Remembered session: no 1-hour idle logout while a worker reuses it.
  assert.deepEqual(request.calls[0].data, { email: 'e2e-organiser@tennisconnect.test', password: ENV.E2E_ORGANISER_PASSWORD, rememberMe: true });
});

test('loginViaApi fails clearly without leaking the password', async () => {
  for (const [login, me] of [
    [{ status: 401 }, { status: 200 }],
    [{ status: 403, body: { code: 'EMAIL_NOT_VERIFIED' } }, { status: 200 }],
    [{ status: 200 }, { status: 200, body: { authenticated: false } }],
    [{ status: 200 }, { status: 200, body: { authenticated: true, email: 'someone-else@tennisconnect.test' } }],
  ] as const) {
    await assert.rejects(loginViaApi(fakeRequest(login, me), 'organiser', ENV), (error: Error) => {
      assert.ok(error instanceof E2EAuthError);
      assert.ok(!error.message.includes(ENV.E2E_ORGANISER_PASSWORD));
      return true;
    });
  }
  await assert.rejects(loginViaApi(fakeRequest({ status: 200 }, { status: 200 }), 'organiser', { ...ENV, TEST_ENV: 'production' }), E2EAuthError);
});

test('run id: generated once, reused, malformed values refused', () => {
  const env: Record<string, string | undefined> = {};
  const runId = ensureRunId(env);
  assert.equal(env[RUN_ID_ENV], runId);
  assert.equal(ensureRunId(env), runId, 'workers inherit the same token');
  assert.equal(currentRunId(env), runId);
  assert.throws(() => ensureRunId({ [RUN_ID_ENV]: 'abc' }), /malformed/);
  assert.equal(currentRunId({ [RUN_ID_ENV]: 'abc' }), undefined);
});

test('run-owned emails belong to exactly this run', () => {
  const env: Record<string, string | undefined> = {};
  const runId = ensureRunId(env);
  const email = runOwnedEmail('player-x', env)!;
  assert.equal(classifyEmail(email).kind, 'run');
  assert.ok(isOwnedByRun(email, runId));
  assert.equal(runOwnedEmail('player-x', {}), undefined);
});

test('run ownership is enforced on Staging: no token, no test-created record', () => {
  assert.throws(() => requireRunOwnedEmail('player-x', { TEST_ENV: 'staging' }), RunOwnershipError);
  assert.throws(() => requireRunOwnedEmail('player-x', { TEST_ENV: 'staging', [RUN_ID_ENV]: 'forged' }), RunOwnershipError);
  assert.equal(requireRunOwnedEmail('player-x', { TEST_ENV: 'local' }), undefined, 'local keeps the legacy format');
  const env: Record<string, string | undefined> = { TEST_ENV: 'staging' };
  const runId = ensureRunId(env);
  assert.ok(isOwnedByRun(requireRunOwnedEmail('player-x', env), runId));
});

test('generateTestUser produces run-owned users when a run is active', () => {
  const saved = process.env[RUN_ID_ENV];
  try {
    const runId = ensureRunId(Object.assign({}, { [RUN_ID_ENV]: undefined }));
    process.env[RUN_ID_ENV] = runId;
    const user = generateTestUser('coach');
    assert.ok(isOwnedByRun(user.email, runId), user.email);
    assert.ok(user.email.length <= 200);
  } finally {
    if (saved === undefined) delete process.env[RUN_ID_ENV];
    else process.env[RUN_ID_ENV] = saved;
  }
});

test('test-hook requests carry the run token when a run is active', () => {
  const env: Record<string, string | undefined> = { E2E_TEST_HOOK_SECRET: 'x'.repeat(40) };
  assert.equal(testHookHeaders(env)[TEST_RUN_ID_HEADER], undefined);
  const runId = ensureRunId(env);
  assert.equal(testHookHeaders(env)[TEST_RUN_ID_HEADER], runId);
  assert.equal(testHookHeaders({ ...env, [RUN_ID_ENV]: 'forged' })[TEST_RUN_ID_HEADER], undefined, 'a malformed token is never sent');
});
