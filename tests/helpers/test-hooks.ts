import { resolveTarget } from '../safety/environment-guard';
import { currentRunId } from '../fixtures/run-id';

/*
  Authenticated calls to /api/test-hooks/* (server/routes/testHooks.ts).

  The server requires E2E_TEST_HOOK_SECRET in the X-E2E-Test-Secret
  header on every test-hook request. Read from the environment (shell,
  CI secret, or a local untracked .env loaded by playwright.config.ts) -
  never hard-coded.

  Sent with Node's own fetch, NOT page.request / the request fixture, on
  purpose: Playwright traces (kept in the HTML report on retry) record
  APIRequestContext calls including their headers, so the secret would
  end up in trace.zip. Node fetch is invisible to the browser, the page,
  screenshots, videos and traces. The secret is only ever a header -
  never in a URL - and never printed: errors name the variable, not its
  value.

  None of these hooks need the browser's session cookie, which is why a
  plain server-side request is enough.
*/

export const TEST_HOOK_SECRET_ENV = 'E2E_TEST_HOOK_SECRET';
export const TEST_HOOK_SECRET_HEADER = 'X-E2E-Test-Secret';
/** This run's token (tests/fixtures/run-id.ts). Staging requires it on record-creating hooks. */
export const TEST_RUN_ID_HEADER = 'X-E2E-Run-Id';

export type TestHookName =
  | 'issue-verification-token'
  | 'seed-players'
  | 'seed-session'
  | 'preflight'
  | 'emails'
  | 'cleanup-run'
  | 'run-residue';

/** What went wrong, so callers (e.g. the Staging check) can give targeted advice. */
export type TestHookErrorKind = 'config' | 'timeout' | 'network' | 'http' | 'response';

export class TestHookError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly kind: TestHookErrorKind = status === undefined ? 'config' : 'http'
  ) {
    super(message);
    this.name = 'TestHookError';
  }
}

/** Default upper bound for one test-hook request - a call never waits forever. */
export const TEST_HOOK_TIMEOUT_MS = 60_000;

/** Minimal fetch shape postTestHook needs (Node's fetch satisfies it; unit tests stub it). */
export type HookFetch = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; redirect: 'error'; signal: AbortSignal }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface PostTestHookOptions {
  /** Abort the request after this many ms (default TEST_HOOK_TIMEOUT_MS). */
  timeoutMs?: number;
  fetchImpl?: HookFetch;
}

export function getTestHookSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env[TEST_HOOK_SECRET_ENV];

  if (!secret || secret.trim() === '') {
    throw new TestHookError(
      `${TEST_HOOK_SECRET_ENV} is not set. Test hooks (registration email ` +
      `verification, seed-players, seed-session) need it - set it to the same ` +
      `value as the target server's ${TEST_HOOK_SECRET_ENV} (shell, CI secret, ` +
      `or an untracked .env). Never commit it.`
    );
  }

  return secret;
}

export function testHookHeaders(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const runId = currentRunId(env);
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    [TEST_HOOK_SECRET_HEADER]: getTestHookSecret(env),
    ...(runId ? { [TEST_RUN_ID_HEADER]: runId } : {}),
  };
}

/**
 * POSTs to /api/test-hooks/<hook> on the verified BASE_URL target and
 * returns the parsed JSON. Throws a TestHookError (status included, no
 * secret) on any non-2xx response.
 */
export async function postTestHook<T>(
  hook: TestHookName,
  data: unknown,
  env: Record<string, string | undefined> = process.env,
  options: PostTestHookOptions = {}
): Promise<T> {
  const headers = testHookHeaders(env);
  const url = new URL(`/api/test-hooks/${hook}`, resolveTarget(env).origin).toString();
  const timeoutMs = options.timeoutMs ?? TEST_HOOK_TIMEOUT_MS;
  const fetchImpl: HookFetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Awaited<ReturnType<HookFetch>>;
  let bodyText: string;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data ?? {}),
      // Never forward the secret header to wherever a redirect points.
      redirect: 'error',
      signal: controller.signal,
    });
    bodyText = await response.text();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new TestHookError(
        `POST /api/test-hooks/${hook} timed out after ${timeoutMs}ms (no complete response from the server)`,
        undefined,
        'timeout'
      );
    }
    const cause = error instanceof Error && error.cause instanceof Error ? ` - ${error.cause.message}` : '';
    throw new TestHookError(
      `POST /api/test-hooks/${hook} failed: ${error instanceof Error ? error.message : String(error)}${cause}`,
      undefined,
      'network'
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const hint =
      response.status === 401
        ? `the server rejected ${TEST_HOOK_SECRET_ENV} - it doesn't match the server's value`
        : response.status === 404
          ? `test hooks are disabled on this server - it must be development/staging ` +
            `(never production) AND have ${TEST_HOOK_SECRET_ENV} configured`
          : response.status === 403
            ? 'the request referenced a non-test user or data the test user does not own'
            : 'unexpected response';
    const excerpt = bodyText.length > 300 ? `${bodyText.slice(0, 300)}...` : bodyText;
    throw new TestHookError(
      `POST /api/test-hooks/${hook} returned ${response.status} (${hint}): ${excerpt}`,
      response.status
    );
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new TestHookError(`POST /api/test-hooks/${hook} returned ${response.status} but not valid JSON`, response.status, 'response');
  }
}

// ---------- Captured emails (Staging) ----------

export interface CapturedEmail {
  id: string;
  to: string;
  subject: string;
  text: string;
  links: string[];
  capturedAt: number;
}

/**
 * Emails the server captured instead of sending (server/services/emailCapture.ts).
 * Only works for @tennisconnect.test recipients - the server refuses any other.
 */
export async function getCapturedEmails(
  to: string,
  filter: { subjectContains?: string; sinceMs?: number } = {},
  env: Record<string, string | undefined> = process.env
): Promise<CapturedEmail[]> {
  const { emails } = await postTestHook<{ emails: CapturedEmail[] }>('emails', { to, ...filter }, env);
  return emails;
}

/**
 * Polls for a captured email (newest first) until it arrives or the
 * timeout passes. Waits on the observable condition, not a fixed sleep.
 */
export async function waitForCapturedEmail(
  to: string,
  filter: { subjectContains?: string; sinceMs?: number } = {},
  options: { timeoutMs?: number; intervalMs?: number; env?: Record<string, string | undefined> } = {}
): Promise<CapturedEmail> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const intervalMs = options.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const [latest] = await getCapturedEmails(to, filter, options.env ?? process.env);
    if (latest) return latest;
    if (Date.now() + intervalMs > deadline) {
      throw new TestHookError(
        `No captured email for ${to}${filter.subjectContains ? ` matching "${filter.subjectContains}"` : ''} ` +
        `within ${timeoutMs}ms. Is the target capturing email (preflight emailTransport=capture)?`,
        undefined,
        'timeout'
      );
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
