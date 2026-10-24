// npm run test:e2e:guard
//
// tests/helpers/test-hooks.ts - the Playwright-side client for
// /api/test-hooks/*. Runs against a throwaway HTTP server on loopback
// (TEST_ENV=local), never a real environment.

import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { TestHookError, getTestHookSecret, postTestHook } from '../helpers/test-hooks';

// Generated per run - never a real credential.
const SECRET = `client-${'c'.repeat(40)}-${Math.random().toString(36).slice(2)}`;

interface Seen {
  url: string;
  method: string;
  header: string | undefined;
  body: string;
}

describe('tests/helpers/test-hooks.ts', () => {
  const seen: Seen[] = [];
  let server: http.Server;
  let origin = '';
  let respondWith: { status: number; body: unknown; location?: string } = { status: 200, body: {} };

  before(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        seen.push({
          url: req.url ?? '',
          method: req.method ?? '',
          header: req.headers['x-e2e-test-secret'] as string | undefined,
          body,
        });
        res.statusCode = respondWith.status;
        if (respondWith.location) res.setHeader('location', respondWith.location);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(respondWith.body));
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => new Promise<void>(resolve => server.close(() => resolve())));

  const env = () => ({ TEST_ENV: 'local', BASE_URL: origin, E2E_TEST_HOOK_SECRET: SECRET });

  it('fails clearly, without any value, when the secret is missing or blank', () => {
    for (const value of [undefined, '', '   ']) {
      assert.throws(
        () => getTestHookSecret({ E2E_TEST_HOOK_SECRET: value }),
        (error: unknown) =>
          error instanceof TestHookError && /E2E_TEST_HOOK_SECRET is not set/.test(error.message)
      );
    }
  });

  it('refuses to call a hook at all when the secret is missing', async () => {
    const before = seen.length;
    await assert.rejects(
      postTestHook('seed-players', { count: 1 }, { TEST_ENV: 'local', BASE_URL: origin }),
      /E2E_TEST_HOOK_SECRET is not set/
    );
    assert.equal(seen.length, before, 'no request should have been sent');
  });

  it('sends the secret only in X-E2E-Test-Secret, never in the URL or body', async () => {
    respondWith = { status: 200, body: { players: [{ id: 'p1' }] } };
    const result = await postTestHook<{ players: { id: string }[] }>('seed-players', { count: 1 }, env());

    const request = seen[seen.length - 1];
    assert.deepEqual(result.players, [{ id: 'p1' }]);
    assert.equal(request.method, 'POST');
    assert.equal(request.url, '/api/test-hooks/seed-players');
    assert.equal(request.header, SECRET);
    assert.ok(!request.url.includes(SECRET));
    assert.ok(!request.body.includes(SECRET));
    assert.deepEqual(JSON.parse(request.body), { count: 1 });
  });

  it('reports 401 / 404 / 403 with a hint and never includes the secret', async () => {
    for (const [status, hint] of [
      [401, /doesn't match/],
      [404, /disabled on this server/],
      [403, /non-test user/],
    ] as const) {
      respondWith = { status, body: { message: 'nope' } };
      await assert.rejects(postTestHook('seed-session', {}, env()), (error: unknown) => {
        assert.ok(error instanceof TestHookError);
        assert.equal(error.status, status);
        assert.match(error.message, hint);
        assert.ok(!error.message.includes(SECRET));
        return true;
      });
    }
  });

  it('does not follow redirects (the secret header must not travel elsewhere)', async () => {
    respondWith = { status: 302, body: {}, location: 'http://127.0.0.2:9/elsewhere' };
    await assert.rejects(postTestHook('seed-players', { count: 1 }, env()), TestHookError);
  });

  it('only targets the guard-validated BASE_URL', async () => {
    await assert.rejects(
      postTestHook('seed-players', { count: 1 }, { ...env(), TEST_ENV: 'local', BASE_URL: 'https://tennisconnect.com.au' }),
      /PRODUCTION host/
    );
  });
});
