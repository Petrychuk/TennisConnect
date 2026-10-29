// E2E test identities on Staging - the single source of truth for which
// accounts and records belong to automated testing.
//
// Three disjoint kinds, all on the reserved RFC 2606 domain
// tennisconnect.test (mail there is undeliverable, so no real person can
// own one of these addresses):
//
//   baseline  e2e-<role>@tennisconnect.test         persistent role accounts
//             (player, player-2, coach, organiser, admin) - seeded, reused
//             across runs, credentials from environment variables.
//   fixture   e2e-fixture-<kind>-NN@tennisconnect.test   persistent directory
//             data (players/coaches for pagination, search, filtering) -
//             seeded, never logged into.
//   run       e2e-run-<runId>-<label>@tennisconnect.test   temporary records
//             created by ONE Playwright run; owned by that run and, in
//             Stage 3, removable only by that run's cleanup.
//
// Pure module: no database, network, email or Stripe imports. Used by the
// seed (server/seeds/e2e), the Playwright helpers (tests/) and, later,
// Stage 3 cleanup. Unit-tested in server/seeds/e2e/e2eSeed.test.ts.

import { randomBytes } from "node:crypto";

export const E2E_EMAIL_DOMAIN = "tennisconnect.test";

export type BaselineRole = "player" | "player-2" | "coach" | "organiser" | "admin";

export interface BaselineIdentity {
  role: BaselineRole;
  email: string;
  slug: string;
  name: string;
  /** users.role - the app only knows "player" | "coach". */
  userRole: "player" | "coach";
  isOrganizer: boolean;
  isAdmin: boolean;
  /** Environment variable holding this account's password (never in Git). */
  passwordEnv: string;
}

export const BASELINE_IDENTITIES: readonly BaselineIdentity[] = [
  { role: "player", email: "e2e-player@tennisconnect.test", slug: "e2e-player", name: "E2E Player Alex Morgan",
    userRole: "player", isOrganizer: false, isAdmin: false, passwordEnv: "E2E_PLAYER_PASSWORD" },
  { role: "player-2", email: "e2e-player-2@tennisconnect.test", slug: "e2e-player-2", name: "E2E Player Sam Riley",
    userRole: "player", isOrganizer: false, isAdmin: false, passwordEnv: "E2E_PLAYER_2_PASSWORD" },
  { role: "coach", email: "e2e-coach@tennisconnect.test", slug: "e2e-coach", name: "E2E Coach Jordan Ellis",
    userRole: "coach", isOrganizer: false, isAdmin: false, passwordEnv: "E2E_COACH_PASSWORD" },
  { role: "organiser", email: "e2e-organiser@tennisconnect.test", slug: "e2e-organiser", name: "E2E Organiser Casey Hart",
    userRole: "player", isOrganizer: true, isAdmin: false, passwordEnv: "E2E_ORGANISER_PASSWORD" },
  { role: "admin", email: "e2e-admin@tennisconnect.test", slug: "e2e-admin", name: "E2E Admin Taylor Quinn",
    userRole: "player", isOrganizer: false, isAdmin: true, passwordEnv: "E2E_ADMIN_PASSWORD" },
];

export function baselineIdentity(role: BaselineRole): BaselineIdentity {
  const identity = BASELINE_IDENTITIES.find(item => item.role === role);
  if (!identity) throw new Error(`Unknown E2E baseline role "${role}"`);
  return identity;
}

// ---------- Classification ----------

const BASELINE_EMAIL = /^e2e-(player|player-2|coach|organiser|admin)@tennisconnect\.test$/;
const FIXTURE_EMAIL = /^e2e-fixture-[a-z]+-\d{2}@tennisconnect\.test$/;
const RUN_EMAIL = /^e2e-run-(r[0-9a-z]{6,12}-[0-9a-f]{16})-[a-z0-9-]{1,60}@tennisconnect\.test$/;

export type IdentityKind = "baseline" | "fixture" | "run" | "other";

/** Exact, whole-address classification - never a loose prefix match. */
export function classifyEmail(email: unknown): { kind: IdentityKind; runId?: string } {
  if (typeof email !== "string") return { kind: "other" };
  const value = email.trim().toLowerCase();
  if (BASELINE_EMAIL.test(value)) return { kind: "baseline" };
  if (FIXTURE_EMAIL.test(value)) return { kind: "fixture" };
  const run = value.match(RUN_EMAIL);
  if (run) return { kind: "run", runId: run[1] };
  return { kind: "other" };
}

/** Persistent seeded identity (baseline or fixture) - what the seed may touch. */
export function isSeedOwnedEmail(email: unknown): boolean {
  const { kind } = classifyEmail(email);
  return kind === "baseline" || kind === "fixture";
}

// ---------- Run tokens (temporary, run-owned data) ----------

/**
 * `r<base36 time>-<16 hex random>` - unguessable, so one run can never
 * name (and in Stage 3, clean up) another run's records by accident.
 */
const RUN_ID = /^r[0-9a-z]{6,12}-[0-9a-f]{16}$/;

export function generateRunId(now: number = Date.now(), random: Buffer = randomBytes(8)): string {
  return `r${now.toString(36)}-${random.toString("hex")}`;
}

export function isValidRunId(value: unknown): value is string {
  return typeof value === "string" && RUN_ID.test(value);
}

/** e2e-run-<runId>-<label>@tennisconnect.test, label = [a-z0-9-]{1,60}. */
export function runScopedEmail(runId: string, label: string): string {
  if (!isValidRunId(runId)) throw new Error("runScopedEmail: invalid run id");
  const cleanLabel = label.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  if (!cleanLabel) throw new Error("runScopedEmail: empty label");
  return `e2e-run-${runId}-${cleanLabel}@${E2E_EMAIL_DOMAIN}`;
}

/** True only for an address created by exactly this run. */
export function isOwnedByRun(email: unknown, runId: string): boolean {
  if (!isValidRunId(runId)) return false;
  const classified = classifyEmail(email);
  return classified.kind === "run" && classified.runId === runId;
}
