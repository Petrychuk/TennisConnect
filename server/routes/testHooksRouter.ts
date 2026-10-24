// Router factory for /api/test-hooks/* - see server/routes/testHooks.ts
// for what these hooks are and the security model. Kept separate from
// testHooks.ts so it imports no storage/database code at runtime: the
// real dependencies are injected by testHooks.ts, and fakes by
// server/routes/testHooks.test.ts.
import { Router, type Request, type Response, type NextFunction } from "express";
import type { IStorage } from "../storage";
import type { CapturedEmailStore, EmailTransport } from "../services/emailCapture";
import type { StripeKeyMode } from "../lib/stripeMode";
import {
  TEST_HOOK_SECRET_ENV,
  TEST_HOOK_SECRET_HEADER,
  checkTestHookAccess,
  isReservedTestEmail,
  validateSeedSessionInput,
  type SeedLookups,
  type TestHookConfig,
} from "../lib/testHookSecurity";

export type HookStorage = Pick<
  IStorage,
  | "getUserByEmail"
  | "createUser"
  | "testSeedSession"
  | "testSeedRegistration"
  | "testSeedSessionRound"
  | "testSeedMatch"
> &
  SeedLookups;

export interface TestHooksDeps {
  storage: HookStorage;
  issueVerificationToken: (userId: string, options?: { ttlMs?: number }) => Promise<{ token: string; expiresAt: Date }>;
  hashPassword: (password: string) => Promise<string>;
  /** Read on every request, so a changed Railway variable is never cached stale. */
  getConfig: () => TestHookConfig;
  /** Captured (not sent) emails - server/services/emailCapture.ts. */
  capturedEmails: Pick<CapturedEmailStore, "query">;
  /** Environment facts for the regression preflight. Never secret values. */
  getPreflight: () => PreflightReport;
}

export interface PreflightReport {
  dbEnv: string;
  commit: string | null;
  emailTransport: EmailTransport;
  stripeMode: StripeKeyMode;
  stripeWebhookConfigured: boolean;
}

let warnedNotConfigured = false;

export function testHookGuard(getConfig: () => TestHookConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const access = checkTestHookAccess(getConfig(), req.get(TEST_HOOK_SECRET_HEADER));

    if (access.ok) return next();

    if (access.reason === "not-configured" && !warnedNotConfigured) {
      warnedNotConfigured = true;
      // Name only - never the value.
      console.warn(
        `[test-hooks] Disabled: ${TEST_HOOK_SECRET_ENV} is not set (or is too short) on this server.`
      );
    }

    if (access.status === 404) {
      return res.status(404).json({ message: "Not found" });
    }
    return res.status(401).json({ message: "Missing or invalid test-hook secret" });
  };
}

export function createTestHooksRouter(deps: TestHooksDeps) {
  const router = Router();

  router.use(testHookGuard(deps.getConfig));

  // Environment facts the full-regression workflow checks before running
  // anything (tests/safety/preflight.ts). Modes and booleans only - never
  // keys, secrets or URLs.
  router.post("/preflight", (_req, res) => {
    res.json(deps.getPreflight());
  });

  // Emails captured instead of sent (Staging). Only for recipients on the
  // reserved test domain: a captured email to anyone else (e.g. a real
  // user's password reset on Staging) is never returned, secret or not.
  router.post("/emails", (req, res) => {
    const { to, subjectContains, sinceMs, limit } = req.body || {};

    if (!isReservedTestEmail(to)) {
      return res.status(403).json({ message: "Captured emails can only be read for @tennisconnect.test recipients" });
    }
    if (subjectContains !== undefined && typeof subjectContains !== "string") {
      return res.status(400).json({ message: "subjectContains must be a string" });
    }
    if (sinceMs !== undefined && (typeof sinceMs !== "number" || !Number.isFinite(sinceMs))) {
      return res.status(400).json({ message: "sinceMs must be a number (epoch milliseconds)" });
    }

    const emails = deps.capturedEmails
      .query({
        to,
        subjectContains,
        sinceMs,
        limit: typeof limit === "number" ? limit : undefined,
      })
      .map(({ id, to: recipient, subject, text, links, capturedAt }) => ({
        id,
        to: recipient,
        subject,
        text,
        links,
        capturedAt,
      }));

    res.json({ emails });
  });

  router.post("/issue-verification-token", async (req, res, next) => {
    try {
      const { email, expired } = req.body || {};

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await deps.storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Ordinary accounts never get a token from here, secret or not -
      // otherwise anyone holding the secret could take over a real
      // staging account by "verifying" it.
      if (user.isTestUser !== true) {
        return res.status(403).json({ message: "Verification tokens can only be issued for test users" });
      }

      // A negative TTL produces an expires_at already in the past -
      // exactly what EXP-series tests (expired token) need to hit
      // verifyEmailToken()'s "expired" branch on demand, without an
      // actual 24-hour wait.
      const { token, expiresAt } = await deps.issueVerificationToken(user.id, {
        ttlMs: expired === true ? -1000 : undefined,
      });

      res.json({ token, expiresAt });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------
  // Everything below exists purely so Organiser Hub E2E tests (Rankings/
  // Reports especially) can prepare a KNOWN dataset directly, instead of
  // re-running TC Live's whole real-time flow (check-in -> generate
  // round -> enter score -> confirm -> complete session) inside every
  // single test. These write directly to tables that real users never
  // write to in this shape (e.g. a session created already "completed",
  // or a match with no admin review ever having happened) - do not reuse
  // this pattern anywhere outside tests.
  // -------------------------------------------------------------------

  // Creates N real, usable player accounts in one call (verified,
  // approved, profile-complete, isTestUser) - for tests that just need a
  // roster of userIds to register/check-in/seed match results for,
  // without paying for N full register+verify-email UI flows.
  router.post("/seed-players", async (req, res, next) => {
    try {
      const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 30);
      const password = "Test123456!";
      const hashed = await deps.hashPassword(password);

      const players = [];
      for (let i = 0; i < count; i++) {
        const stamp = `${Date.now()}_${i}_${Math.floor(Math.random() * 1_000_000)}`;
        const user = await deps.storage.createUser({
          name: `Seed Player ${stamp}`,
          email: `seed_player_${stamp}@tennisconnect.test`,
          password: hashed,
          role: "player",
          isTestUser: true,
          profileCompleted: true,
          isApproved: true,
          emailVerified: true,
        } as any);
        players.push({ id: user.id, name: user.name, email: user.email, slug: user.slug, password });
      }

      res.json({ players });
    } catch (error) {
      next(error);
    }
  });

  // Creates one Session in whatever status the test needs (typically
  // "completed"), optionally under a Season/Series, with registrations
  // (each optionally checked-in) and confirmed match results - the full
  // dataset a Rankings/Reports test needs to assert against, in one call.
  // Every referenced id is validated BEFORE anything is written: the
  // creator and all participants must be test users, the organization
  // must be owned by the creator, and season/series must belong to it.
  router.post("/seed-session", async (req, res, next) => {
    try {
      const validation = await validateSeedSessionInput(req.body, deps.storage);
      if (!validation.ok) {
        return res.status(validation.status).json({ message: validation.message });
      }
      const { plan } = validation;

      const session = await deps.storage.testSeedSession(plan.session);

      const registrationIds: string[] = [];
      for (const r of plan.registrations) {
        const row = await deps.storage.testSeedRegistration(session.id, r.userId, r.checkedIn);
        registrationIds.push(row.id);
      }

      const matchIds: string[] = [];
      if (plan.matches.length > 0) {
        const round = await deps.storage.testSeedSessionRound(session.id, 1);
        for (const m of plan.matches) {
          const row = await deps.storage.testSeedMatch(
            session.id,
            round.id,
            m.teamAIds,
            m.teamBIds,
            m.teamAGames,
            m.teamBGames
          );
          matchIds.push(row.id);
        }
      }

      res.json({ ...session, registrationIds, matchIds });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
