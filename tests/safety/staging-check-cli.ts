// npm run e2e:staging:check
//
// Prepares the local environment (.env.e2e.staging.local), then checks
// that Railway Staging is ready for E2E tests - configuration, reachability,
// deployed commit, test-hook secret and the preflight rules - and says what
// to do next. Read-only: it changes nothing on Staging and starts no tests.
// Exit 0 = ready, 1 = not ready (the failing step is named).
// See tests/safety/staging-check.ts and tests/README.md.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStagingCheck } from './staging-check';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function main() {
  const result = await runStagingCheck({ env: process.env, rootDir: ROOT, log: line => console.log(line) });
  if (!result.ok) {
    console.log('\n[staging-check] Staging is NOT ready - no tests were started.');
    process.exit(1);
  }
  console.log(
    `\n[staging-check] Staging is READY: ${result.origin} runs ${result.report?.commit}.\n` +
    '  Next (read-only, signed in as the permanent test accounts):\n' +
    '    npm run e2e:staging:auth-readonly\n' +
    '  Data-changing phases are never started automatically - they need an explicit\n' +
    '  per-run confirmation (see "Data-changing phases" in tests/README.md).'
  );
  process.exit(0);
}

main().catch(error => {
  // runStagingCheck reports its own failures; this is a last-resort guard (no secret in it).
  console.error(`[staging-check] unexpected error: ${error instanceof Error ? error.name : 'unknown'}`);
  process.exit(1);
});
