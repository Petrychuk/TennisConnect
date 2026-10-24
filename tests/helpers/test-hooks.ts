import { resolveTarget } from '../safety/environment-guard';

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

export class TestHookError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'TestHookError';
  }
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
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    [TEST_HOOK_SECRET_HEADER]: getTestHookSecret(env),
  };
}

/**
 * POSTs to /api/test-hooks/<hook> on the verified BASE_URL target and
 * returns the parsed JSON. Throws a TestHookError (status included, no
 * secret) on any non-2xx response.
 */
export async function postTestHook<T>(
  hook: 'issue-verification-token' | 'seed-players' | 'seed-session',
  data: unknown,
  env: Record<string, string | undefined> = process.env
): Promise<T> {
  const headers = testHookHeaders(env);
  const url = new URL(`/api/test-hooks/${hook}`, resolveTarget(env).origin).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data ?? {}),
      // Never forward the secret header to wherever a redirect points.
      redirect: 'error',
    });
  } catch (error) {
    throw new TestHookError(
      `POST /api/test-hooks/${hook} failed: ${error instanceof Error ? error.message : String(error)}`
    );
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
    throw new TestHookError(
      `POST /api/test-hooks/${hook} returned ${response.status} (${hint}): ${await response.text()}`,
      response.status
    );
  }

  return (await response.json()) as T;
}
