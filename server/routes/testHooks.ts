// TEST-ONLY. Lets Playwright drive the real /verify-email flow without
// a real inbox to read the link from, by issuing a genuine verification
// token server-side and handing the raw value back in the response -
// something no other endpoint does (see
// server/services/emailVerification.ts: only a hash is ever stored,
// and /api/auth/register and /api/auth/resend-verification only ever
// email the raw token, never return it).
//
// STRICTLY UNAVAILABLE IN PRODUCTION, AND AUTHENTICATED EVERYWHERE ELSE.
// Every request under /api/test-hooks passes through testHookGuard()
// first (server/lib/testHookSecurity.ts has the full rules):
//
// - Environment: allowed only when NODE_ENV=development or
//   DB_ENV=staging, and DB_ENV=production is rejected outright whatever
//   NODE_ENV says - staging and prod both run `npm start`
//   (NODE_ENV=production), so only DB_ENV (server/env.ts) tells them
//   apart. Checked on every request, not just at mount time.
// - Secret: the X-E2E-Test-Secret header must match the server's
//   E2E_TEST_HOOK_SECRET (timing-safe). No secret configured on the
//   server = hooks disabled. There is no local-development bypass.
// - Test data only: tokens are issued only for isTestUser accounts, and
//   seed-session only accepts test users and Organiser Hub data they own.
//
// Disabled hooks answer 404 (they shouldn't even reveal they exist);
// enabled hooks answer 401 to a missing/wrong secret. Secret values are
// never logged or returned.
//
// The routes themselves live in server/routes/testHooksRouter.ts; this
// file only wires in the real storage, token issuer and configuration.
import { storage } from "../storage";
import { issueVerificationToken } from "../services/emailVerification";
import { hashPassword } from "../auth";
import { env } from "../env";
import { TEST_HOOK_SECRET_ENV } from "../lib/testHookSecurity";
import { buildHealthPayload } from "../lib/health";
import { stripeKeyMode } from "../lib/stripeMode";
import { capturedEmails, resolveEmailTransport } from "../services/emailCapture";
import { createTestHooksRouter } from "./testHooksRouter";

export default createTestHooksRouter({
  storage,
  issueVerificationToken,
  hashPassword,
  getConfig: () => ({
    nodeEnv: process.env.NODE_ENV,
    dbEnv: env.DB_ENV,
    secret: process.env[TEST_HOOK_SECRET_ENV],
  }),
  capturedEmails,
  getPreflight: () => ({
    dbEnv: env.DB_ENV,
    commit:
      buildHealthPayload({ dbEnv: env.DB_ENV, railwayGitCommitSha: process.env.RAILWAY_GIT_COMMIT_SHA })
        .commit ?? null,
    emailTransport: resolveEmailTransport({
      dbEnv: process.env.DB_ENV,
      configured: process.env.EMAIL_TRANSPORT,
    }),
    stripeMode: stripeKeyMode(process.env.STRIPE_SECRET_KEY),
    stripeWebhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
  }),
});
