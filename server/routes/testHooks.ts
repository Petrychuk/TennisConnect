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
import { hashPassword } from "../auth";
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

// ---------------------------------------------------------------------
// Everything below exists purely so Organiser Hub E2E tests (Rankings/
// Reports especially) can prepare a KNOWN dataset directly, instead of
// re-running TC Live's whole real-time flow (check-in -> generate
// round -> enter score -> confirm -> complete session) inside every
// single test. Same testHooksAllowed() gate as issue-verification-token
// above - 404s outside development/staging, never reachable in
// production. These write directly to tables that real users never
// write to in this shape (e.g. a session created already "completed",
// or a match with no admin review ever having happened) - do not reuse
// this pattern anywhere outside tests.
// ---------------------------------------------------------------------

// Creates N real, usable player accounts in one call (verified,
// approved, profile-complete) - for tests that just need a roster of
// userIds to register/check-in/seed match results for, without paying
// for N full register+verify-email UI flows.
router.post("/seed-players", async (req, res, next) => {
  if (!testHooksAllowed()) {
    return res.status(404).json({ message: "Not found" });
  }
  try {
    const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 30);
    const password = "Test123456!";
    const hashed = await hashPassword(password);

    const players = [];
    for (let i = 0; i < count; i++) {
      const stamp = `${Date.now()}_${i}_${Math.floor(Math.random() * 1_000_000)}`;
      const user = await storage.createUser({
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
router.post("/seed-session", async (req, res, next) => {
  if (!testHooksAllowed()) {
    return res.status(404).json({ message: "Not found" });
  }
  try {
    const {
      organizationId,
      createdBy,
      title,
      startAt,
      status = "completed",
      seasonId,
      seriesId,
      type,
      maxParticipants,
      waitingListEnabled,
      registrations: registrationInput = [],
      matches: matchInput = [],
    } = req.body || {};

    if (!organizationId || !createdBy || !title || !startAt) {
      return res.status(400).json({ message: "organizationId, createdBy, title and startAt are required" });
    }

    const session = await storage.testSeedSession({
      organizationId,
      createdBy,
      title,
      startAt: new Date(startAt),
      status,
      seasonId: seasonId || undefined,
      seriesId: seriesId || undefined,
      type,
      maxParticipants: typeof maxParticipants === "number" ? maxParticipants : undefined,
      waitingListEnabled: typeof waitingListEnabled === "boolean" ? waitingListEnabled : undefined,
    });

    const registrationIds: string[] = [];
    for (const r of registrationInput as { userId: string; checkedIn?: boolean }[]) {
      const row = await storage.testSeedRegistration(session.id, r.userId, !!r.checkedIn);
      registrationIds.push(row.id);
    }

    const matchIds: string[] = [];
    if (Array.isArray(matchInput) && matchInput.length > 0) {
      const round = await storage.testSeedSessionRound(session.id, 1);
      for (const m of matchInput as { teamAIds: string[]; teamBIds: string[]; teamAGames: number; teamBGames: number }[]) {
        const row = await storage.testSeedMatch(session.id, round.id, m.teamAIds, m.teamBIds, m.teamAGames, m.teamBGames);
        matchIds.push(row.id);
      }
    }

    res.json({ ...session, registrationIds, matchIds });
  } catch (error) {
    next(error);
  }
});

export default router;
