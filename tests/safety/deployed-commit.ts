/*
  DEPLOYED-COMMIT CHECK (Railway Staging)

  Railway Staging auto-deploys from `main`. Before CI runs anything
  against it, this proves the instance actually answering at BASE_URL
  runs the commit CI expects - "healthy" is not "the right code".

  Source of truth: GET /api/health -> { dbEnv, commit } (server/lib/health.ts),
  where `commit` is RAILWAY_GIT_COMMIT_SHA as seen by the running process.
  Asking the live instance (rather than e.g. Railway's API for "latest
  deployment") proves what is serving traffic right now.

  FAILS CLOSED when:
    - TEST_ENV is not staging, or BASE_URL fails the environment guard;
    - the expected SHA is not a full 40-char hex SHA;
    - /api/health is unreachable, redirects, is not 200 JSON;
    - dbEnv is not "staging";
    - `commit` is missing (old build without the health change, or a
      deploy not triggered from GitHub, where Railway doesn't set
      RAILWAY_GIT_COMMIT_SHA);
    - the commit doesn't match by the time the wait budget runs out.

  Used by tests/safety/verify-staging-deploy.ts (CI step, with waiting)
  and tests/global-setup.ts (single check when EXPECTED_DEPLOY_SHA is set).
*/

import { EnvironmentGuardError, HEALTH_PATH, resolveTarget, type FetchLike } from './environment-guard';

export const EXPECTED_DEPLOY_SHA_ENV = 'EXPECTED_DEPLOY_SHA';

const FULL_SHA = /^[0-9a-f]{40}$/;

export interface HealthSnapshot {
  dbEnv: string;
  commit: string | undefined;
}

export function normaliseExpectedSha(raw: string | undefined): string {
  const sha = (raw ?? '').trim().toLowerCase();
  if (!FULL_SHA.test(sha)) {
    throw new EnvironmentGuardError(
      `${EXPECTED_DEPLOY_SHA_ENV} must be a full 40-character commit SHA (got "${raw ?? ''}"). ` +
      `Short SHAs are refused - they can be ambiguous.`
    );
  }
  return sha;
}

export async function readHealth(origin: string, fetchImpl: FetchLike, timeoutMs = 5000): Promise<HealthSnapshot> {
  const url = new URL(HEALTH_PATH, origin).toString();
  const controller = new AbortController();
  // Covers the whole exchange, body included - a stalled response can't hang the caller.
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Awaited<ReturnType<FetchLike>>;
  let text: string;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    text = await response.text();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new EnvironmentGuardError(`could not reach ${url} (timed out after ${timeoutMs}ms).`);
    }
    const cause = error instanceof Error && error.cause instanceof Error ? ` - ${error.cause.message}` : '';
    throw new EnvironmentGuardError(
      `could not reach ${url} (${error instanceof Error ? error.message : String(error)}${cause}).`
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new EnvironmentGuardError(`${url} redirected (${response.status}); redirects are not followed.`);
  }
  if (response.status !== 200) {
    throw new EnvironmentGuardError(`${url} responded with HTTP ${response.status}; expected 200.`);
  }
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    throw new EnvironmentGuardError(`${url} did not return JSON.`);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new EnvironmentGuardError(`${url} returned invalid JSON.`);
  }

  const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const dbEnv = typeof record.dbEnv === 'string' ? record.dbEnv.trim().toLowerCase() : '';
  const commit = typeof record.commit === 'string' ? record.commit.trim().toLowerCase() : undefined;

  return { dbEnv, commit };
}

export function assertDeployedCommit(snapshot: HealthSnapshot, expectedSha: string, origin: string) {
  if (snapshot.dbEnv !== 'staging') {
    throw new EnvironmentGuardError(
      `${origin} reports dbEnv="${snapshot.dbEnv || 'missing'}", expected "staging".`
    );
  }

  if (!snapshot.commit) {
    throw new EnvironmentGuardError(
      `${origin}${HEALTH_PATH} does not report a deployed commit, so the deployment ` +
      `cannot be verified. Either the deployed build predates the /api/health "commit" ` +
      `field (server/lib/health.ts), or this deploy was not triggered from GitHub and ` +
      `Railway did not set RAILWAY_GIT_COMMIT_SHA (e.g. a manual redeploy or CLI deploy).`
    );
  }

  if (snapshot.commit !== expectedSha) {
    throw new EnvironmentGuardError(
      `${origin} runs commit ${snapshot.commit}, expected ${expectedSha}.`
    );
  }
}

export interface WaitOptions {
  fetchImpl?: FetchLike;
  /** Total time to wait for Railway to finish deploying. */
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (message: string) => void;
}

/**
 * Waits until the Staging instance reports the expected commit. Only a
 * still-deploying state (old commit, or unreachable mid-restart) is
 * retried; a non-staging dbEnv fails immediately. On timeout, the last
 * reason is reported.
 */
export async function waitForDeployedCommit(
  env: Record<string, string | undefined>,
  rawExpectedSha: string | undefined,
  options: WaitOptions = {}
): Promise<{ origin: string; commit: string }> {
  const target = resolveTarget(env);
  if (target.testEnv !== 'staging') {
    throw new EnvironmentGuardError(`deployed-commit verification is for TEST_ENV=staging only (got ${target.testEnv}).`);
  }

  const expectedSha = normaliseExpectedSha(rawExpectedSha);
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const intervalMs = options.intervalMs ?? 15_000;
  const sleep = options.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);

  const deadline = now() + timeoutMs;
  let lastReason = 'no attempt made';

  for (;;) {
    try {
      const snapshot = await readHealth(target.origin, fetchImpl);
      assertDeployedCommit(snapshot, expectedSha, target.origin);
      return { origin: target.origin, commit: expectedSha };
    } catch (error) {
      if (!(error instanceof EnvironmentGuardError)) throw error;
      // Wrong environment is never "still deploying" - stop now.
      if (/reports dbEnv=/.test(error.message)) throw error;
      lastReason = error.message.replace(/^\s*\[e2e-guard\] Refusing to run: /, '').trim();
    }

    if (now() + intervalMs > deadline) {
      throw new EnvironmentGuardError(
        `Staging did not report commit ${expectedSha} within ${Math.round(timeoutMs / 1000)}s. ` +
        `Last check: ${lastReason}`
      );
    }

    log(`[deploy-check] waiting: ${lastReason}`);
    await sleep(intervalMs);
  }
}
