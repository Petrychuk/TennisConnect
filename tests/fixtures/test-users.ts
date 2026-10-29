
import { randomBytes } from "node:crypto";
import { requireRunOwnedEmail } from "./run-id";
import { baselineIdentity, type BaselineRole } from "../../server/seeds/e2e/identities";

/**
 * A unique address for an account a test creates: run-owned
 * (e2e-run-<runId>-<label>-...@tennisconnect.test) whenever the run has a
 * token - always on Staging, where a missing token is refused - so run
 * cleanup can remove it. The legacy format only outside Playwright locally.
 * Never use a hand-written address for a new account.
 */
export function uniqueTestEmail(label: string): string {
  const timestamp = Date.now();
  const suffix = randomBytes(4).toString("hex");
  const clean = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "user";
  return (
    requireRunOwnedEmail(`${clean}-${timestamp.toString(36)}-${suffix}`) ??
    `test_${clean.replace(/-/g, "_")}_${timestamp}_${suffix}@tennisconnect.test`
  );
}

export function generateTestUser(
  role: "player" | "coach" = "player"
) {
  const timestamp = Date.now();

  return {
    role,
    name: `Test ${role} ${timestamp}`,
    email: uniqueTestEmail(role),
    password: `Test${randomBytes(12).toString("hex")}!`,
    isTestUser: true,
  };
}

/*
  The permanent Stage 2 E2E accounts (server/seeds/e2e/identities.ts),
  created on Staging by the operator seed:

    player    e2e-player@tennisconnect.test      E2E_PLAYER_PASSWORD
    player2   e2e-player-2@tennisconnect.test    E2E_PLAYER_2_PASSWORD
    coach     e2e-coach@tennisconnect.test       E2E_COACH_PASSWORD
    organiser e2e-organiser@tennisconnect.test   E2E_ORGANISER_PASSWORD
    admin     e2e-admin@tennisconnect.test       E2E_ADMIN_PASSWORD

  Shared by every test - so tests may READ them, log in as them, and
  message them, but must never change their profile, photos or settings
  (use a run-owned account from registerPlayer()/registerCoach() for that).
  login() (tests/helpers/auth.ts) reuses one cached session per worker
  for these accounts instead of typing the password each time.

  Local only (TEST_ENV=local, there is no seed for a local database): the
  old TEST_<ROLE>_EMAIL / TEST_<ROLE>_PASSWORD variables may point at local
  accounts instead. They are ignored everywhere else, so Staging always
  uses the seeded accounts and never the retired shared ones.
*/

type TestUserKey = "player" | "player2" | "coach" | "organiser" | "admin";

const ROLE: Record<TestUserKey, BaselineRole> = {
  player: "player",
  player2: "player-2",
  coach: "coach",
  organiser: "organiser",
  admin: "admin",
};

const LEGACY_LOCAL_ENV: Partial<Record<TestUserKey, string>> = { player: "PLAYER", coach: "COACH", admin: "ADMIN" };

export interface TestUser {
  readonly role: BaselineRole;
  readonly email: string;
  readonly password: string;
  readonly slug: string;
}

function testUser(key: TestUserKey): TestUser {
  const identity = baselineIdentity(ROLE[key]);
  const legacy = LEGACY_LOCAL_ENV[key];
  const localOverride = () =>
    (process.env.TEST_ENV ?? "local").trim().toLowerCase() === "local" && legacy && process.env[`TEST_${legacy}_EMAIL`]
      ? legacy
      : undefined;
  return {
    role: identity.role,
    get email() {
      const override = localOverride();
      return override ? process.env[`TEST_${override}_EMAIL`]! : identity.email;
    },
    get password() {
      const override = localOverride();
      return (override ? process.env[`TEST_${override}_PASSWORD`] : process.env[identity.passwordEnv]) ?? "";
    },
    get slug() {
      return localOverride() ? process.env[`TEST_${legacy}_SLUG`] ?? identity.slug : identity.slug;
    },
  };
}

export const TEST_USERS: Readonly<Record<TestUserKey, TestUser>> = {
  player: testUser("player"),
  player2: testUser("player2"),
  coach: testUser("coach"),
  organiser: testUser("organiser"),
  admin: testUser("admin"),
};
