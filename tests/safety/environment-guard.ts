/*
  E2E ENVIRONMENT GUARD

  Single source of truth for "where is this Playwright run allowed to go,
  and what is it allowed to run there". Used by:

  - playwright.config.ts     -> resolveTarget() at config load (sync checks:
                                TEST_ENV, BASE_URL, removed ALLOW_PROD) and
                                productionTestMatch() for the Production
                                allowlist.
  - tests/global-setup.ts    -> verifyTargetEnvironment() before any test
                                runs (async: asks the live server which
                                environment it is via GET /api/health) and
                                assertProjectsSafe().
  - tests/fixtures/prod-safe.ts -> assertProdSafeTest() + the verified
                                target marker, per test, at runtime.

  Everything here FAILS CLOSED: if the target can't be positively
  identified as the environment TEST_ENV claims, the run is refused.

  TEST_ENV values:
    local       BASE_URL must be a loopback host (default
                http://localhost:3000). Server must report a non-production
                DB_ENV (local / development / test / staging). Full suite.
    staging     BASE_URL required, https, not loopback, not a production
                host. Server must report DB_ENV=staging. Full suite.
    production  BASE_URL required, https, a known production host. Server
                must report DB_ENV=production. ONLY the explicit
                PROD_SAFE_ALLOWLIST below can run.

  This module must stay free of @playwright/test runtime imports so its
  unit tests (tests/safety/*.unit.ts) run with plain `tsx --test`.
*/

import path from 'node:path';

// ---------- Environments ----------

export const TEST_ENVS = ['local', 'staging', 'production'] as const;

export type TestEnv = (typeof TEST_ENVS)[number];

export const DEFAULT_LOCAL_BASE_URL = 'http://localhost:3000';

// Known PRODUCTION hostnames. Any BASE_URL on these hosts is only ever
// usable with TEST_ENV=production (and therefore only the prod-safe suite).
export const PRODUCTION_HOSTS: readonly string[] = [
  'tennisconnect.com.au',
  'www.tennisconnect.com.au',
];

export const LOCAL_HOSTS: readonly string[] = [
  'localhost',
  '127.0.0.1',
  '::1',
];

// What the live server (GET /api/health -> { dbEnv }) must report for
// each TEST_ENV. "unknown" (DB_ENV unset on the server) is never accepted.
export const ALLOWED_SERVER_ENVS: Readonly<Record<TestEnv, readonly string[]>> = {
  local: ['local', 'development', 'test', 'staging'],
  staging: ['staging'],
  production: ['production'],
};

// Set by tests/global-setup.ts after verification; read by test workers
// (Playwright propagates env vars set in globalSetup to workers).
export const VERIFIED_TARGET_ENV_KEY = 'TC_E2E_VERIFIED_TARGET';

export const HEALTH_PATH = '/api/health';

export class EnvironmentGuardError extends Error {
  constructor(message: string) {
    super(`\n\n[e2e-guard] Refusing to run: ${message}\n`);
    this.name = 'EnvironmentGuardError';
  }
}

type EnvLike = Record<string, string | undefined>;

export interface ResolvedTarget {
  testEnv: TestEnv;
  /** 'explicit' = TEST_ENV was set; 'default-local' = unset, no BASE_URL. */
  testEnvSource: 'explicit' | 'default-local';
  baseURL: string;
  origin: string;
  hostname: string;
}

export interface VerifiedTarget {
  testEnv: TestEnv;
  origin: string;
  serverEnv: string;
}

// ---------- Host helpers ----------

function normaliseHostname(hostname: string): string {
  // URL.hostname keeps IPv6 brackets ("[::1]") and may keep a trailing dot.
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

export function isLocalHost(hostname: string): boolean {
  const host = normaliseHostname(hostname);
  return LOCAL_HOSTS.includes(host) || /^127(\.\d{1,3}){3}$/.test(host);
}

export function isProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.includes(normaliseHostname(hostname));
}

// ---------- Sync resolution (config load time) ----------

export function parseTestEnv(raw: string | undefined): TestEnv | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;

  const value = raw.trim();
  if ((TEST_ENVS as readonly string[]).includes(value)) {
    return value as TestEnv;
  }

  throw new EnvironmentGuardError(
    `TEST_ENV="${raw}" is not valid. Use one of: ${TEST_ENVS.join(', ')}.`
  );
}

/**
 * Validates TEST_ENV + BASE_URL without touching the network.
 * Throws EnvironmentGuardError on any unsafe or ambiguous combination.
 */
export function resolveTarget(env: EnvLike): ResolvedTarget {
  // ---------- Removed bypass ----------

  if (env.ALLOW_PROD !== undefined && env.ALLOW_PROD !== '') {
    throw new EnvironmentGuardError(
      `ALLOW_PROD has been removed and is no longer honoured. ` +
      `Unset it. To run the production-safe suite use ` +
      `"npm run test:e2e:prod-safe" with BASE_URL set to the production URL.`
    );
  }

  // ---------- TEST_ENV ----------

  const rawBaseURL = env.BASE_URL?.trim() || undefined;
  const explicitEnv = parseTestEnv(env.TEST_ENV);

  if (!explicitEnv && rawBaseURL) {
    throw new EnvironmentGuardError(
      `BASE_URL is set (${rawBaseURL}) but TEST_ENV is not. ` +
      `Set TEST_ENV=local|staging|production explicitly whenever BASE_URL is set ` +
      `(e.g. "npm run test:e2e:staging").`
    );
  }

  const testEnv: TestEnv = explicitEnv ?? 'local';
  const testEnvSource = explicitEnv ? 'explicit' : 'default-local';

  if (testEnv !== 'local' && !rawBaseURL) {
    throw new EnvironmentGuardError(
      `TEST_ENV=${testEnv} requires BASE_URL to be set explicitly - ` +
      `there is no default target for ${testEnv}.`
    );
  }

  // ---------- BASE_URL ----------

  const baseURL = rawBaseURL ?? DEFAULT_LOCAL_BASE_URL;

  let url: URL;
  try {
    url = new URL(baseURL);
  } catch {
    throw new EnvironmentGuardError(`BASE_URL "${baseURL}" is not a valid URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new EnvironmentGuardError(
      `BASE_URL must use http or https (got "${url.protocol}").`
    );
  }

  if (url.username || url.password) {
    throw new EnvironmentGuardError(
      `BASE_URL must not contain credentials. Pass test credentials via ` +
      `TEST_*_EMAIL / TEST_*_PASSWORD environment variables instead.`
    );
  }

  const hostname = url.hostname;
  const local = isLocalHost(hostname);
  const production = isProductionHost(hostname);

  // ---------- TEST_ENV <-> BASE_URL consistency ----------

  if (testEnv === 'local' && !local) {
    throw new EnvironmentGuardError(
      `TEST_ENV=local but BASE_URL (${baseURL}) is not a loopback host. ` +
      (production
        ? `That is a PRODUCTION host - use "npm run test:e2e:prod-safe".`
        : `Use TEST_ENV=staging for a remote staging server.`)
    );
  }

  if (testEnv === 'staging') {
    if (production) {
      throw new EnvironmentGuardError(
        `TEST_ENV=staging but BASE_URL (${baseURL}) is a known PRODUCTION host.`
      );
    }
    if (local) {
      throw new EnvironmentGuardError(
        `TEST_ENV=staging but BASE_URL (${baseURL}) is a loopback host. ` +
        `Use TEST_ENV=local for a server on this machine.`
      );
    }
    if (url.protocol !== 'https:') {
      throw new EnvironmentGuardError(
        `TEST_ENV=staging requires an https BASE_URL (got ${baseURL}).`
      );
    }
  }

  if (testEnv === 'production') {
    if (!production) {
      throw new EnvironmentGuardError(
        `TEST_ENV=production but BASE_URL (${baseURL}) is not a known ` +
        `production host (${PRODUCTION_HOSTS.join(', ')}).`
      );
    }
    if (url.protocol !== 'https:') {
      throw new EnvironmentGuardError(
        `TEST_ENV=production requires an https BASE_URL (got ${baseURL}).`
      );
    }
  }

  return {
    testEnv,
    testEnvSource,
    baseURL,
    origin: url.origin,
    hostname: normaliseHostname(hostname),
  };
}

// ---------- Async verification (global setup) ----------

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    redirect?: 'manual' | 'follow' | 'error';
    headers?: Record<string, string>;
    signal?: AbortSignal;
    cache?: 'no-store';
  }
) => Promise<{
  status: number;
  ok: boolean;
  type?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface VerifyOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** How many /api/health probes must agree. Default 2. */
  probes?: number;
}

async function probeHealthOnce(
  origin: string,
  fetchImpl: FetchLike,
  timeoutMs: number
): Promise<string> {
  const healthURL = new URL(HEALTH_PATH, origin).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(healthURL, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    throw new EnvironmentGuardError(
      `could not reach ${healthURL} to verify the target environment ` +
      `(${error instanceof Error ? error.message : String(error)}). ` +
      `The run is refused when the environment cannot be verified.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new EnvironmentGuardError(
      `${healthURL} responded with a redirect (${response.status}` +
      `${response.headers.get('location') ? ` -> ${response.headers.get('location')}` : ''}). ` +
      `Point BASE_URL at the final origin; redirects are not followed during verification.`
    );
  }

  if (response.status !== 200) {
    throw new EnvironmentGuardError(
      `${healthURL} responded with HTTP ${response.status}; expected 200.`
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new EnvironmentGuardError(
      `${healthURL} did not return JSON (content-type "${contentType}"). ` +
      `/api/health may not be deployed on this target (an SPA fallback page ` +
      `is not a verification).`
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    throw new EnvironmentGuardError(`${healthURL} returned invalid JSON.`);
  }

  const dbEnv =
    body && typeof body === 'object' && 'dbEnv' in body
      ? (body as { dbEnv: unknown }).dbEnv
      : undefined;

  if (typeof dbEnv !== 'string' || dbEnv.trim() === '') {
    throw new EnvironmentGuardError(
      `${healthURL} response has no "dbEnv" string; cannot verify the environment.`
    );
  }

  return dbEnv.trim().toLowerCase();
}

/** Asks the live server which environment it is. Fails closed. */
export async function fetchServerEnvironment(
  origin: string,
  options: VerifyOptions = {}
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const timeoutMs = options.timeoutMs ?? 5000;
  const probes = Math.max(1, options.probes ?? 2);

  const answers: string[] = [];
  for (let i = 0; i < probes; i++) {
    answers.push(await probeHealthOnce(origin, fetchImpl, timeoutMs));
  }

  const distinct = Array.from(new Set(answers));
  if (distinct.length !== 1) {
    throw new EnvironmentGuardError(
      `${origin}${HEALTH_PATH} gave inconsistent answers across ${probes} probes ` +
      `(${answers.join(', ')}). Possibly mixed instances behind a load balancer.`
    );
  }

  return distinct[0];
}

export function assertServerEnvMatches(testEnv: TestEnv, serverEnv: string, origin: string) {
  if (serverEnv === 'unknown') {
    throw new EnvironmentGuardError(
      `the server at ${origin} reports dbEnv="unknown" (DB_ENV is not set on the ` +
      `server). Set DB_ENV on that server (see server/env.ts) so the target can be verified.`
    );
  }

  if (!ALLOWED_SERVER_ENVS[testEnv].includes(serverEnv)) {
    throw new EnvironmentGuardError(
      `TEST_ENV=${testEnv} but the server at ${origin} reports dbEnv="${serverEnv}" ` +
      `(allowed for ${testEnv}: ${ALLOWED_SERVER_ENVS[testEnv].join(', ')}).`
    );
  }
}

/** Full verification: sync checks + live server check. */
export async function verifyTargetEnvironment(
  env: EnvLike,
  options: VerifyOptions = {}
): Promise<VerifiedTarget> {
  const target = resolveTarget(env);
  const serverEnv = await fetchServerEnvironment(target.origin, options);
  assertServerEnvMatches(target.testEnv, serverEnv, target.origin);

  return { testEnv: target.testEnv, origin: target.origin, serverEnv };
}

export function serializeVerifiedTarget(target: VerifiedTarget): string {
  return JSON.stringify(target);
}

export function readVerifiedTarget(env: EnvLike): VerifiedTarget | undefined {
  const raw = env[VERIFIED_TARGET_ENV_KEY];
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<VerifiedTarget>;
    if (
      typeof parsed.testEnv === 'string' &&
      (TEST_ENVS as readonly string[]).includes(parsed.testEnv) &&
      typeof parsed.origin === 'string' &&
      typeof parsed.serverEnv === 'string'
    ) {
      return parsed as VerifiedTarget;
    }
  } catch {
    // fall through
  }
  return undefined;
}

// ---------- Production allowlist ----------

export const PROD_SAFE_TAG = '@prod-safe';

export interface ProdSafeEntry {
  /** Path relative to the repo root, forward slashes. */
  file: string;
  /** Test IDs (FEATURE-NNN) in that file approved for Production. */
  testIds: readonly string[];
}

/*
  THE production allowlist. A test runs on Production only if:
    1. its file is listed here (enforced by testMatch in playwright.config.ts),
    2. its ID is listed here and its title carries @prod-safe
       (enforced at runtime by tests/fixtures/prod-safe.ts), and
    3. the file uses `test` from tests/fixtures/prod-safe.ts
       (enforced by tests/safety/environment-guard.unit.ts).

  Adding anything here is a reviewed decision. Read-only checks only:
  no registration, login, form submits, uploads, admin actions or deletes.
  Existing @smoke tests are NOT production-safe by default (the @smoke set
  includes REG-001/REG-002 registration and authenticated flows).
*/
export const PROD_SAFE_ALLOWLIST: readonly ProdSafeEntry[] = [
  {
    file: 'tests/prod-safe/prod-safe.spec.ts',
    testIds: [
      'PROD-SAFE-001',
      'PROD-SAFE-002',
      'PROD-SAFE-003',
      'PROD-SAFE-004',
      'PROD-SAFE-005',
    ],
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * testMatch for Production: one anchored RegExp per allowlisted file,
 * matching both / and \ separators (Windows).
 */
export function productionTestMatch(
  allowlist: readonly ProdSafeEntry[] = PROD_SAFE_ALLOWLIST
): RegExp[] {
  return allowlist.map(entry => {
    const parts = entry.file.split('/').map(escapeRegExp);
    return new RegExp(`(^|[\\\\/])${parts.join('[\\\\/]')}$`);
  });
}

export const PROD_SAFE_GREP = new RegExp(escapeRegExp(PROD_SAFE_TAG));

export function toRepoRelative(rootDir: string, file: string): string {
  return path.relative(rootDir, file).split(path.sep).join('/');
}

export function extractTestId(title: string): string | undefined {
  return title.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}\b/)?.[0];
}

/** Throws unless (file, title, tags) is an allowlisted @prod-safe test. */
export function assertProdSafeTest(
  test: { file: string; title: string; tags: readonly string[] },
  allowlist: readonly ProdSafeEntry[] = PROD_SAFE_ALLOWLIST
) {
  const entry = allowlist.find(item => item.file === test.file);
  if (!entry) {
    throw new EnvironmentGuardError(
      `"${test.file}" is not in PROD_SAFE_ALLOWLIST (tests/safety/environment-guard.ts).`
    );
  }

  if (!test.tags.includes(PROD_SAFE_TAG)) {
    throw new EnvironmentGuardError(
      `test "${test.title}" in ${test.file} is not tagged ${PROD_SAFE_TAG}.`
    );
  }

  const id = extractTestId(test.title);
  if (!id || !entry.testIds.includes(id)) {
    throw new EnvironmentGuardError(
      `test "${test.title}" (id ${id ?? 'missing'}) is not an approved ` +
      `production-safe test in PROD_SAFE_ALLOWLIST.`
    );
  }
}

// ---------- Resolved Playwright config checks (global setup) ----------

export interface ProjectLike {
  name: string;
  testMatch: string | RegExp | Array<string | RegExp>;
  grep: RegExp | RegExp[];
  use?: { baseURL?: string };
}

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Re-checks the resolved project config before tests run: every project
 * targets the verified origin, and on Production every project is
 * restricted to the allowlist and to @prod-safe. (A CLI --grep is applied
 * in addition to the project grep, so it can narrow but not widen.)
 */
export function assertProjectsSafe(projects: readonly ProjectLike[], target: VerifiedTarget) {
  if (projects.length === 0) {
    throw new EnvironmentGuardError('no Playwright projects are configured.');
  }

  for (const project of projects) {
    const projectBase = project.use?.baseURL;
    if (!projectBase) {
      throw new EnvironmentGuardError(`project "${project.name}" has no baseURL.`);
    }
    let projectOrigin: string;
    try {
      projectOrigin = new URL(projectBase).origin;
    } catch {
      throw new EnvironmentGuardError(`project "${project.name}" baseURL "${projectBase}" is invalid.`);
    }
    if (projectOrigin !== target.origin) {
      throw new EnvironmentGuardError(
        `project "${project.name}" targets ${projectOrigin}, but the verified ` +
        `target is ${target.origin}.`
      );
    }

    if (target.testEnv !== 'production') continue;

    const expected = productionTestMatch().map(re => re.source).sort();
    const actual = asArray(project.testMatch)
      .map(item => (item instanceof RegExp ? item.source : `glob:${item}`))
      .sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new EnvironmentGuardError(
        `project "${project.name}" testMatch is not the Production allowlist.`
      );
    }

    const greps = asArray(project.grep);
    if (greps.length === 0 || !greps.every(re => re.source.includes(PROD_SAFE_TAG))) {
      throw new EnvironmentGuardError(
        `on Production the test filter must select ${PROD_SAFE_TAG} ` +
        `(got ${greps.map(re => `/${re.source}/`).join(', ') || 'none'}). ` +
        `Filters such as @smoke are not allowed on Production.`
      );
    }
  }
}
