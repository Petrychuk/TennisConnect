import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type APIRequestContext } from '@playwright/test';
import {
  EnvironmentGuardError,
  assertProdSafeTest,
  readVerifiedTarget,
  resolveTarget,
  toRepoRelative,
} from '../safety/environment-guard';

/*
  PROD-SAFE TEST FIXTURE

  Every file in PROD_SAFE_ALLOWLIST must import `test` / `expect` from here
  instead of '@playwright/test' (checked by tests/safety/*.unit.ts).

  It adds, automatically, to every test in those files - on every
  environment, so a violation shows up on local/staging before Production:

  - Allowlist check: the test must be listed in PROD_SAFE_ALLOWLIST and
    tagged @prod-safe.
  - Verified target: on Production, tests/global-setup.ts must have
    verified the server (TC_E2E_VERIFIED_TARGET) for this exact origin.
  - Read-only network: any browser request that is not GET/HEAD/OPTIONS is
    aborted. If it was aimed at the app's own origin, the test fails.
  - Read-only `request` fixture: post/put/patch/delete throw.
*/

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Repo root (allowlist paths are repo-relative). Not testInfo.config.rootDir,
// which is the testDir.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readOnlyRequest(request: APIRequestContext): APIRequestContext {
  return new Proxy(request, {
    get(target, property, receiver) {
      if (property === 'post' || property === 'put' || property === 'patch' || property === 'delete') {
        return () => {
          throw new EnvironmentGuardError(
            `request.${String(property)}() is not allowed in a prod-safe test.`
          );
        };
      }

      if (property === 'fetch') {
        return (urlOrRequest: Parameters<APIRequestContext['fetch']>[0], options?: Parameters<APIRequestContext['fetch']>[1]) => {
          const method = (options?.method ?? 'GET').toUpperCase();
          if (typeof urlOrRequest !== 'string' || !SAFE_METHODS.has(method)) {
            throw new EnvironmentGuardError(
              `request.fetch() with method ${method} is not allowed in a prod-safe test.`
            );
          }
          return target.fetch(urlOrRequest, options);
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

type ProdSafeFixtures = {
  prodSafeGuard: void;
};

export const test = base.extend<ProdSafeFixtures>({

  request: async ({ request }, use) => {
    await use(readOnlyRequest(request));
  },

  prodSafeGuard: [
    async ({ context, baseURL }, use, testInfo) => {

      // ---------- Verify allowlist ----------

      assertProdSafeTest({
        file: toRepoRelative(REPO_ROOT, testInfo.file),
        title: testInfo.title,
        tags: testInfo.tags,
      });

      // ---------- Verify target ----------

      const target = resolveTarget(process.env);

      if (target.testEnv === 'production') {
        const verified = readVerifiedTarget(process.env);

        if (
          !verified ||
          verified.testEnv !== 'production' ||
          verified.serverEnv !== 'production' ||
          verified.origin !== target.origin ||
          !baseURL ||
          new URL(baseURL).origin !== target.origin
        ) {
          throw new EnvironmentGuardError(
            `Production target was not verified by tests/global-setup.ts for ${target.origin}.`
          );
        }
      }

      // ---------- Block writes ----------

      const appOrigin = target.origin;
      const blockedAppWrites: string[] = [];

      await context.route('**/*', async route => {
        const request = route.request();
        const method = request.method().toUpperCase();

        if (SAFE_METHODS.has(method)) {
          await route.fallback();
          return;
        }

        let requestOrigin = '';
        try {
          requestOrigin = new URL(request.url()).origin;
        } catch {
          // Non-URL (e.g. data:) - treat as foreign.
        }

        if (requestOrigin === appOrigin) {
          blockedAppWrites.push(`${method} ${request.url()}`);
        }

        await route.abort('blockedbyclient');
      });

      await use();

      // ---------- Final verification ----------

      expect(
        blockedAppWrites,
        'A prod-safe test tried to send a write request to the app - it was blocked.'
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
