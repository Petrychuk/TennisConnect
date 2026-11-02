import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type APIRequestContext } from '@playwright/test';
import {
  EnvironmentGuardError,
  assertProdLiveInternalTest,
  productionSuite,
  readVerifiedTarget,
  resolveTarget,
  toRepoRelative,
} from '../safety/environment-guard';
import { allowedLiveWrite } from '../safety/prod-live-internal-rules';

/*
  INTERNAL PRODUCTION LIVE FIXTURE (TC Live v1, docs/live/LIVE_RUNBOOK.md)

  For tests/prod-live-internal/*.spec.ts only. Runs nothing unless this is a
  verified Production run of the opt-in suite (E2E_PROD_SUITE=
  prod-live-internal, confirmed for E2E_PROD_LIVE_SESSION_ID); anywhere else
  every test is skipped.

  - Allowlist: the test must be in PROD_LIVE_INTERNAL_ALLOWLIST and tagged
    @prod-live-internal.
  - Verified target: global setup must have verified the Production server.
  - Writes: only sign-in/out and the Live control routes of the ONE
    internal session (prod-live-internal-rules.ts), in the browser AND
    through `request`. Anything else is aborted and fails the test. No
    DELETE, ever; nothing is cleaned up automatically.
  - Audit trail: every write (allowed or blocked) is appended to
    test-results/prod-live-internal-audit.jsonl and attached to the test.
    Request bodies are not recorded (passwords).
*/

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT_FILE = path.join(REPO_ROOT, 'test-results', 'prod-live-internal-audit.jsonl');

interface AuditEntry {
  at: string;
  test: string;
  method: string;
  path: string;
  outcome: 'sent' | 'blocked';
  status?: number;
}

function audit(entries: AuditEntry[], entry: AuditEntry) {
  entries.push(entry);
  mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
  appendFileSync(AUDIT_FILE, `${JSON.stringify(entry)}\n`);
}

export function prodLiveInternalActive(env: Record<string, string | undefined> = process.env): boolean {
  try {
    return resolveTarget(env).testEnv === 'production' && productionSuite(env) === 'prod-live-internal';
  } catch {
    return false;
  }
}

type Fixtures = { liveInternalGuard: void; liveSessionId: string };

export const test = base.extend<Fixtures>({
  liveSessionId: async ({}, use) => {
    await use((process.env.E2E_PROD_LIVE_SESSION_ID ?? '').trim());
  },

  request: async ({ request }, use, testInfo) => {
    const sessionId = (process.env.E2E_PROD_LIVE_SESSION_ID ?? '').trim();
    const entries: AuditEntry[] = [];
    const guarded = new Proxy(request, {
      get(target, property, receiver) {
        const methodFor: Record<string, string> = { post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', fetch: '' };
        if (typeof property === 'string' && property in methodFor) {
          return async (url: string, options?: any) => {
            const method = (methodFor[property] || options?.method || 'GET').toUpperCase();
            const pathname = new URL(url, 'http://x').pathname;
            if (!allowedLiveWrite(method, pathname, sessionId)) {
              audit(entries, { at: new Date().toISOString(), test: testInfo.title, method, path: pathname, outcome: 'blocked' });
              throw new EnvironmentGuardError(`request ${method} ${pathname} is not allowed in the internal Live suite.`);
            }
            const res = await (property === 'fetch' ? target.fetch(url, options) : (target as any)[property](url, options));
            if (method !== 'GET' && method !== 'HEAD') {
              audit(entries, { at: new Date().toISOString(), test: testInfo.title, method, path: pathname, outcome: 'sent', status: res.status() });
            }
            return res;
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as APIRequestContext;
    await use(guarded);
  },

  liveInternalGuard: [
    async ({ context, baseURL }, use, testInfo) => {
      if (!prodLiveInternalActive()) {
        testInfo.skip(true, 'Internal Production Live suite: runs only with TEST_ENV=production and E2E_PROD_SUITE=prod-live-internal (docs/live/LIVE_RUNBOOK.md).');
        return;
      }
      assertProdLiveInternalTest({ file: toRepoRelative(REPO_ROOT, testInfo.file), title: testInfo.title, tags: testInfo.tags });

      const target = resolveTarget(process.env);
      const verified = readVerifiedTarget(process.env);
      if (!verified || verified.serverEnv !== 'production' || verified.origin !== target.origin || !baseURL || new URL(baseURL).origin !== target.origin) {
        throw new EnvironmentGuardError(`Production target was not verified by tests/global-setup.ts for ${target.origin}.`);
      }

      const sessionId = (process.env.E2E_PROD_LIVE_SESSION_ID ?? '').trim();
      const entries: AuditEntry[] = [];
      const blocked: string[] = [];
      await context.route('**/*', async (route) => {
        const request = route.request();
        const method = request.method().toUpperCase();
        let url: URL | null = null;
        try {
          url = new URL(request.url());
        } catch {
          /* data: etc. */
        }
        const sameOrigin = url?.origin === target.origin;
        if (!sameOrigin) {
          // Third-party: reads only.
          if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.fallback();
          return route.abort('blockedbyclient');
        }
        if (allowedLiveWrite(method, url!.pathname, sessionId)) {
          if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
            const response = await route.fetch();
            audit(entries, { at: new Date().toISOString(), test: testInfo.title, method, path: url!.pathname, outcome: 'sent', status: response.status() });
            return route.fulfill({ response });
          }
          return route.fallback();
        }
        blocked.push(`${method} ${url!.pathname}`);
        audit(entries, { at: new Date().toISOString(), test: testInfo.title, method, path: url!.pathname, outcome: 'blocked' });
        return route.abort('blockedbyclient');
      });

      await use();

      await testInfo.attach('prod-live-internal-audit.json', { body: JSON.stringify(entries, null, 2), contentType: 'application/json' });
      expect(blocked, 'The internal Live suite tried a write outside the allowed Live routes of its session - it was blocked.').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
