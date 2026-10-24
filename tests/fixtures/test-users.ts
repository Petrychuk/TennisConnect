
import { randomBytes } from "node:crypto";
import { requireRunOwnedEmail } from "./run-id";

export function generateTestUser(
  role: "player" | "coach" = "player"
) {
  const timestamp = Date.now();
  const suffix = randomBytes(4).toString("hex");

  return {
    role,
    name: `Test ${role} ${timestamp}`,
    // Run-owned address when the run has a token (see tests/fixtures/run-id.ts);
    // the legacy format otherwise. Both stay on the reserved test domain.
    email:
      requireRunOwnedEmail(`${role}-${timestamp.toString(36)}-${suffix}`) ??
      `test_${role}_${timestamp}_${suffix}@tennisconnect.test`,
    password: `Test${randomBytes(12).toString("hex")}!`,
    isTestUser: true,
  };
}

export const TEST_USERS = {
  player: {
    email: process.env.TEST_PLAYER_EMAIL ?? "",
    password: process.env.TEST_PLAYER_PASSWORD ?? "",
    slug: "player-playwright",
  },

  coach: {
    email: process.env.TEST_COACH_EMAIL ?? "",
    password: process.env.TEST_COACH_PASSWORD ?? "",
    slug: "coach-playwright",
  },

  admin: {
    email: process.env.TEST_ADMIN_EMAIL ?? "",
    password: process.env.TEST_ADMIN_PASSWORD ?? "",
    slug: "admin-playwright",
  },
};
