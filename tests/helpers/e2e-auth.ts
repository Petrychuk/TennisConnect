// Playwright auth helpers for the Stage 2 baseline accounts
// (e2e-player, e2e-player-2, e2e-coach, e2e-organiser, e2e-admin @tennisconnect.test,
// created only by the operator seed - server/seeds/e2e).
//
// - Logs in through the API (POST /api/auth/login), not the UI, and verifies
//   the session with GET /api/auth/me before handing it to a test.
// - Saves the session to playwright/.auth/e2e-<role>-w<worker>.json
//   (gitignored, mode 0600): one file per role PER WORKER, so parallel
//   workers never share or overwrite each other's state.
// - Each test gets its own browser context; a worker reuses its login for a
//   role (the login endpoint is rate-limited to 10 per 15 min per IP).
//   Tests that log out or change the session must use { fresh: true }.
// - Passwords come only from E2E_*_PASSWORD environment variables; a missing
//   one fails with the variable NAME, never a value.
// - Refused on Production: these accounts exist only on Local/Staging.

import { chmodSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { APIRequestContext, Browser, BrowserContext, TestInfo } from '@playwright/test';
import { baselineIdentity, type BaselineRole } from '../../server/seeds/e2e/identities';

export const AUTH_STATE_DIR = path.join('playwright', '.auth');

export class E2EAuthError extends Error {
  constructor(message: string) {
    super(`[e2e-auth] ${message}`);
    this.name = 'E2EAuthError';
  }
}

export function assertE2EAuthAllowed(env: Record<string, string | undefined> = process.env) {
  const testEnv = env.TEST_ENV ?? 'local';
  if (testEnv !== 'local' && testEnv !== 'staging') {
    throw new E2EAuthError(`baseline E2E accounts are only available on local/staging (TEST_ENV=${testEnv}).`);
  }
}

export function e2eCredentials(role: BaselineRole, env: Record<string, string | undefined> = process.env) {
  const identity = baselineIdentity(role);
  const password = env[identity.passwordEnv];
  if (!password) {
    throw new E2EAuthError(`${identity.passwordEnv} is not set - cannot log in as ${identity.email}.`);
  }
  return { email: identity.email, password, slug: identity.slug };
}

/** Per-role, per-worker state file - parallel workers never share one. */
export function storageStatePath(role: BaselineRole, workerIndex: number, freshIndex?: number): string {
  if (!Number.isInteger(workerIndex) || workerIndex < 0) throw new E2EAuthError('invalid worker index');
  const fresh = freshIndex === undefined ? '' : `-fresh${freshIndex}`;
  return path.join(AUTH_STATE_DIR, `e2e-${role}-w${workerIndex}${fresh}.json`);
}

type RequestLike = Pick<APIRequestContext, 'post' | 'get'>;

/** API login on an existing request context; verifies the session belongs to `role`. */
export async function loginViaApi(request: RequestLike, role: BaselineRole, env: Record<string, string | undefined> = process.env) {
  assertE2EAuthAllowed(env);
  const { email, password } = e2eCredentials(role, env);

  // rememberMe: the server logs out non-remembered sessions after 1 hour
  // idle (server/auth.ts), which would break a worker's cached state
  // mid-run; a remembered session lasts 30 days with no idle cutoff.
  const login = await request.post('/api/auth/login', {
    data: { email, password, rememberMe: true },
    failOnStatusCode: false,
  });
  if (login.status() !== 200) {
    // Status and server code only - the body may echo the email, never the password.
    let code = '';
    try { code = String((await login.json())?.code ?? ''); } catch { /* not JSON */ }
    throw new E2EAuthError(`login as ${role} failed with HTTP ${login.status()}${code ? ` (${code})` : ''}. Has the Staging seed been run?`);
  }

  const me = await request.get('/api/auth/me', { failOnStatusCode: false });
  const body = me.ok() ? await me.json().catch(() => null) : null;
  if (!body?.authenticated || String(body.email).toLowerCase() !== email) {
    throw new E2EAuthError(`session check after login as ${role} failed.`);
  }
  return { email, userId: String(body.id ?? '') };
}

const cachedStates = new Map<string, string>(); // `${role}:${worker}` -> state file (this worker process only)
let freshCounter = 0;

export interface AuthenticatedContextOptions {
  /** Ignore the worker's cached login (use for tests that log out or mutate the session). */
  fresh?: boolean;
}

/**
 * Path of a storage-state file holding a live session for `role`, logged in
 * through the API at most once per worker (unless `fresh`). Callers either
 * open a new context with it or add its cookies to an existing one.
 */
export async function baselineSessionState(
  role: BaselineRole,
  testInfo: Pick<TestInfo, 'workerIndex' | 'project'>,
  options: AuthenticatedContextOptions = {}
): Promise<string> {
  assertE2EAuthAllowed();
  const baseURL = testInfo.project.use.baseURL;
  if (!baseURL) throw new E2EAuthError('no baseURL configured.');

  const key = `${role}:${testInfo.workerIndex}`;
  const cached = options.fresh ? undefined : cachedStates.get(key);
  if (cached) return cached;

  const { request } = await import('@playwright/test');
  const api = await request.newContext({ baseURL });
  let statePath: string;
  try {
    await loginViaApi(api, role);
    // A fresh login gets its own file, so a test that logs out can never
    // invalidate the worker's cached state.
    statePath = storageStatePath(role, testInfo.workerIndex, options.fresh ? freshCounter++ : undefined);
    mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 });
    await api.storageState({ path: statePath });
    chmodSync(statePath, 0o600);
  } finally {
    await api.dispose();
  }
  if (!options.fresh) cachedStates.set(key, statePath);
  return statePath;
}

/** Drops the worker's cached session for `role` (e.g. the server ended it). */
export function forgetBaselineSession(role: BaselineRole, workerIndex: number) {
  cachedStates.delete(`${role}:${workerIndex}`);
}

/** Session cookies from a storage-state file written by baselineSessionState(). */
export function sessionCookies(statePath: string): StoredCookie[] {
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as { cookies?: StoredCookie[] };
  return state.cookies ?? [];
}

export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

/**
 * A NEW browser context logged in as `role`. Caller closes it.
 *
 *   const context = await authenticatedContext(browser, 'organiser', testInfo);
 *   const page = await context.newPage();
 */
export async function authenticatedContext(
  browser: Browser,
  role: BaselineRole,
  testInfo: TestInfo,
  options: AuthenticatedContextOptions = {}
): Promise<BrowserContext> {
  const statePath = await baselineSessionState(role, testInfo, options);
  return browser.newContext({ baseURL: testInfo.project.use.baseURL, storageState: statePath });
}
