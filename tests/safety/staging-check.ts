/*
  RAILWAY STAGING READINESS CHECK   (npm run e2e:staging:check)

  One command that tells a developer whether Railway Staging is ready for
  E2E tests - and, if not, exactly which step failed and what to do. It
  composes the existing guards; it does not replace or weaken any of them:

    1. Configuration  .env.e2e.staging.local (staging-local-env.ts) +
                      resolveTarget() (environment-guard.ts) + the approved
                      Staging origin + secret / SHA format. No network.
    2. Reachability   GET /api/health (readHealth, deployed-commit.ts)
                      must answer and report dbEnv=staging.
    3. Deployment     the reported commit equals EXPECTED_DEPLOY_SHA
                      (assertDeployedCommit).
    4. Hook access    POST /api/test-hooks/preflight with the secret
                      (postTestHook, helpers/test-hooks.ts): tells apart
                      401 (wrong secret), 404 (hooks disabled / not
                      Staging), timeouts and network errors.
    5. Preflight      the server's report passes preflightProblems()
                      (preflight.ts): email captured, Stripe not live, ...

  Every request has its own timeout and the whole check has an overall
  deadline, so it never hangs. Fails closed: the first failing step stops
  the check. Secret values never appear in the output (length and a short
  SHA-256 fingerprint only, and every output line is redacted).

  Used by tests/safety/staging-check-cli.ts and, before any phase starts,
  by tests/safety/run-staging-phase.ts.
*/

import { createHash } from 'node:crypto';
import { STAGING_SITE } from '../../server/lib/appUrl';
import { EXPECTED_DEPLOY_SHA_ENV, assertDeployedCommit, normaliseExpectedSha, readHealth } from './deployed-commit';
import { HEALTH_PATH, isProductionHost, resolveTarget, type FetchLike } from './environment-guard';
import { isPreflightReport, preflightProblems, type PreflightReport } from './preflight';
import { STAGING_EXAMPLE_ENV_FILE, STAGING_LOCAL_ENV_FILE, STAGING_TEST_ACCOUNT_PASSWORD_KEYS, loadStagingLocalEnv, type StagingLocalEnvResult } from './staging-local-env';
import { TEST_HOOK_SECRET_ENV, TestHookError, postTestHook, type HookFetch } from '../helpers/test-hooks';

/** The only origin the Staging E2E tooling may target (same constant the server uses for Staging email links). */
export const APPROVED_STAGING_ORIGIN = STAGING_SITE;

/** The server refuses test-hook secrets shorter than this (server/lib/testHookSecurity.ts). */
export const MIN_SECRET_LENGTH = 32;

export const CHECK_TIMEOUT_ENV = 'E2E_STAGING_CHECK_TIMEOUT_MS';
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export type CheckStepId = 'config' | 'reach' | 'deploy' | 'hooks' | 'preflight';

export const CHECK_STEPS: readonly { id: CheckStepId; title: string }[] = [
  { id: 'config', title: 'Local configuration' },
  { id: 'reach', title: 'Staging reachable (dbEnv=staging)' },
  { id: 'deploy', title: 'Deployed commit' },
  { id: 'hooks', title: 'Test-hook authentication' },
  { id: 'preflight', title: 'Preflight rules' },
];

export type FailureKind =
  | 'config'
  | 'unsafe-target'
  | 'timeout'
  | 'network'
  | 'http-401'
  | 'http-404'
  | 'http-status'
  | 'not-staging'
  | 'deploy-unknown'
  | 'deploy-mismatch'
  | 'bad-response'
  | 'preflight-rules'
  | 'deadline';

export class StagingCheckFailure extends Error {
  constructor(readonly step: CheckStepId, readonly kind: FailureKind, message: string, readonly advice: string[] = []) {
    super(message);
    this.name = 'StagingCheckFailure';
  }
}

/** One fetch able to serve both readHealth (GET) and postTestHook (POST). */
export type CheckFetch = (input: string, init?: any) => ReturnType<FetchLike>;

export interface StagingCheckOptions {
  env: Record<string, string | undefined>;
  rootDir: string;
  /** Already-loaded local file (the phase runner loads it first). Otherwise loaded here. */
  localEnv?: StagingLocalEnvResult;
  readFile?: (file: string) => string | undefined;
  fetchImpl?: CheckFetch;
  /** Per-request timeout; default E2E_STAGING_CHECK_TIMEOUT_MS or 10 s. */
  requestTimeoutMs?: number;
  /** Deadline for the whole check; default 4 x request timeout + 5 s. */
  totalTimeoutMs?: number;
  log?: (line: string) => void;
}

export interface StagingCheckResult {
  ok: boolean;
  origin?: string;
  report?: PreflightReport;
  failure?: StagingCheckFailure;
  /** Every line written to log, already redacted. */
  lines: string[];
}

// ---------- pure helpers (unit-tested) ----------

/** sha256 prefix - lets you compare two copies of the secret without revealing it. */
export function secretFingerprint(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex').slice(0, 8);
}

/** Problems with the secret's FORMAT. Never includes the value itself. */
export function secretProblems(raw: string | undefined): string[] {
  if (raw === undefined || raw === '') {
    return [`${TEST_HOOK_SECRET_ENV} is not set - add it to ${STAGING_LOCAL_ENV_FILE} (copy the value from the Railway Staging service variables)`];
  }
  const problems: string[] = [];
  if (raw !== raw.trim()) problems.push(`${TEST_HOOK_SECRET_ENV} has leading or trailing whitespace - remove it`);
  const value = raw.trim();
  if (/^(["'`]).*\1$/.test(value) || /^["'`]|["'`]$/.test(value)) {
    problems.push(`${TEST_HOOK_SECRET_ENV} starts or ends with a quote character - the quotes would be sent as part of the secret; remove them`);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) problems.push(`${TEST_HOOK_SECRET_ENV} contains a line break or control character - paste it again as one line`);
  if (/replace|placeholder|your[-_ ]?secret|changeme|<[^>]*>|^x+$/i.test(value)) {
    problems.push(`${TEST_HOOK_SECRET_ENV} still holds the placeholder from ${STAGING_EXAMPLE_ENV_FILE} - put the real Staging value in`);
  }
  if (value.length < MIN_SECRET_LENGTH) {
    problems.push(`${TEST_HOOK_SECRET_ENV} is ${value.length} characters; the server's secret is at least ${MIN_SECRET_LENGTH} - it was probably cut off when copying`);
  }
  return problems;
}

/** Error text without the Playwright guard's banner formatting. */
export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim().replace(/^\[e2e-guard\] Refusing to run:\s*/, '');
}

/** Replaces any occurrence of the given secrets (and their trimmed forms) with [redacted]. */
export function redact(text: string, secrets: readonly (string | undefined)[]): string {
  let out = text;
  for (const secret of secrets) {
    for (const form of [secret, secret?.trim()]) {
      if (form && form.length >= 4) out = out.split(form).join('[redacted]');
    }
  }
  return out;
}

export function requestTimeoutFrom(env: Record<string, string | undefined>): number {
  const raw = env[CHECK_TIMEOUT_ENV];
  if (raw === undefined || raw === '') return DEFAULT_REQUEST_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1000 || value > 60_000) {
    throw new StagingCheckFailure('config', 'config', `${CHECK_TIMEOUT_ENV} must be a whole number of milliseconds between 1000 and 60000 (got "${raw}")`);
  }
  return value;
}

/**
 * Step 1 - everything that can be decided without the network. Collects
 * every problem at once so a developer can fix them in one go.
 */
/** What was loaded from where - printed before step 1's verdict, pass or fail. Names only, never values. */
export function configurationNotes(env: Record<string, string | undefined>, local: StagingLocalEnvResult): string[] {
  const notes: string[] = [];
  notes.push(
    local.found
      ? `${STAGING_LOCAL_ENV_FILE}: ${local.problems.length ? 'REFUSED' : `loaded ${local.loaded.length} value(s)`}` +
        (local.loaded.length ? ` (${local.loaded.join(', ')})` : '')
      : `${STAGING_LOCAL_ENV_FILE}: not found - using shell variables only`
  );
  for (const key of local.shellOverrides) {
    notes.push(`WARNING: ${key} is set in this shell AND differs from ${STAGING_LOCAL_ENV_FILE} - the shell value is used. ` +
      `If that is stale, clear it (PowerShell: Remove-Item Env:${key}; bash: unset ${key}).`);
  }
  const secret = env[TEST_HOOK_SECRET_ENV];
  if (secret && secretProblems(secret).length === 0) {
    const source = local.loaded.includes(TEST_HOOK_SECRET_ENV) ? STAGING_LOCAL_ENV_FILE : 'shell';
    notes.push(`${TEST_HOOK_SECRET_ENV}: set from ${source}, ${secret.length} characters, sha256 ${secretFingerprint(secret)}... (value hidden)`);
  }
  return notes;
}

export function checkConfiguration(env: Record<string, string | undefined>, local: StagingLocalEnvResult): { origin: string; expectedSha: string } {
  const problems: string[] = [...local.problems];
  const unsafe: string[] = [];

  // Production configuration in this shell is refused outright.
  if ((env.DB_ENV ?? '').trim().toLowerCase() === 'production') {
    unsafe.push('DB_ENV=production is set in this shell - refusing to run Staging E2E tooling next to Production database configuration');
  }
  if ((env.NODE_ENV ?? '').trim().toLowerCase() === 'production' && env.CI !== 'true') {
    unsafe.push('NODE_ENV=production is set in this shell - open a clean terminal for E2E tooling');
  }

  if ((env.TEST_ENV ?? '').trim().toLowerCase() !== 'staging') {
    problems.push(`TEST_ENV must be "staging" (got "${env.TEST_ENV ?? ''}")`);
  }

  let origin = '';
  const baseUrl = env.BASE_URL?.trim();
  if (!baseUrl) {
    problems.push(`BASE_URL is not set - add BASE_URL=${APPROVED_STAGING_ORIGIN} to ${STAGING_LOCAL_ENV_FILE}`);
  } else {
    let hostname = '';
    try {
      hostname = new URL(baseUrl).hostname;
    } catch {
      /* resolveTarget reports it */
    }
    if (hostname && isProductionHost(hostname)) {
      unsafe.push(`BASE_URL (${baseUrl}) is a PRODUCTION host - E2E Staging tooling never targets Production`);
    } else {
      try {
        origin = resolveTarget({ ...env, TEST_ENV: 'staging' }).origin;
        const url = new URL(baseUrl);
        if (origin !== APPROVED_STAGING_ORIGIN || (url.pathname !== '/' && url.pathname !== '')) {
          unsafe.push(`BASE_URL (${baseUrl}) is not the approved Railway Staging URL - only ${APPROVED_STAGING_ORIGIN} is allowed`);
          origin = '';
        }
      } catch (error) {
        unsafe.push(errorText(error));
      }
    }
  }

  problems.push(...secretProblems(env[TEST_HOOK_SECRET_ENV]));

  let expectedSha = '';
  const rawSha = env[EXPECTED_DEPLOY_SHA_ENV];
  if (!rawSha?.trim()) {
    problems.push(`${EXPECTED_DEPLOY_SHA_ENV} is not set - the full 40-character commit Staging should run ` +
      `(e.g. "git fetch origin && git rev-parse origin/main"; Railway Staging deploys main)`);
  } else {
    try {
      expectedSha = normaliseExpectedSha(rawSha);
    } catch (error) {
      problems.push(errorText(error));
    }
  }

  if (unsafe.length > 0) {
    throw new StagingCheckFailure('config', 'unsafe-target', `Refused - unsafe target:\n  - ${[...unsafe, ...problems].join('\n  - ')}`, [
      `Set BASE_URL=${APPROVED_STAGING_ORIGIN} and nothing else. Production is never a target for this tooling.`,
    ]);
  }
  if (problems.length > 0) {
    throw new StagingCheckFailure('config', 'config', `Configuration is incomplete or invalid:\n  - ${problems.join('\n  - ')}`, [
      local.found
        ? `Fix the values in ${STAGING_LOCAL_ENV_FILE} (or the shell variables named above), then re-run.`
        : `Create ${STAGING_LOCAL_ENV_FILE} from ${STAGING_EXAMPLE_ENV_FILE} (one-time setup, see tests/README.md).`,
    ]);
  }
  return { origin, expectedSha };
}

function classifyHealthError(error: unknown): StagingCheckFailure {
  const message = errorText(error);
  if (/timed out/.test(message)) {
    return new StagingCheckFailure('reach', 'timeout', message, [
      'Railway Staging did not answer in time - it may be restarting or asleep. Check the deployment in Railway, then re-run.',
      `Slow network? Raise ${CHECK_TIMEOUT_ENV} (max 60000).`,
    ]);
  }
  if (/could not reach/.test(message)) {
    return new StagingCheckFailure('reach', 'network', message, [
      'Check your internet connection / VPN / proxy, and that the Staging service is running in Railway.',
    ]);
  }
  if (/HTTP 404/.test(message)) {
    return new StagingCheckFailure('reach', 'http-404', message, [
      `${HEALTH_PATH} does not exist at this URL - check BASE_URL, and that the Staging service is deployed.`,
    ]);
  }
  if (/HTTP \d+/.test(message)) {
    return new StagingCheckFailure('reach', 'http-status', message, [
      'Staging is up but unhealthy (e.g. 502/503 while deploying or crashing). Check the Railway deploy logs, then re-run.',
    ]);
  }
  return new StagingCheckFailure('reach', 'bad-response', message, [
    'Something other than the TennisConnect server answered (redirect or non-JSON page). Check BASE_URL.',
  ]);
}

function classifyHookError(error: unknown, local: StagingLocalEnvResult): StagingCheckFailure {
  const message = errorText(error);
  if (error instanceof TestHookError) {
    if (error.status === 401) {
      return new StagingCheckFailure('hooks', 'http-401', 'HTTP 401 - the server rejected E2E_TEST_HOOK_SECRET (it does not match the value configured on Railway Staging).', [
        ...(local.shellOverrides.includes(TEST_HOOK_SECRET_ENV)
          ? [`A shell variable ${TEST_HOOK_SECRET_ENV} overrides ${STAGING_LOCAL_ENV_FILE} and is probably stale: PowerShell "Remove-Item Env:${TEST_HOOK_SECRET_ENV}", bash "unset ${TEST_HOOK_SECRET_ENV}".`]
          : []),
        `Copy ${TEST_HOOK_SECRET_ENV} again from the Railway Staging service (Variables) into ${STAGING_LOCAL_ENV_FILE}, without quotes.`,
        'Compare the sha256 fingerprint printed in step 1 with the one a teammate whose check passes sees.',
        'Do not change the value on Railway to make this pass - CI uses the same secret.',
      ]);
    }
    if (error.status === 404) {
      return new StagingCheckFailure('hooks', 'http-404', 'HTTP 404 - test hooks are disabled on this server.', [
        `Hooks only exist when the server runs with DB_ENV=staging AND has ${TEST_HOOK_SECRET_ENV} (at least ${MIN_SECRET_LENGTH} characters) configured. They are always disabled on Production.`,
        'Ask whoever manages Railway Staging to check those two variables; do not enable hooks anywhere else.',
      ]);
    }
    if (error.kind === 'timeout') {
      return new StagingCheckFailure('hooks', 'timeout', message, [
        `Staging answered /api/health but not the preflight hook in time. Re-run; if it persists, check the Railway logs. ${CHECK_TIMEOUT_ENV} raises the limit (max 60000).`,
      ]);
    }
    if (error.kind === 'network') {
      return new StagingCheckFailure('hooks', 'network', message, ['Network error calling the hook - check your connection and re-run.']);
    }
    if (error.kind === 'response') {
      return new StagingCheckFailure('hooks', 'bad-response', message, ['The server answered with something that is not the preflight report. Is Staging on a current build?']);
    }
    if (error.kind === 'config') {
      return new StagingCheckFailure('hooks', 'config', message);
    }
    return new StagingCheckFailure('hooks', 'http-status', message, ['Unexpected status from the preflight hook - check the Railway logs.']);
  }
  return new StagingCheckFailure('hooks', 'network', message);
}

// ---------- the check ----------

export async function runStagingCheck(options: StagingCheckOptions): Promise<StagingCheckResult> {
  const env = options.env;
  const lines: string[] = [];
  // Captured before anything else so output stays redacted even if env changes.
  const secrets = () => [env[TEST_HOOK_SECRET_ENV], ...STAGING_TEST_ACCOUNT_PASSWORD_KEYS.map(key => env[key])];
  const log = (line: string) => {
    const safe = redact(line, secrets());
    lines.push(safe);
    options.log?.(safe);
  };
  const fetchImpl: CheckFetch = options.fetchImpl ?? ((input, init) => fetch(input, init) as unknown as ReturnType<FetchLike>);

  let current: CheckStepId = 'config';
  const stepLabel = (id: CheckStepId) => {
    const index = CHECK_STEPS.findIndex(step => step.id === id);
    return `${index + 1}/${CHECK_STEPS.length} ${CHECK_STEPS[index].title}`;
  };
  const passed = (id: CheckStepId, detail: string, started: number) =>
    log(`[staging-check] ${stepLabel(id)}: OK - ${detail} (${Date.now() - started} ms)`);

  let deadlineTimer: NodeJS.Timeout | undefined;
  try {
    const local = options.localEnv ?? loadStagingLocalEnv(env, { rootDir: options.rootDir, readFile: options.readFile });
    const requestTimeoutMs = options.requestTimeoutMs ?? requestTimeoutFrom(env);
    const totalTimeoutMs = options.totalTimeoutMs ?? requestTimeoutMs * 4 + 5000;

    const deadline = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(
        () => reject(new StagingCheckFailure(current, 'deadline', `the check did not finish within ${totalTimeoutMs} ms (stuck in "${stepLabel(current)}")`, [
          'A request did not complete in time. Re-run; if it persists, check the Railway Staging service.',
        ])),
        totalTimeoutMs
      );
      deadlineTimer.unref?.();
    });

    const steps = async (): Promise<StagingCheckResult> => {
      // 1. Configuration (no network).
      let started = Date.now();
      for (const note of configurationNotes(env, local)) log(`[staging-check]   ${note}`);
      const config = checkConfiguration(env, local);
      passed('config', `target ${config.origin}, expecting commit ${config.expectedSha.slice(0, 12)}`, started);

      // 2. Reachable, and the server says it is Staging.
      current = 'reach';
      started = Date.now();
      let health;
      try {
        health = await readHealth(config.origin, fetchImpl as FetchLike, requestTimeoutMs);
      } catch (error) {
        throw classifyHealthError(error);
      }
      if (health.dbEnv !== 'staging') {
        throw new StagingCheckFailure('reach', 'not-staging',
          `${config.origin} reports dbEnv="${health.dbEnv || 'missing'}", expected "staging"` +
          (health.dbEnv === 'production' ? ' - this is PRODUCTION; nothing will run against it' : ''),
          ['The Railway Staging service must have DB_ENV=staging. Do not run any tests until it does.']);
      }
      passed('reach', `${HEALTH_PATH} answered, dbEnv=staging`, started);

      // 3. The deployment is the expected commit.
      current = 'deploy';
      started = Date.now();
      try {
        assertDeployedCommit(health, config.expectedSha, config.origin);
      } catch (error) {
        const message = errorText(error);
        if (!health.commit) {
          throw new StagingCheckFailure('deploy', 'deploy-unknown', message, [
            'Redeploy Staging from GitHub (main) so Railway sets RAILWAY_GIT_COMMIT_SHA; a manual/CLI deploy cannot be verified.',
          ]);
        }
        throw new StagingCheckFailure('deploy', 'deploy-mismatch', `deployment mismatch - ${message}`, [
          'If Railway is still deploying, wait and re-run (npm run e2e:verify-staging-deploy waits up to 10 minutes).',
          `If ${EXPECTED_DEPLOY_SHA_ENV} is out of date: "git fetch origin && git rev-parse origin/main" gives the commit Staging should run. ` +
            `Only set ${EXPECTED_DEPLOY_SHA_ENV}=${health.commit} after confirming that is the code you mean to test.`,
        ]);
      }
      passed('deploy', `Staging runs ${health.commit}`, started);

      // 4. Test hooks accept the secret.
      current = 'hooks';
      started = Date.now();
      let report: unknown;
      try {
        report = await postTestHook<unknown>('preflight', {}, { ...env, TEST_ENV: 'staging' }, {
          timeoutMs: requestTimeoutMs,
          fetchImpl: fetchImpl as unknown as HookFetch,
        });
      } catch (error) {
        throw classifyHookError(error, local);
      }
      if (!isPreflightReport(report)) {
        throw new StagingCheckFailure('hooks', 'bad-response', 'the preflight hook answered, but not with a preflight report', [
          'Staging may be running an older build - check the deployed commit.',
        ]);
      }
      passed('hooks', 'secret accepted by POST /api/test-hooks/preflight', started);

      // 5. Preflight rules (existing, unchanged).
      current = 'preflight';
      started = Date.now();
      const problems = preflightProblems(report, {
        expectedSha: config.expectedSha,
        requirePayments: env.E2E_REQUIRE_PAYMENTS === '1',
        uploads: env.E2E_REQUIRE_UPLOADS === '1'
          ? { stagingHost: env.STAGING_SUPABASE_HOST, productionHost: env.PRODUCTION_SUPABASE_HOST }
          : undefined,
      });
      if (problems.length > 0) {
        throw new StagingCheckFailure('preflight', 'preflight-rules', `Staging is not safe for E2E tests:\n  - ${problems.join('\n  - ')}`, [
          'These are server settings on Railway Staging; tests stay blocked until they are fixed.',
        ]);
      }
      passed('preflight', `email=${report.emailTransport}, stripe=${report.stripeMode}` +
        (report.storageHost ? `, storage=${report.storageHost}` : ''), started);

      return { ok: true, origin: config.origin, report, lines };
    };

    return await Promise.race([steps(), deadline]);
  } catch (error) {
    const failure = error instanceof StagingCheckFailure
      ? error
      : new StagingCheckFailure(current, 'config', errorText(error));
    log(`[staging-check] ${stepLabel(failure.step)}: FAILED (${failure.kind})`);
    for (const line of failure.message.split('\n')) log(`  ${line}`);
    if (failure.advice.length) {
      log('  What to do:');
      for (const advice of failure.advice) log(`    - ${advice}`);
    }
    return { ok: false, failure, lines };
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }
}
