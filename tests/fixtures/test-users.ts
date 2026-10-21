
import { randomBytes } from "node:crypto";

export function generateTestUser(
  role: "player" | "coach" = "player"
) {
  const timestamp = Date.now();

  return {
    role,
    name: `Test ${role} ${timestamp}`,
    email: `test_${role}_${timestamp}_${randomBytes(4).toString("hex")}@tennisconnect.test`,
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
