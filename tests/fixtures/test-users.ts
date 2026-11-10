
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

  Legacy local accounts (TEST_<ROLE>_EMAIL / TEST_<ROLE>_PASSWORD /
  TEST_<ROLE>_SLUG for player, coach, admin) are used ONLY when all of
  these hold:
    - TEST_ENV=local,
    - E2E_LEGACY_LOCAL_ACCOUNTS=1 (an explicit opt-in),
    - both TEST_<ROLE>_EMAIL and TEST_<ROLE>_PASSWORD are set.
  Opted in with only half a pair is an error, never a mix of a legacy
  email with an E2E password (or an empty one).

  Why (ORG-AUTH-001, 30 Oct 2026): TEST_ENV defaults to "local" and a
  local run reads .env. A developer .env that still had TEST_ADMIN_EMAIL
  silently replaced e2e-admin with the retired shared admin - which
  doesn't exist on the Staging database local runs use (or had no
  TEST_ADMIN_PASSWORD) - so becomeOrganiser() -> grantOrganizerAccess()
  -> login() typed the wrong credentials, got HTTP 401 and stayed on /auth.
  Without the opt-in those variables are now ignored, and the run log
  says so (key names only - ignoredLegacyCredentialKeys()).
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

export const LEGACY_LOCAL_OPT_IN = "E2E_LEGACY_LOCAL_ACCOUNTS";

type Env = Record<string, string | undefined>;

const isSet = (value: string | undefined) => value !== undefined && value.trim() !== "";

export class TestUserConfigError extends Error {
  constructor(message: string) {
    super(`[test-users] ${message}`);
    this.name = "TestUserConfigError";
  }
}

/** Legacy TEST_* variables present in `env` (names only, for the run log). */
export function legacyCredentialKeysPresent(env: Env = process.env): string[] {
  const keys: string[] = [];
  for (const legacy of Object.values(LEGACY_LOCAL_ENV)) {
    for (const suffix of ["EMAIL", "PASSWORD", "SLUG"]) {
      const key = `TEST_${legacy}_${suffix}`;
      if (isSet(env[key])) keys.push(key);
    }
  }
  return keys;
}

/** Legacy variables that are set but NOT used for this run (empty when they are used or absent). */
export function ignoredLegacyCredentialKeys(env: Env = process.env): string[] {
  const testEnv = (env.TEST_ENV ?? "local").trim().toLowerCase();
  const optedIn = testEnv === "local" && env[LEGACY_LOCAL_OPT_IN] === "1";
  return optedIn ? [] : legacyCredentialKeysPresent(env);
}

export interface ResolvedTestUser {
  email: string;
  password: string;
  slug: string;
  source: "baseline" | "legacy-local";
}

/**
 * Which account a TEST_USERS entry means for this run. Pure - unit-tested
 * in tests/safety/e2e-auth.unit.ts.
 */
export function resolveTestUser(key: TestUserKey, env: Env = process.env): ResolvedTestUser {
  const identity = baselineIdentity(ROLE[key]);
  const baseline: ResolvedTestUser = {
    email: identity.email,
    password: env[identity.passwordEnv] ?? "",
    slug: identity.slug,
    source: "baseline",
  };
  const legacy = LEGACY_LOCAL_ENV[key];
  const testEnv = (env.TEST_ENV ?? "local").trim().toLowerCase();
  if (!legacy || testEnv !== "local" || env[LEGACY_LOCAL_OPT_IN] !== "1") return baseline;

  const email = env[`TEST_${legacy}_EMAIL`];
  const password = env[`TEST_${legacy}_PASSWORD`];
  if (!isSet(email) && !isSet(password)) return baseline; // this role isn't overridden
  if (!isSet(email) || !isSet(password)) {
    throw new TestUserConfigError(
      `${LEGACY_LOCAL_OPT_IN}=1 needs both TEST_${legacy}_EMAIL and TEST_${legacy}_PASSWORD (one is missing). ` +
        `Set both, or unset both to use ${identity.email}.`,
    );
  }
  return {
    email: email!.trim(),
    password: password!,
    slug: isSet(env[`TEST_${legacy}_SLUG`]) ? env[`TEST_${legacy}_SLUG`]!.trim() : identity.slug,
    source: "legacy-local",
  };
}

export interface TestUser {
  readonly role: BaselineRole;
  readonly email: string;
  readonly password: string;
  readonly slug: string;
}

// Getters: read the environment when used (Playwright loads it after imports).
function testUser(key: TestUserKey): TestUser {
  return {
    role: baselineIdentity(ROLE[key]).role,
    get email() {
      return resolveTestUser(key).email;
    },
    get password() {
      return resolveTestUser(key).password;
    },
    get slug() {
      return resolveTestUser(key).slug;
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
