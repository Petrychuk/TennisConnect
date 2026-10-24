// npm run test:e2e:guard
//
// Full-regression preflight rules (tests/safety/preflight.ts) and the
// captured-email client (tests/helpers/test-hooks.ts). The client runs
// against a throwaway HTTP server on loopback (TEST_ENV=local) - never a
// real environment.

import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { EnvironmentGuardError } from './environment-guard';
import { assertPreflight, isPreflightReport, preflightProblems, type PreflightReport } from './preflight';
import { TestHookError, getCapturedEmails, waitForCapturedEmail } from '../helpers/test-hooks';

const SHA = 'a'.repeat(40);
const SECRET = `pre-${'p'.repeat(40)}-${Math.random().toString(36).slice(2)}`;

const good = (): PreflightReport => ({
  dbEnv: 'staging',
  commit: SHA,
  emailTransport: 'capture',
  stripeMode: 'test',
  stripeWebhookConfigured: true,
});

describe('preflight rules', () => {
  it('a correctly configured Staging passes', () => {
    assert.deepEqual(preflightProblems(good(), { expectedSha: SHA, requirePayments: true }), []);
    assertPreflight(good(), { expectedSha: SHA.toUpperCase() });
  });

  it('wrong environment, missing or mismatched commit fail', () => {
    assert.match(preflightProblems({ ...good(), dbEnv: 'production' }, { expectedSha: SHA }).join(), /dbEnv is "production"/);
    assert.match(preflightProblems({ ...good(), commit: null }, { expectedSha: SHA }).join(), /does not report/);
    assert.match(preflightProblems({ ...good(), commit: 'b'.repeat(40) }, { expectedSha: SHA }).join(), /expected a{40}/);
  });

  it('email that would be delivered fails, whatever else is right', () => {
    assert.match(preflightProblems({ ...good(), emailTransport: 'resend' }, { expectedSha: SHA }).join(), /would be delivered/);
  });

  it('a live or unknown Stripe key always fails, even without payment tests', () => {
    assert.match(preflightProblems({ ...good(), stripeMode: 'live' }, { expectedSha: SHA }).join(), /LIVE/);
    assert.match(preflightProblems({ ...good(), stripeMode: 'unknown' }, { expectedSha: SHA }).join(), /recognised/);
  });

  it('unconfigured Stripe is fine unless payment tests are requested', () => {
    const report = { ...good(), stripeMode: 'unconfigured', stripeWebhookConfigured: false };
    assert.deepEqual(preflightProblems(report, { expectedSha: SHA }), []);
    const problems = preflightProblems(report, { expectedSha: SHA, requirePayments: true });
    assert.equal(problems.length, 2);
  });

  it('all problems are reported together, as a guard error', () => {
    assert.throws(
      () => assertPreflight({ ...good(), dbEnv: 'x', emailTransport: 'resend', stripeMode: 'live' }, { expectedSha: SHA }),
      (error: unknown) => error instanceof EnvironmentGuardError && /dbEnv[\s\S]*emailTransport[\s\S]*LIVE/.test(error.message)
    );
  });

  it('rejects malformed reports', () => {
    assert.equal(isPreflightReport(good()), true);
    assert.equal(isPreflightReport({ ...good(), stripeWebhookConfigured: 'yes' }), false);
    assert.equal(isPreflightReport(null), false);
  });
});

describe('captured-email client', () => {
  let server: http.Server;
  let origin = '';
  let calls = 0;
  let deliverAfter = 0;
  let lastBody: Record<string, unknown> = {};
  let lastSecret: string | undefined;

  before(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        calls++;
        lastBody = JSON.parse(body || '{}');
        lastSecret = req.headers['x-e2e-test-secret'] as string | undefined;
        const emails = calls > deliverAfter
          ? [{ id: '1', to: lastBody.to, subject: 'Confirm your email', text: 't', links: ['https://x/verify-email?token=abc'], capturedAt: 1 }]
          : [];
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ emails }));
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => new Promise<void>(resolve => server.close(() => resolve())));

  const env = () => ({ TEST_ENV: 'local', BASE_URL: origin, E2E_TEST_HOOK_SECRET: SECRET });

  it('queries the emails hook with the secret header and filters', async () => {
    calls = 0;
    deliverAfter = 0;
    const emails = await getCapturedEmails('p1@tennisconnect.test', { subjectContains: 'confirm', sinceMs: 5 }, env());
    assert.equal(emails[0].links[0], 'https://x/verify-email?token=abc');
    assert.deepEqual(lastBody, { to: 'p1@tennisconnect.test', subjectContains: 'confirm', sinceMs: 5 });
    assert.equal(lastSecret, SECRET);
  });

  it('waits until the email arrives', async () => {
    calls = 0;
    deliverAfter = 2;
    const email = await waitForCapturedEmail('p1@tennisconnect.test', {}, { env: env(), intervalMs: 10, timeoutMs: 2000 });
    assert.equal(email.id, '1');
    assert.equal(calls, 3);
  });

  it('gives up clearly after the timeout', async () => {
    calls = 0;
    deliverAfter = 1_000;
    await assert.rejects(
      waitForCapturedEmail('p1@tennisconnect.test', { subjectContains: 'reset' }, { env: env(), intervalMs: 10, timeoutMs: 50 }),
      (error: unknown) => error instanceof TestHookError && /No captured email .*"reset"/.test(error.message)
    );
  });
});
