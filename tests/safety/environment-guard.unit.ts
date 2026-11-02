// npm run test:e2e:guard
//
// Unit tests for tests/safety/environment-guard.ts and tests/global-setup.ts.
// No browser, no network: /api/health is stubbed. Named *.unit.ts so
// Playwright never collects it as an E2E spec.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import globalSetup from '../global-setup';
import {
  EnvironmentGuardError,
  PROD_SAFE_ALLOWLIST,
  PROD_SAFE_GREP,
  VERIFIED_TARGET_ENV_KEY,
  assertProdSafeTest,
  assertProjectsSafe,
  extractTestId,
  fetchServerEnvironment,
  productionTestMatch,
  productionSelection,
  productionSuite,
  assertProdLiveInternalTest,
  PROD_LIVE_INTERNAL_ALLOWLIST,
  resolveTarget,
  verifyTargetEnvironment,
  type FetchLike,
  type VerifiedTarget,
} from './environment-guard';
import { allowedLiveWrite } from './prod-live-internal-rules';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const PROD = 'https://tennisconnect.com.au';
const STAGING = 'https://staging.example-tennisconnect.app';
const LOCAL = 'http://localhost:3000';

// ---------- Test data ----------

type StubResponse = {
  status?: number;
  contentType?: string;
  body?: string;
  location?: string;
  throws?: Error;
};

function stubFetch(...responses: StubResponse[]): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  let index = 0;

  const fn = (async (input: string) => {
    calls.push(input);
    const next = responses[Math.min(index, responses.length - 1)];
    index++;

    if (next.throws) throw next.throws;

    const status = next.status ?? 200;
    const headers = new Map<string, string>();
    if (next.contentType !== undefined) headers.set('content-type', next.contentType);
    else headers.set('content-type', 'application/json; charset=utf-8');
    if (next.location) headers.set('location', next.location);

    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
      text: async () => next.body ?? '',
    };
  }) as FetchLike & { calls: string[] };

  fn.calls = calls;
  return fn;
}

const health = (dbEnv: unknown): StubResponse => ({ body: JSON.stringify({ dbEnv }) });

// A complete Staging run configuration (tests/safety/staging-run-config.ts):
// global setup refuses Staging runs without it before verifying the target.
// Generated values - never real credentials.
const STAGING_SHA = 'd'.repeat(40);
const STAGING_RUN_CONFIG: Record<string, string> = {
  E2E_TEST_HOOK_SECRET: `guard-unit-${'g'.repeat(40)}`,
  EXPECTED_DEPLOY_SHA: STAGING_SHA,
  E2E_CONFIRM_WRITES: 'full-regression',
  E2E_PLAYER_PASSWORD: 'unit-pw', E2E_PLAYER_2_PASSWORD: 'unit-pw', E2E_COACH_PASSWORD: 'unit-pw',
  E2E_ORGANISER_PASSWORD: 'unit-pw', E2E_ADMIN_PASSWORD: 'unit-pw',
};
const stagingHealth = (): StubResponse => ({ body: JSON.stringify({ dbEnv: 'staging', commit: STAGING_SHA }) });

function rejects(promise: Promise<unknown>, pattern: RegExp) {
  return assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof EnvironmentGuardError, `expected EnvironmentGuardError, got ${error}`);
    assert.match(error.message, pattern);
    return true;
  });
}

function throwsGuard(fn: () => unknown, pattern: RegExp) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof EnvironmentGuardError, `expected EnvironmentGuardError, got ${error}`);
    assert.match(error.message, pattern);
    return true;
  });
}

// ---------- resolveTarget: TEST_ENV / BASE_URL ----------

describe('resolveTarget', () => {

  it('defaults to local only when neither TEST_ENV nor BASE_URL is set', () => {
    const target = resolveTarget({});
    assert.equal(target.testEnv, 'local');
    assert.equal(target.testEnvSource, 'default-local');
    assert.equal(target.baseURL, LOCAL);
  });

  it('rejects the removed ALLOW_PROD bypass in every form', () => {
    throwsGuard(() => resolveTarget({ ALLOW_PROD: '1' }), /ALLOW_PROD has been removed/);
    throwsGuard(
      () => resolveTarget({ ALLOW_PROD: '1', TEST_ENV: 'production', BASE_URL: PROD }),
      /ALLOW_PROD has been removed/
    );
    throwsGuard(() => resolveTarget({ ALLOW_PROD: 'true', TEST_ENV: 'local' }), /ALLOW_PROD/);
  });

  it('rejects invalid TEST_ENV values', () => {
    throwsGuard(() => resolveTarget({ TEST_ENV: 'prod' }), /not valid/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'Production' }), /not valid/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'dev' }), /not valid/);
  });

  it('requires TEST_ENV whenever BASE_URL is set', () => {
    throwsGuard(() => resolveTarget({ BASE_URL: STAGING }), /TEST_ENV is not/);
    throwsGuard(() => resolveTarget({ BASE_URL: PROD }), /TEST_ENV is not/);
    throwsGuard(() => resolveTarget({ BASE_URL: LOCAL }), /TEST_ENV is not/);
  });

  it('requires BASE_URL for staging and production', () => {
    throwsGuard(() => resolveTarget({ TEST_ENV: 'staging' }), /requires BASE_URL/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'production' }), /requires BASE_URL/);
  });

  it('local accepts loopback hosts only', () => {
    assert.equal(resolveTarget({ TEST_ENV: 'local', BASE_URL: 'http://127.0.0.1:5000' }).testEnv, 'local');
    assert.equal(resolveTarget({ TEST_ENV: 'local', BASE_URL: 'http://[::1]:3000' }).testEnv, 'local');
    throwsGuard(() => resolveTarget({ TEST_ENV: 'local', BASE_URL: STAGING }), /not a loopback/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'local', BASE_URL: PROD }), /PRODUCTION host/);
  });

  it('staging rejects production, loopback and plain-http targets', () => {
    assert.equal(resolveTarget({ TEST_ENV: 'staging', BASE_URL: STAGING }).origin, STAGING);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'staging', BASE_URL: PROD }), /PRODUCTION host/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'staging', BASE_URL: 'https://WWW.TennisConnect.com.au.' }), /PRODUCTION host/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'staging', BASE_URL: LOCAL }), /loopback/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'staging', BASE_URL: 'http://staging.example-tennisconnect.app' }), /https/);
  });

  it('production accepts only known production hosts over https', () => {
    assert.equal(resolveTarget({ TEST_ENV: 'production', BASE_URL: PROD }).testEnv, 'production');
    assert.equal(resolveTarget({ TEST_ENV: 'production', BASE_URL: 'https://www.tennisconnect.com.au/' }).testEnv, 'production');
    throwsGuard(() => resolveTarget({ TEST_ENV: 'production', BASE_URL: STAGING }), /not a known production host/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'production', BASE_URL: LOCAL }), /not a known production host/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'production', BASE_URL: 'http://tennisconnect.com.au' }), /https/);
  });

  it('rejects malformed URLs, other protocols and embedded credentials', () => {
    throwsGuard(() => resolveTarget({ TEST_ENV: 'staging', BASE_URL: 'not a url' }), /not a valid URL/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'local', BASE_URL: 'file:///tmp' }), /http or https/);
    throwsGuard(() => resolveTarget({ TEST_ENV: 'staging', BASE_URL: 'https://user:pw@staging.example-tennisconnect.app' }), /credentials/);
  });

});

// ---------- fetchServerEnvironment / verifyTargetEnvironment ----------

describe('server verification (fails closed)', () => {

  it('production verified when /api/health consistently reports production', async () => {
    const fetchImpl = stubFetch(health('production'));
    const verified = await verifyTargetEnvironment({ TEST_ENV: 'production', BASE_URL: PROD }, { fetchImpl });

    assert.deepEqual(verified, { testEnv: 'production', origin: PROD, serverEnv: 'production' });
    assert.equal(fetchImpl.calls.length, 2);
    assert.equal(fetchImpl.calls[0], `${PROD}/api/health`);
  });

  it('staging allowed only when the server confirms staging', async () => {
    const ok = await verifyTargetEnvironment(
      { TEST_ENV: 'staging', BASE_URL: STAGING },
      { fetchImpl: stubFetch(health('staging')) }
    );
    assert.equal(ok.serverEnv, 'staging');

    await rejects(
      verifyTargetEnvironment({ TEST_ENV: 'staging', BASE_URL: STAGING }, { fetchImpl: stubFetch(health('production')) }),
      /reports dbEnv="production"/
    );
    await rejects(
      verifyTargetEnvironment({ TEST_ENV: 'staging', BASE_URL: STAGING }, { fetchImpl: stubFetch(health('development')) }),
      /reports dbEnv="development"/
    );
  });

  it('local rejects a server that reports production (prod build running locally)', async () => {
    await rejects(
      verifyTargetEnvironment({}, { fetchImpl: stubFetch(health('production')) }),
      /TEST_ENV=local .* dbEnv="production"/
    );
    const ok = await verifyTargetEnvironment({ TEST_ENV: 'local' }, { fetchImpl: stubFetch(health('test')) });
    assert.equal(ok.serverEnv, 'test');
  });

  it('production rejects a server that reports anything but production', async () => {
    for (const dbEnv of ['staging', 'development', 'test', 'local']) {
      await rejects(
        verifyTargetEnvironment({ TEST_ENV: 'production', BASE_URL: PROD }, { fetchImpl: stubFetch(health(dbEnv)) }),
        new RegExp(`dbEnv="${dbEnv}"`)
      );
    }
  });

  it('rejects dbEnv "unknown" (DB_ENV unset on the server) for every TEST_ENV', async () => {
    await rejects(verifyTargetEnvironment({}, { fetchImpl: stubFetch(health('unknown')) }), /dbEnv="unknown"/);
    await rejects(
      verifyTargetEnvironment({ TEST_ENV: 'staging', BASE_URL: STAGING }, { fetchImpl: stubFetch(health('unknown')) }),
      /dbEnv="unknown"/
    );
    await rejects(
      verifyTargetEnvironment({ TEST_ENV: 'production', BASE_URL: PROD }, { fetchImpl: stubFetch(health('unknown')) }),
      /dbEnv="unknown"/
    );
  });

  it('rejects an unreachable /api/health', async () => {
    await rejects(
      fetchServerEnvironment(PROD, { fetchImpl: stubFetch({ throws: new Error('ECONNREFUSED') }) }),
      /could not reach .*ECONNREFUSED/
    );
  });

  it('rejects a /api/health that times out', async () => {
    const hanging: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    await rejects(fetchServerEnvironment(PROD, { fetchImpl: hanging, timeoutMs: 20 }), /could not reach/);
  });

  it('rejects non-200, redirects, non-JSON and malformed bodies', async () => {
    await rejects(fetchServerEnvironment(PROD, { fetchImpl: stubFetch({ status: 404, body: '{}' }) }), /HTTP 404/);
    await rejects(fetchServerEnvironment(PROD, { fetchImpl: stubFetch({ status: 503, body: '{}' }) }), /HTTP 503/);
    await rejects(
      fetchServerEnvironment(PROD, { fetchImpl: stubFetch({ status: 302, location: 'https://elsewhere.example/' }) }),
      /redirect \(302 -> https:\/\/elsewhere/
    );
    await rejects(
      fetchServerEnvironment(PROD, { fetchImpl: stubFetch({ contentType: 'text/html', body: '<!doctype html>' }) }),
      /did not return JSON/
    );
    await rejects(fetchServerEnvironment(PROD, { fetchImpl: stubFetch({ body: '{not json' }) }), /invalid JSON/);
    await rejects(fetchServerEnvironment(PROD, { fetchImpl: stubFetch({ body: '{}' }) }), /no "dbEnv"/);
    await rejects(fetchServerEnvironment(PROD, { fetchImpl: stubFetch(health(42)) }), /no "dbEnv"/);
    await rejects(fetchServerEnvironment(PROD, { fetchImpl: stubFetch(health('  ')) }), /no "dbEnv"/);
  });

  it('rejects inconsistent answers across probes', async () => {
    await rejects(
      fetchServerEnvironment(PROD, { fetchImpl: stubFetch(health('production'), health('staging')) }),
      /inconsistent answers .*production, staging/
    );
  });

});

// ---------- global-setup.ts ----------

describe('tests/global-setup.ts', () => {
  const savedEnv = { ...process.env };
  const savedFetch = globalThis.fetch;

  afterEach(() => {
    process.env = { ...savedEnv };
    globalThis.fetch = savedFetch;
  });

  function config(baseURL: string, overrides: Partial<{ testMatch: unknown; grep: unknown }> = {}) {
    return {
      projects: [{
        name: 'Desktop Chrome',
        testMatch: overrides.testMatch ?? productionTestMatch(),
        grep: overrides.grep ?? PROD_SAFE_GREP,
        use: { baseURL },
      }],
    } as unknown as Parameters<typeof globalSetup>[0];
  }

  function setEnv(values: Record<string, string>) {
    for (const key of ['TEST_ENV', 'BASE_URL', 'ALLOW_PROD', VERIFIED_TARGET_ENV_KEY, 'E2E_STAGING_SCOPE', ...Object.keys(STAGING_RUN_CONFIG)]) delete process.env[key];
    Object.assign(process.env, values);
  }

  it('sets the verified marker for a confirmed production target', async () => {
    setEnv({ TEST_ENV: 'production', BASE_URL: PROD });
    globalThis.fetch = stubFetch(health('production')) as unknown as typeof fetch;

    await globalSetup(config(PROD));

    assert.deepEqual(JSON.parse(process.env[VERIFIED_TARGET_ENV_KEY]!), {
      testEnv: 'production', origin: PROD, serverEnv: 'production',
    });
  });

  it('refuses an unverified production target and leaves no marker', async () => {
    setEnv({ TEST_ENV: 'production', BASE_URL: PROD, [VERIFIED_TARGET_ENV_KEY]: '{"forged":true}' });
    globalThis.fetch = stubFetch({ throws: new Error('ENOTFOUND') }) as unknown as typeof fetch;

    await rejects(globalSetup(config(PROD)), /could not reach/);
    assert.equal(process.env[VERIFIED_TARGET_ENV_KEY], undefined);
  });

  it('refuses ALLOW_PROD=1 even when the server says production', async () => {
    setEnv({ ALLOW_PROD: '1', BASE_URL: PROD });
    globalThis.fetch = stubFetch(health('production')) as unknown as typeof fetch;

    await rejects(globalSetup(config(PROD)), /ALLOW_PROD has been removed/);
  });

  it('refuses a production project whose grep is not @prod-safe (e.g. @smoke)', async () => {
    setEnv({ TEST_ENV: 'production', BASE_URL: PROD });
    globalThis.fetch = stubFetch(health('production')) as unknown as typeof fetch;

    await rejects(globalSetup(config(PROD, { grep: /@smoke/ })), /@smoke are not allowed on Production/);
  });

  it('refuses the full suite (default testMatch) on production', async () => {
    setEnv({ TEST_ENV: 'production', BASE_URL: PROD });
    globalThis.fetch = stubFetch(health('production')) as unknown as typeof fetch;

    await rejects(
      globalSetup(config(PROD, { testMatch: '**/*.@(spec|test).?(c|m)[jt]s?(x)', grep: /.*/ })),
      /testMatch is not the Production allowlist/
    );
  });

  it('allows the full suite on confirmed staging', async () => {
    setEnv({ TEST_ENV: 'staging', BASE_URL: STAGING, ...STAGING_RUN_CONFIG });
    globalThis.fetch = stubFetch(stagingHealth()) as unknown as typeof fetch;

    await globalSetup(config(STAGING, { testMatch: '**/*.@(spec|test).?(c|m)[jt]s?(x)', grep: /.*/ }));

    assert.equal(JSON.parse(process.env[VERIFIED_TARGET_ENV_KEY]!).serverEnv, 'staging');
  });

  it('refuses a project whose baseURL differs from the verified target', async () => {
    setEnv({ TEST_ENV: 'staging', BASE_URL: STAGING, ...STAGING_RUN_CONFIG });
    globalThis.fetch = stubFetch(stagingHealth()) as unknown as typeof fetch;

    await rejects(globalSetup(config(PROD, { grep: /.*/ })), /targets https:\/\/tennisconnect\.com\.au/);
  });
});

// ---------- Production allowlist ----------

describe('production allowlist', () => {
  const verified: VerifiedTarget = { testEnv: 'production', origin: PROD, serverEnv: 'production' };

  it('testMatch matches allowlisted files only, with / or \\ separators', () => {
    const [matcher] = productionTestMatch();
    assert.ok(matcher.test('/repo/tests/prod-safe/prod-safe.spec.ts'));
    assert.ok(matcher.test('C:\\repo\\tests\\prod-safe\\prod-safe.spec.ts'));
    assert.ok(!matcher.test('/repo/tests/smoke/smoke.spec.ts'));
    assert.ok(!matcher.test('/repo/tests/auth/reg-player.spec.ts'));
    assert.ok(!matcher.test('/repo/tests/prod-safe/prod-safe.spec.ts.bak'));
    assert.ok(!matcher.test('/repo/other-tests/prod-safe/prod-safe.spec.tsx'));
  });

  it('extracts FEATURE-NNN ids from titles', () => {
    assert.equal(extractTestId('@prod-safe PROD-SAFE-002 Homepage loads'), 'PROD-SAFE-002');
    assert.equal(extractTestId('@smoke HOME-001 Homepage loads'), 'HOME-001');
    assert.equal(extractTestId('no id here'), undefined);
  });

  it('assertProdSafeTest accepts only listed, tagged tests', () => {
    const file = 'tests/prod-safe/prod-safe.spec.ts';
    assertProdSafeTest({ file, title: '@prod-safe PROD-SAFE-002 Homepage loads', tags: ['@prod-safe'] });

    throwsGuard(
      () => assertProdSafeTest({ file, title: 'PROD-SAFE-002 Homepage loads', tags: [] }),
      /not tagged @prod-safe/
    );
    throwsGuard(
      () => assertProdSafeTest({ file, title: '@prod-safe PROD-SAFE-999 New', tags: ['@prod-safe'] }),
      /PROD-SAFE-999.*not an approved/
    );
    throwsGuard(
      () => assertProdSafeTest({ file: 'tests/smoke/smoke.spec.ts', title: '@smoke @prod-safe HOME-001 Homepage loads', tags: ['@smoke', '@prod-safe'] }),
      /not in PROD_SAFE_ALLOWLIST/
    );
  });

  it('no existing @smoke test file is allowlisted', () => {
    for (const entry of PROD_SAFE_ALLOWLIST) {
      const source = readFileSync(path.join(ROOT, entry.file), 'utf8');
      assert.doesNotMatch(
        source,
        /\btest(?:\.\w+)?\(\s*(['"`])[^'"`]*@smoke/,
        `${entry.file} must not contain @smoke tests`
      );
      assert.doesNotMatch(source, /tag:\s*\[?[^\]\n]*@smoke/, `${entry.file} must not tag tests @smoke`);
      assert.ok(!entry.file.startsWith('tests/smoke/'), `${entry.file} must not be a smoke file`);
    }
  });

  it('every allowlisted file uses the prod-safe fixture and lists exactly its tests', () => {
    for (const entry of PROD_SAFE_ALLOWLIST) {
      const source = readFileSync(path.join(ROOT, entry.file), 'utf8');

      assert.match(source, /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*['"]\.\.\/fixtures\/prod-safe['"]/);
      assert.doesNotMatch(
        source,
        /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*['"]@playwright\/test['"]/,
        `${entry.file} must not import test from @playwright/test`
      );

      const titles = Array.from(source.matchAll(/\btest(?:\.(?:only|skip|fixme|fail))?\(\s*(['"`])(.+?)\1/g), m => m[2]);
      const ids = titles.map(title => extractTestId(title));

      assert.ok(titles.length > 0, `${entry.file} has no tests`);
      for (const title of titles) {
        assert.match(title, /^@prod-safe /, `"${title}" must start with @prod-safe`);
      }
      assert.deepEqual([...ids].sort(), [...entry.testIds].sort(), `${entry.file} tests and allowlist differ`);
    }
  });

  it('assertProjectsSafe accepts the production config shape', () => {
    assertProjectsSafe(
      [{ name: 'Desktop Chrome', testMatch: productionTestMatch(), grep: PROD_SAFE_GREP, use: { baseURL: PROD } }],
      verified
    );
    assertProjectsSafe(
      [{ name: 'Desktop Chrome', testMatch: productionTestMatch(), grep: /@prod-safe PROD-SAFE-002/, use: { baseURL: PROD } }],
      verified
    );
  });
});

// ---------- TC Live v1: internal Production Live suite (opt-in) ----------

describe('prod-live-internal suite selection', () => {
  const SID = '3f2b8c1e-1d2a-4b5c-9e8f-0a1b2c3d4e5f';
  const full = {
    TEST_ENV: 'production',
    BASE_URL: PROD,
    E2E_PROD_SUITE: 'prod-live-internal',
    E2E_PROD_LIVE_SESSION_ID: SID,
    E2E_CONFIRM_PROD_LIVE_INTERNAL: SID,
    E2E_PROD_LIVE_ORGANISER_EMAIL: 'internal-organiser@example.invalid',
    E2E_PROD_LIVE_ORGANISER_PASSWORD: 'not-a-real-password',
    E2E_PROD_LIVE_PLAYER_SLUGS: 'internal-player-1,internal-player-2',
  };

  it('defaults to prod-safe; the internal suite needs the opt-in, every variable and a matching confirmation', () => {
    assert.equal(productionSuite({ TEST_ENV: 'production', BASE_URL: PROD }), 'prod-safe');
    assert.equal(productionSuite(full), 'prod-live-internal');
    assert.throws(() => productionSuite({ ...full, E2E_CONFIRM_PROD_LIVE_INTERNAL: '' }), /confirm this run/);
    assert.throws(() => productionSuite({ ...full, E2E_CONFIRM_PROD_LIVE_INTERNAL: 'yes' }), /confirm this run/);
    assert.throws(() => productionSuite({ ...full, E2E_PROD_LIVE_ORGANISER_PASSWORD: '' }), (e: Error) => /E2E_PROD_LIVE_ORGANISER_PASSWORD/.test(e.message) && !e.message.includes('not-a-real-password'));
    assert.throws(() => productionSuite({ ...full, E2E_PROD_LIVE_SESSION_ID: 'abc', E2E_CONFIRM_PROD_LIVE_INTERNAL: 'abc' }), /uuid/);
    assert.throws(() => productionSuite({ ...full, E2E_PROD_SUITE: 'everything' }), /not a Production suite/);
  });

  it('is refused anywhere but Production', () => {
    for (const TEST_ENV of ['staging', 'local']) {
      assert.throws(() => productionSuite({ ...full, TEST_ENV }), /only for TEST_ENV=production/);
    }
  });

  it('selects only its own file and tag - never the prod-safe suite, never anything else', () => {
    const live = productionSelection('prod-live-internal');
    const safe = productionSelection('prod-safe');
    assert.equal(live.testMatch.length, 1);
    assert.ok(live.testMatch[0].test('tests/prod-live-internal/live-internal.spec.ts'));
    assert.ok(!live.testMatch[0].test('tests/prod-safe/prod-safe.spec.ts'));
    assert.ok(!safe.testMatch.some((re) => re.test('tests/prod-live-internal/live-internal.spec.ts')));
    assert.equal(live.grep.source, '@prod-live-internal');
    assert.equal(safe.grep.source, '@prod-safe');
    assert.deepEqual(PROD_LIVE_INTERNAL_ALLOWLIST[0].testIds, ['LIVE-PROD-001', 'LIVE-PROD-002']);
  });

  it('global setup refuses a Production project that mixes the suites', () => {
    const verified = { testEnv: 'production', serverEnv: 'production', origin: PROD } as VerifiedTarget;
    const live = productionSelection('prod-live-internal');
    assert.doesNotThrow(() => assertProjectsSafe([{ name: 'c', testMatch: live.testMatch, grep: live.grep, use: { baseURL: PROD } }], verified, 'prod-live-internal'));
    assert.throws(() => assertProjectsSafe([{ name: 'c', testMatch: productionTestMatch(), grep: PROD_SAFE_GREP, use: { baseURL: PROD } }], verified, 'prod-live-internal'), /allowlist for prod-live-internal/);
    assert.throws(() => assertProjectsSafe([{ name: 'c', testMatch: live.testMatch, grep: live.grep, use: { baseURL: PROD } }], verified, 'prod-safe'), /allowlist for prod-safe/);
  });

  it('per-test allowlist', () => {
    const file = 'tests/prod-live-internal/live-internal.spec.ts';
    assert.doesNotThrow(() => assertProdLiveInternalTest({ file, title: '@prod-live-internal LIVE-PROD-002 flow', tags: ['@prod-live-internal'] }));
    assert.throws(() => assertProdLiveInternalTest({ file, title: '@prod-live-internal LIVE-PROD-009 x', tags: ['@prod-live-internal'] }), /not in PROD_LIVE_INTERNAL_ALLOWLIST/);
    assert.throws(() => assertProdLiveInternalTest({ file, title: 'LIVE-PROD-001 x', tags: [] }), /not tagged/);
    assert.throws(() => assertProdLiveInternalTest({ file: 'tests/live/live-engine.spec.ts', title: '@prod-live-internal LIVE-001', tags: ['@prod-live-internal'] }), /not in PROD_LIVE_INTERNAL_ALLOWLIST/);
  });

  it('writes: only sign-in/out and the Live routes of the one internal session', () => {
    const base = `/api/organizer/sessions/${SID}`;
    for (const p of ['/api/auth/login', '/api/auth/logout', `${base}/checkin/r1`, `${base}/go-live`, `${base}/rounds/generate`, `${base}/matches/m1/score`, `${base}/matches/m1/start`, `${base}/registrations/r1/live-status`, `${base}/finish`]) {
      assert.equal(allowedLiveWrite('POST', p, SID), true, p);
    }
    const other = 'aaaaaaaa-1d2a-4b5c-9e8f-0a1b2c3d4e5f';
    for (const [m, p] of [
      ['POST', `/api/organizer/sessions/${other}/finish`],
      ['DELETE', `${base}/registrations/r1`],
      ['PUT', base],
      ['POST', `${base}/broadcast`],
      ['POST', `${base}/invite`],
      ['POST', `${base}/join`],
      ['POST', '/api/organizer/sessions'],
      ['POST', '/api/auth/register'],
      ['PATCH', '/api/admin/users/x/grant-organizer'],
      ['POST', `${base}/finish/extra`],
    ]) {
      assert.equal(allowedLiveWrite(m, p, SID), false, `${m} ${p}`);
    }
    assert.equal(allowedLiveWrite('GET', '/api/anything', SID), true);
    assert.equal(allowedLiveWrite('POST', `${base}/finish`, 'not-a-uuid'), false);
  });
});
