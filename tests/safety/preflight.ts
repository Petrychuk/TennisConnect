/*
  FULL-REGRESSION PREFLIGHT (Staging)

  Checks the facts the running Staging server reports through the
  secret-protected POST /api/test-hooks/preflight hook, before any
  data-changing test runs. Fails closed: every problem is collected and
  the run is refused if there is at least one.

  Checked:
  - dbEnv is "staging";
  - the server reports a commit, and it is the expected one;
  - email is captured, never delivered (emailTransport = "capture");
  - Stripe is in test mode, never live; when payment tests are requested,
    a test key AND a webhook secret must be configured.

  A successful response also proves the test hooks are reachable only
  with the secret and are enabled on this (non-production) instance -
  the server returns 404 for hooks on Production, whatever the secret.

  Pure module - unit-tested in tests/safety/preflight.unit.ts.
*/

import { EnvironmentGuardError } from './environment-guard';

export interface PreflightReport {
  dbEnv: string;
  commit: string | null;
  emailTransport: string;
  stripeMode: string;
  stripeWebhookConfigured: boolean;
}

export interface PreflightOptions {
  expectedSha: string;
  /** Payment tests (Stripe Checkout) are part of this run. */
  requirePayments?: boolean;
}

export function preflightProblems(report: PreflightReport, options: PreflightOptions): string[] {
  const problems: string[] = [];

  if (report.dbEnv !== 'staging') {
    problems.push(`dbEnv is "${report.dbEnv}", expected "staging"`);
  }

  if (!report.commit) {
    problems.push('the server does not report a deployed commit');
  } else if (report.commit !== options.expectedSha.toLowerCase()) {
    problems.push(`the server runs commit ${report.commit}, expected ${options.expectedSha.toLowerCase()}`);
  }

  if (report.emailTransport !== 'capture') {
    problems.push(`emailTransport is "${report.emailTransport}" - emails would be delivered; expected "capture"`);
  }

  if (report.stripeMode === 'live') {
    problems.push('Stripe is configured with a LIVE key');
  } else if (report.stripeMode === 'unknown') {
    problems.push("Stripe key mode can't be recognised");
  }

  if (options.requirePayments) {
    if (report.stripeMode !== 'test') {
      problems.push(`payment tests need a Stripe TEST key (stripeMode is "${report.stripeMode}")`);
    }
    if (!report.stripeWebhookConfigured) {
      problems.push('payment tests need STRIPE_WEBHOOK_SECRET configured on Staging');
    }
  }

  return problems;
}

export function assertPreflight(report: PreflightReport, options: PreflightOptions) {
  const problems = preflightProblems(report, options);
  if (problems.length > 0) {
    throw new EnvironmentGuardError(`Staging preflight failed:\n  - ${problems.join('\n  - ')}`);
  }
}

export function isPreflightReport(value: unknown): value is PreflightReport {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.dbEnv === 'string' &&
    (r.commit === null || typeof r.commit === 'string') &&
    typeof r.emailTransport === 'string' &&
    typeof r.stripeMode === 'string' &&
    typeof r.stripeWebhookConfigured === 'boolean'
  );
}
