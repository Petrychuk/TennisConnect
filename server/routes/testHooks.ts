// TEST-ONLY. Lets Playwright drive the real /verify-email flow without
// a real inbox to read the link from, by issuing a genuine verification
// token server-side and handing the raw value back in the response -
// something no other endpoint does (see
// server/services/emailVerification.ts: only a hash is ever stored,
// and /api/auth/register and /api/auth/resend-verification only ever
// email the raw token, never return it).
//
// STRICTLY UNAVAILABLE IN PRODUCTION. testHooksAllowed() is checked on
// every request, not just at mount time, and fails closed: it does not
// simply check `NODE_ENV !== "production"`, because the staging server
// these E2E tests actually run against (tests/global-setup.ts, which
// refuses to run the full suite against prod) is started with
// `npm start`, i.e. NODE_ENV=production, same as real prod - only
// DB_ENV (server/env.ts; set explicitly per-environment, never derived
// from NODE_ENV for exactly this reason) tells them apart. Local dev
// (`npm run dev`) is covered by the NODE_ENV check on its own since
// DB_ENV is typically unset there.
import { Router } from "express";
import { storage } from "../storage";
import { issueVerificationToken } from "../services/emailVerification";
import { env } from "../env";

const router = Router();

function testHooksAllowed(): boolean {
  return process.env.NODE_ENV === "development" || env.DB_ENV === "staging";
}

router.post("/issue-verification-token", async (req, res, next) => {
  // 404, not 403 - this route shouldn't even reveal that it exists on
  // a real production server.
  if (!testHooksAllowed()) {
    return res.status(404).json({ message: "Not found" });
  }

  try {
    const { email, expired } = req.body || {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // A negative TTL produces an expires_at already in the past -
    // exactly what EXP-series tests (expired token) need to hit
    // verifyEmailToken()'s "expired" branch on demand, without an
    // actual 24-hour wait.
    const { token, expiresAt } = await issueVerificationToken(user.id, {
      ttlMs: expired === true ? -1000 : undefined,
    });

    res.json({ token, expiresAt });
  } catch (error) {
    next(error);
  }
});

export default router;
