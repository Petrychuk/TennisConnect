// npm run test:e2e:guard
//
// The Production-safe suite stays read-only in its SOURCE, and the run's
// global setup / teardown cannot write to Production:
//
// - every allowlisted file avoids the calls that can write, log in, send or
//   pay (the same list the Staging read-only check uses, plus a few that only
//   matter on public pages - pressing Enter or the search button on /play
//   runs the AI smart search, a POST);
// - API calls go through the `request` fixture (its post/put/patch/delete
//   throw), never page.request / context.request, which the fixture's
//   browser-route guard cannot see;
// - globalSetup on Production only sends GET /api/health;
// - globalTeardown on Production returns before any network call, even
//   with a test-hook secret and E2E_CLEANUP_ON_TEARDOWN=1 in the shell.
//
// The runtime guards (tests/fixtures/prod-safe.ts) still block writes; this
// catches a write in review, before any run.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generateRunId } from '../../server/seeds/e2e/identities';
import { RUN_ID_ENV } from '../fixtures/run-id';
import { TEST_HOOK_SECRET_ENV } from '../helpers/test-hooks';
import {
  PROD_SAFE_ALLOWLIST,
  PROD_SAFE_GREP,
  VERIFIED_TARGET_ENV_KEY,
  productionTestMatch,
} from './environment-guard';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROD = 'https://www.tennisconnect.com.au';

const FORBIDDEN: [RegExp, string][] = [
  [/\blogin\(/, 'login'],
  [/\blogout\(/, 'logout'],
  [/\bregister\w*\(/, 'registration'],
  [/becomeOrganiser|seedPlayers|seedSession|completeVerification|test-hooks|postTestHook/, 'test hooks / seeding'],
  [/TEST_USERS/, 'seeded credentials'],
  [/request\.(post|put|patch|delete|fetch)\(/, 'write request'],
  [/\b(page|context)\.request\b/, 'page.request / context.request bypass the read-only request fixture'],
  [/\bnew(Context|Page)\(|request\.newContext\(/, 'a second context outside the fixture'],
  [/route\([\s\S]*\.(fulfill|continue)\(/, 'request rewriting'],
  [/setInputFiles/, 'upload'],
  [/continue-to-payment|create-checkout-session|stripe/i, 'payment'],
  [/(save|submit|send|delete|publish|approve|reject|join|register)[\w-]*['"`]\)\.(click|press|tap)/i, 'a submit-like click'],
  [/press\(\s*['"`]Enter['"`]\s*\)/, 'Enter submits forms (and runs the Play smart search)'],
  [/\.(fill|type|pressSequentially)\(\s*['"`][^'"`]*@[^'"`]*['"`]/, 'typing an email address'],
  [/^import\s+(?!type\b)[^;]*from\s+['"]@playwright\/test['"]/m, 'runtime import from @playwright/test (types only)'],
];

describe('prod-safe suite source', () => {
  for (const entry of PROD_SAFE_ALLOWLIST) {
    it(`${entry.file} has no write, login, upload, payment or submit calls`, () => {
      const source = readFileSync(path.join(ROOT, entry.file), 'utf8');
      for (const [pattern, why] of FORBIDDEN) {
        assert.doesNotMatch(source, pattern, `${entry.file}: ${why} (${pattern})`);
      }
    });
  }

  it('the forbidden list catches what it should', () => {
    const hits = (code: string) => FORBIDDEN.filter(([pattern]) => pattern.test(code)).map(([, why]) => why);
    assert.ok(hits("await page.request.post('/api/x')").length > 0);
    assert.ok(hits("await page.getByTestId('play-page-search-input').press('Enter')").length > 0);
    assert.ok(hits("await page.getByTestId('send-reset-link-button').click()").length > 0);
    assert.ok(hits("await page.getByTestId('play-page-search-submit').click()").length > 0);
    assert.ok(hits("await page.getByTestId('event-modal-join').click()").length > 0);
    assert.ok(hits("await page.getByTestId('login-email').fill('a@b.co')").length > 0);
    assert.deepEqual(hits("await page.getByTestId('coaches-search-input').fill('zzz')"), []);
    assert.deepEqual(hits("await page.getByTestId('forgot-password-link').click()"), []);
    assert.ok(hits("import { test } from '@playwright/test';").length > 0);
    assert.deepEqual(hits("import type { Page } from '@playwright/test';"), []);
  });
});

describe('global setup / teardown on Production', () => {
  const savedEnv = { ...process.env };
  const savedFetch = globalThis.fetch;

  afterEach(() => {
    process.env = { ...savedEnv };
    globalThis.fetch = savedFetch;
  });

  function recordFetch(answer: () => Response) {
    const calls: { url: string; method: string }[] = [];
    globalThis.fetch = (async (input: unknown, init?: { method?: string }) => {
      calls.push({ url: String(input), method: (init?.method ?? 'GET').toUpperCase() });
      return answer();
    }) as typeof fetch;
    return calls;
  }

  it('globalSetup only sends GET /api/health and marks the target verified', async () => {
    process.env = { ...savedEnv, TEST_ENV: 'production', BASE_URL: PROD, ALLOW_PROD: '', EXPECTED_DEPLOY_SHA: '' };
    delete process.env.EXPECTED_DEPLOY_SHA;
    const calls = recordFetch(
      () => new Response(JSON.stringify({ dbEnv: 'production' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const { default: globalSetup } = await import('../global-setup');
    const config = {
      projects: [{ name: 'Desktop Chrome', testMatch: productionTestMatch(), grep: PROD_SAFE_GREP, use: { baseURL: `${PROD}/` } }],
    };

    await globalSetup(config as never);

    assert.ok(calls.length > 0, 'the server was asked which environment it is');
    for (const call of calls) {
      assert.equal(call.method, 'GET', call.url);
      assert.equal(new URL(call.url).pathname, '/api/health', call.url);
    }
    assert.match(process.env[VERIFIED_TARGET_ENV_KEY] ?? '', /production/);
  });

  const teardownEnv = (testEnv: string, baseURL: string) => ({
    ...savedEnv,
    TEST_ENV: testEnv,
    BASE_URL: baseURL,
    [RUN_ID_ENV]: generateRunId(),
    [TEST_HOOK_SECRET_ENV]: 'not-a-real-secret',
  });

  it('globalTeardown makes no network call on Production, even with cleanup switched on', async () => {
    process.env = { ...teardownEnv('production', PROD), E2E_CLEANUP_ON_TEARDOWN: '1' };
    const calls = recordFetch(() => new Response('{}', { status: 200 }));
    const { default: globalTeardown } = await import('../global-teardown');

    await globalTeardown();

    assert.deepEqual(calls, [], 'no cleanup request may leave the machine on Production');
  });

  it('control: the same teardown does reach the server on Staging (so the Production check is meaningful)', async () => {
    process.env = { ...teardownEnv('staging', 'https://tennisconnect-staging.up.railway.app'), E2E_CLEANUP_ON_TEARDOWN: '' };
    const calls = recordFetch(() => new Response('{}', { status: 500 }));
    const { default: globalTeardown } = await import('../global-teardown');

    await globalTeardown(); // dry run: a failed plan is only logged

    assert.ok(calls.length > 0, 'staging teardown asks the server for the run plan');
    assert.ok(calls.every((call) => new URL(call.url).origin === 'https://tennisconnect-staging.up.railway.app'));
  });
});
