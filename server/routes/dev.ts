// Backs the /dev/live-simulator page. Wraps server/seeds/liveSessionSeed.ts
// so a developer can seed/reset the TC Live fixture from the browser
// instead of a terminal, while running through the real organizer API for
// every actual game action (check-in, go-live, generate round, score,
// finish) - this router only ever does the seed/reset part.
//
// Mounted in server/routes.ts ONLY when NODE_ENV === "development" (see
// the import.meta.env.DEV guard on the page too) - still gated behind
// requireAuth here as well, so it's never a bare unauthenticated POST
// even in a dev environment with multiple logged-in accounts.

import { Router } from "express";
import { requireAuth } from "../requireAuth";
import { seedLiveFixture, resetLiveFixture } from "../seeds/liveSessionSeed";

const router = Router();

router.post("/live-simulator/seed", requireAuth, async (_req, res, next) => {
  try {
    const result = await seedLiveFixture();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/live-simulator/reset", requireAuth, async (_req, res, next) => {
  try {
    const result = await resetLiveFixture();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
