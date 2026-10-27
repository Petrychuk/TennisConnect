// npm run test:e2e:guard
//
// tests/safety/staging-check.ts (npm run e2e:staging:check),
// tests/safety/staging-local-env.ts (.env.e2e.staging.local) and the
// write confirmation of the phase runner. Every network call goes to a
// stubbed fetch - nothing here reaches Staging, Production or the internet.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  APPROVED_STAGING_ORIGIN,
  StagingCheckFailure,
  checkConfiguration,
  redact,
  runStagingCheck,
  secretFingerprint,
  secretProblems,
  type CheckFetch,
} from './staging-check';
import {
  STAGING_EXAMPLE_ENV_FILE,
  STAGING_LOCAL_ALLOWED_KEYS,
  STAGING_LOCAL_ENV_FILE,
  loadStagingLocalEnv,
  type StagingLocalEnvResult,
} from './staging-local-env';
import { assertWriteConfirmation } from './staging-phases';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Generated per run - never a real credential.
const SECRET = `unit-${Math.random().toString(36).slice(2)}-${'s'.repeat(40)}`;
const SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);

const noFile: StagingLocalEnvResult = {
  file: path.join(ROOT, STAGING_LOCAL_ENV_FILE), found: false, loaded: [], shellSame: [], shellOverrides: [], problems: [],
};

const goodEnv = (extra: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
  TEST_ENV: 'staging',
  BASE_URL: APPROVED_STAGING_ORIGIN,
  E2E_TEST_HOOK_SECRET: SECRET,
  EXPECTED_DEPLOY_SHA: SHA,
  ...extra,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const goodReport = { dbEnv: 'staging', commit: SHA, emailTransport: 'capture', stripeMode: 'test', stripeWebhookConfigured: true };

interface Call { url: string; method: string; secretHeader?: string }

/** Stub server: /api/health and POST /api/test-hooks/preflight. */
function stubFetch(handlers: { health?: () => Promise<Response> | Response; preflight?: (secret?: string) => Promise<Response> | Response } = {}) {
  const calls: Call[] = [];
  const impl: CheckFetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    const secretHeader = init?.headers?.['X-E2E-Test-Secret'];
    calls.push({ url: input, method, secretHeader });
    if (input.endsWith('/api/health')) return (handlers.health ?? (() => json({ status: 'ok', dbEnv: 'staging', commit: SHA })))() as never;
    if (input.endsWith('/api/test-hooks/preflight') && method === 'POST') {
      return (handlers.preflight ?? (secret => (secret === SECRET ? json(goodReport) : json({ error: 'Unauthorized' }, 401))))(secretHeader) as never;
    }
    return json({ error: 'not found' }, 404) as never;
  };
  return { impl, calls };
}

/** A request that only ends when aborted (like a server that never answers). */
const hangUntilAborted: CheckFetch = (_input, init) =>
  new Promise((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })));
  });

async function check(env: Record<string, string | undefined>, fetchImpl: CheckFetch, extra: Partial<Parameters<typeof runStagingCheck>[0]> = {}) {
  return runStagingCheck({ env, rootDir: ROOT, localEnv: noFile, fetchImpl, requestTimeoutMs: 1000, ...extra });
}

const allOutput = (lines: string[]) => lines.join('\n');

describe('local configuration file (.env.e2e.staging.local)', () => {
  const read = (text: string) => {
    const seen: string[] = [];
    return { seen, readFile: (file: string) => (seen.push(file), text) };
  };

  it('loads the allowed keys without overriding shell values, and reports differing shell values', () => {
    const { seen, readFile } = read(`TEST_ENV=staging\nBASE_URL=${APPROVED_STAGING_ORIGIN}\nE2E_TEST_HOOK_SECRET="${SECRET}"\nEXPECTED_DEPLOY_SHA=${SHA}\n`);
    const env: Record<string, string | undefined> = { TEST_ENV: 'staging', EXPECTED_DEPLOY_SHA: OTHER_SHA };
    const result = loadStagingLocalEnv(env, { rootDir: ROOT, readFile });
    assert.deepEqual(seen, [path.join(ROOT, STAGING_LOCAL_ENV_FILE)], 'reads only .env.e2e.staging.local - never .env');
    assert.equal(result.found, true);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.loaded.sort(), ['BASE_URL', 'E2E_TEST_HOOK_SECRET']);
    assert.deepEqual(result.shellSame, ['TEST_ENV']);
    assert.deepEqual(result.shellOverrides, ['EXPECTED_DEPLOY_SHA']);
    assert.equal(env.E2E_TEST_HOOK_SECRET, SECRET, 'quotes in the file are stripped');
    assert.equal(env.EXPECTED_DEPLOY_SHA, OTHER_SHA, 'the shell value wins');
  });

  it('a missing file is not an error (CI passes everything through the environment)', () => {
    const result = loadStagingLocalEnv({}, { rootDir: ROOT, readFile: () => undefined });
    assert.equal(result.found, false);
    assert.deepEqual(result.problems, []);
  });

  it('Windows files: CRLF and a UTF-8 BOM are fine; UTF-16 (PowerShell Out-File) is reported, not silently empty', () => {
    const env: Record<string, string | undefined> = {};
    const ok = loadStagingLocalEnv(env, { rootDir: ROOT, readFile: () => `﻿TEST_ENV=staging\r\nBASE_URL=${APPROVED_STAGING_ORIGIN}\r\nE2E_TEST_HOOK_SECRET=${SECRET}\r\n` });
    assert.deepEqual(ok.problems, []);
    assert.deepEqual(ok.loaded.sort(), ['BASE_URL', 'E2E_TEST_HOOK_SECRET', 'TEST_ENV']);
    assert.equal(env.E2E_TEST_HOOK_SECRET, SECRET, 'no trailing \\r');

    const utf16AsUtf8 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`TEST_ENV=staging\r\n`, 'utf16le')]).toString('utf8');
    const bad = loadStagingLocalEnv({}, { rootDir: ROOT, readFile: () => utf16AsUtf8 });
    assert.ok(bad.problems.some(problem => /UTF-16/.test(problem)), bad.problems.join(' | '));
    assert.deepEqual(bad.loaded, []);
  });

  it('refuses server-side, per-run, unknown and Production values - and then loads nothing', () => {
    const cases: [string, RegExp][] = [
      ['DATABASE_URL=postgres://u:p@db.example.invalid/x', /DATABASE_URL is server-side configuration/],
      ['STRIPE_SECRET_KEY=sk_test_x', /STRIPE_SECRET_KEY is server-side configuration/],
      ['SUPABASE_SERVICE_ROLE_KEY=x', /SUPABASE_SERVICE_ROLE_KEY is server-side configuration/],
      ['DB_ENV=staging', /DB_ENV is server-side configuration/],
      ['E2E_CONFIRM_WRITES=mutating-core', /E2E_CONFIRM_WRITES must not be stored/],
      ['E2E_RUN_ID=r123456-0123456789abcdef', /E2E_RUN_ID must not be stored/],
      ['SOMETHING_ELSE=1', /SOMETHING_ELSE is not a Staging E2E setting/],
      ['BASE_URL=https://www.tennisconnect.com.au', /BASE_URL points at a PRODUCTION host/],
      ['STAGING_SUPABASE_HOST=sk_live_abc', /LIVE Stripe key/],
      ['TEST_ENV=production', /TEST_ENV in \.env\.e2e\.staging\.local must be "staging"/],
    ];
    for (const [line, expected] of cases) {
      const env: Record<string, string | undefined> = {};
      const result = loadStagingLocalEnv(env, { rootDir: ROOT, readFile: () => `E2E_TEST_HOOK_SECRET=${SECRET}\n${line}\n` });
      assert.ok(result.problems.some(problem => expected.test(problem)), `${line}: ${result.problems.join(' | ')}`);
      assert.deepEqual(result.loaded, [], `${line}: nothing is loaded from a refused file`);
      assert.equal(env.E2E_TEST_HOOK_SECRET, undefined);
      assert.ok(!result.problems.join(' ').includes(SECRET));
    }
  });

  it('the committed example holds placeholders only and every key is accepted', () => {
    const text = readFileSync(path.join(ROOT, STAGING_EXAMPLE_ENV_FILE), 'utf8');
    const env: Record<string, string | undefined> = {};
    const result = loadStagingLocalEnv(env, { rootDir: ROOT, readFile: () => text });
    assert.deepEqual(result.problems, []);
    for (const key of result.loaded) assert.ok(STAGING_LOCAL_ALLOWED_KEYS.includes(key), key);
    assert.equal(env.BASE_URL, APPROVED_STAGING_ORIGIN);
    assert.ok(secretProblems(env.E2E_TEST_HOOK_SECRET).some(p => /placeholder/.test(p)), 'the secret is a recognised placeholder');
    // A developer who forgets to fill it in gets told, before any request.
    assert.throws(() => checkConfiguration({ ...env, TEST_ENV: 'staging' }, result), (error: unknown) =>
      error instanceof StagingCheckFailure && error.kind === 'config' && /placeholder/.test(error.message) && /EXPECTED_DEPLOY_SHA/.test(error.message));
  });
});

describe('secret diagnostics never reveal the value', () => {
  it('flags the usual copy/paste mistakes', () => {
    const cases: [string | undefined, RegExp][] = [
      [undefined, /is not set/],
      ['', /is not set/],
      [`"${SECRET}"`, /quote/],
      [`'${SECRET}'`, /quote/],
      [` ${SECRET} `, /whitespace/],
      [`${SECRET}\r`, /whitespace|control/],
      [SECRET.slice(0, 20), /20 characters/],
      ['replace-with-the-staging-test-hook-secret', /placeholder/],
    ];
    for (const [value, expected] of cases) {
      const problems = secretProblems(value);
      assert.ok(problems.some(problem => expected.test(problem)), `${JSON.stringify(value)} -> ${problems.join(' | ')}`);
      if (value) assert.ok(!problems.join(' ').includes(value.trim()), 'the value is never in the message');
    }
    assert.deepEqual(secretProblems(SECRET), []);
  });

  it('fingerprint is a short hash, redaction removes every occurrence', () => {
    assert.match(secretFingerprint(SECRET), /^[0-9a-f]{8}$/);
    assert.ok(!SECRET.includes(secretFingerprint(SECRET)));
    assert.equal(redact(`a ${SECRET} b ${SECRET}`, [SECRET]), 'a [redacted] b [redacted]');
    assert.equal(redact(`x ${SECRET}`, [` ${SECRET} `]), 'x [redacted]');
  });
});

describe('target safety (step 1, before any request)', () => {
  const refusals: [Record<string, string | undefined>, RegExp][] = [
    [{ BASE_URL: 'https://www.tennisconnect.com.au' }, /PRODUCTION host/],
    [{ BASE_URL: 'https://tennisconnect.com.au/' }, /PRODUCTION host/],
    [{ BASE_URL: 'https://another-app.up.railway.app' }, /not the approved Railway Staging URL/],
    [{ BASE_URL: `${APPROVED_STAGING_ORIGIN}/some/path` }, /not the approved Railway Staging URL/],
    [{ BASE_URL: 'http://tennisconnect-staging.up.railway.app' }, /https/],
    [{ BASE_URL: 'http://localhost:3000' }, /loopback/],
    [{ DB_ENV: 'production' }, /DB_ENV=production/],
    [{ ALLOW_PROD: '1' }, /ALLOW_PROD has been removed/],
  ];

  for (const [extra, expected] of refusals) {
    it(`refuses ${JSON.stringify(extra)} without touching the network`, async () => {
      const { impl, calls } = stubFetch();
      const result = await check(goodEnv(extra), impl);
      assert.equal(result.ok, false);
      assert.equal(result.failure?.step, 'config');
      assert.equal(result.failure?.kind, 'unsafe-target');
      assert.match(allOutput(result.lines), expected);
      assert.equal(calls.length, 0, 'no request was made');
    });
  }

  it('lists every missing setting at once', async () => {
    const { impl, calls } = stubFetch();
    const result = await check({ TEST_ENV: 'staging' }, impl);
    assert.equal(result.failure?.kind, 'config');
    const output = allOutput(result.lines);
    for (const name of ['BASE_URL', 'E2E_TEST_HOOK_SECRET', 'EXPECTED_DEPLOY_SHA']) assert.match(output, new RegExp(`${name} is not set`));
    assert.equal(calls.length, 0);
  });

  it('refuses a short SHA and TEST_ENV other than staging', async () => {
    const { impl } = stubFetch();
    const result = await check(goodEnv({ EXPECTED_DEPLOY_SHA: 'abc1234', TEST_ENV: 'local' }), impl);
    assert.equal(result.failure?.kind, 'config');
    assert.match(allOutput(result.lines), /full 40-character/);
    assert.match(allOutput(result.lines), /TEST_ENV must be "staging"/);
  });
});

describe('runStagingCheck (stubbed Staging)', () => {
  it('passes all five steps and never prints the secret', async () => {
    const { impl, calls } = stubFetch();
    const result = await check(goodEnv(), impl);
    assert.equal(result.ok, true, allOutput(result.lines));
    const output = allOutput(result.lines);
    for (const step of ['1/5', '2/5', '3/5', '4/5', '5/5']) assert.match(output, new RegExp(`${step} [^\\n]*: OK`));
    assert.ok(!output.includes(SECRET), 'secret never printed');
    assert.match(output, new RegExp(`${SECRET.length} characters, sha256 ${secretFingerprint(SECRET)}`));
    assert.deepEqual(calls.map(call => `${call.method} ${new URL(call.url).origin}${new URL(call.url).pathname}`), [
      `GET ${APPROVED_STAGING_ORIGIN}/api/health`,
      `POST ${APPROVED_STAGING_ORIGIN}/api/test-hooks/preflight`,
    ]);
    assert.equal(calls[0].secretHeader, undefined, 'the secret is not sent to /api/health');
    assert.equal(calls[1].secretHeader, SECRET, 'the secret travels only as the hook header');
  });

  it('401: names the step, explains the fix, mentions a stale shell override - and redacts an echoed secret', async () => {
    const { impl } = stubFetch({ preflight: () => json({ error: `bad secret ${SECRET}` }, 401) });
    const local = { ...noFile, found: true, shellOverrides: ['E2E_TEST_HOOK_SECRET'] };
    const result = await check(goodEnv(), impl, { localEnv: local });
    assert.equal(result.failure?.step, 'hooks');
    assert.equal(result.failure?.kind, 'http-401');
    const output = allOutput(result.lines);
    assert.match(output, /4\/5 Test-hook authentication: FAILED \(http-401\)/);
    assert.match(output, /Remove-Item Env:E2E_TEST_HOOK_SECRET/);
    assert.match(output, /Do not change the value on Railway/);
    assert.ok(!output.includes(SECRET));
  });

  it('404 from the hook: hooks disabled (not Staging / no secret on the server)', async () => {
    const { impl } = stubFetch({ preflight: () => json({ error: 'Not found' }, 404) });
    const result = await check(goodEnv(), impl);
    assert.equal(result.failure?.step, 'hooks');
    assert.equal(result.failure?.kind, 'http-404');
    assert.match(allOutput(result.lines), /test hooks are disabled/);
  });

  it('404 from /api/health: wrong URL / not deployed', async () => {
    const { impl } = stubFetch({ health: () => new Response('nope', { status: 404 }) });
    const result = await check(goodEnv(), impl);
    assert.equal(result.failure?.step, 'reach');
    assert.equal(result.failure?.kind, 'http-404');
  });

  it('502 while deploying is reported as an unhealthy server', async () => {
    const { impl } = stubFetch({ health: () => new Response('bad gateway', { status: 502 }) });
    const result = await check(goodEnv(), impl);
    assert.equal(result.failure?.kind, 'http-status');
  });

  it('network error is told apart from a timeout', async () => {
    const result = await check(goodEnv(), async () => {
      throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') });
    });
    assert.equal(result.failure?.step, 'reach');
    assert.equal(result.failure?.kind, 'network');
    assert.match(allOutput(result.lines), /ENOTFOUND/);
  });

  it('test-account passwords may live in the file for the auth phase, and are redacted like the secret', async () => {
    const password = `pw-${Math.random().toString(36).slice(2)}-unit`;
    const env: Record<string, string | undefined> = { TEST_ENV: 'staging' };
    const local = loadStagingLocalEnv(env, {
      rootDir: ROOT,
      readFile: () => `BASE_URL=${APPROVED_STAGING_ORIGIN}\nE2E_TEST_HOOK_SECRET=${SECRET}\nEXPECTED_DEPLOY_SHA=${SHA}\nE2E_PLAYER_PASSWORD=${password}\n`,
    });
    assert.deepEqual(local.problems, []);
    assert.equal(env.E2E_PLAYER_PASSWORD, password);
    const result = await check(env, async () => {
      throw new Error(`echo ${password}`);
    }, { localEnv: local });
    const output = allOutput(result.lines);
    assert.ok(!output.includes(password));
    assert.match(output, /E2E_PLAYER_PASSWORD/, 'the key name is shown, the value is not');
  });

  it('output is redacted even if an error message ever contained the secret', async () => {
    const result = await check(goodEnv(), async () => {
      throw new Error(`proxy echoed header X-E2E-Test-Secret: ${SECRET}`);
    });
    assert.equal(result.ok, false);
    const output = allOutput(result.lines);
    assert.match(output, /\[redacted\]/);
    assert.ok(!output.includes(SECRET));
  });

  it('a silent /api/health times out within the request timeout', async () => {
    const started = Date.now();
    const result = await check(goodEnv(), hangUntilAborted, { requestTimeoutMs: 1000 });
    assert.equal(result.failure?.step, 'reach');
    assert.equal(result.failure?.kind, 'timeout');
    assert.match(allOutput(result.lines), /timed out after 1000ms/);
    assert.ok(Date.now() - started < 5000);
  });

  it('a silent preflight hook times out too (it used to wait forever)', async () => {
    const { impl } = stubFetch();
    const fetchImpl: CheckFetch = (input, init) => (input.endsWith('/preflight') ? hangUntilAborted(input, init) : impl(input, init));
    const result = await check(goodEnv(), fetchImpl, { requestTimeoutMs: 1000 });
    assert.equal(result.failure?.step, 'hooks');
    assert.equal(result.failure?.kind, 'timeout');
  });

  it('the overall deadline ends the check even if a request ignores its timeout', async () => {
    const result = await check(goodEnv(), () => new Promise(() => {}), { requestTimeoutMs: 1000, totalTimeoutMs: 150 });
    assert.equal(result.failure?.kind, 'deadline');
    assert.equal(result.failure?.step, 'reach');
    assert.match(allOutput(result.lines), /did not finish within 150 ms/);
  });

  it('deployment mismatch: both commits are named; the hook is never called', async () => {
    const { impl, calls } = stubFetch({ health: () => json({ dbEnv: 'staging', commit: OTHER_SHA }) });
    const result = await check(goodEnv(), impl);
    assert.equal(result.failure?.step, 'deploy');
    assert.equal(result.failure?.kind, 'deploy-mismatch');
    const output = allOutput(result.lines);
    assert.match(output, new RegExp(OTHER_SHA));
    assert.match(output, new RegExp(SHA));
    assert.equal(calls.length, 1);
  });

  it('a deployment without a reported commit cannot be verified', async () => {
    const { impl } = stubFetch({ health: () => json({ dbEnv: 'staging' }) });
    const result = await check(goodEnv(), impl);
    assert.equal(result.failure?.kind, 'deploy-unknown');
  });

  it('a server reporting dbEnv=production is refused before the secret is sent', async () => {
    const { impl, calls } = stubFetch({ health: () => json({ dbEnv: 'production', commit: SHA }) });
    const result = await check(goodEnv(), impl);
    assert.equal(result.failure?.kind, 'not-staging');
    assert.match(allOutput(result.lines), /PRODUCTION/);
    assert.ok(calls.every(call => call.secretHeader === undefined));
  });

  it('preflight rules still apply (email delivery, live Stripe)', async () => {
    const { impl } = stubFetch({ preflight: () => json({ ...goodReport, emailTransport: 'resend', stripeMode: 'live' }) });
    const result = await check(goodEnv(), impl);
    assert.equal(result.failure?.step, 'preflight');
    assert.equal(result.failure?.kind, 'preflight-rules');
    assert.match(allOutput(result.lines), /emailTransport is "resend"/);
    assert.match(allOutput(result.lines), /LIVE key/);
  });

  it('an unexpected hook response shape is reported, not trusted', async () => {
    const { impl } = stubFetch({ preflight: () => json({ hello: 'world' }) });
    const result = await check(goodEnv(), impl);
    assert.equal(result.failure?.step, 'hooks');
    assert.equal(result.failure?.kind, 'bad-response');
  });
});

describe('write confirmation for data-changing phases', () => {
  it('auth-readonly needs none', () => {
    assert.doesNotThrow(() => assertWriteConfirmation('auth-readonly', {}, []));
  });

  it('every writing phase needs a confirmation of exactly that phase', () => {
    for (const phase of ['mutating-core', 'hub-msg-admin', 'security-last', 'stripe'] as const) {
      assert.throws(() => assertWriteConfirmation(phase, {}, []), /No confirmation was given/);
      assert.throws(() => assertWriteConfirmation(phase, { E2E_CONFIRM_WRITES: 'yes' }, []), /different phase/);
      assert.throws(() => assertWriteConfirmation(phase, { E2E_CONFIRM_WRITES: 'auth-readonly' }, []), /different phase/);
      assert.doesNotThrow(() => assertWriteConfirmation(phase, { E2E_CONFIRM_WRITES: phase }, []));
      assert.doesNotThrow(() => assertWriteConfirmation(phase, {}, [`--confirm-writes=${phase}`]));
    }
  });
});
