/*
  TC Live feature flag and internal test accounts (TC Live v1).

  Replaces the Staging-only gate (`requireStagingEnv`, DB_ENV === "staging")
  with a server-enforced switch that every environment sets for itself:

    TC_LIVE_ENABLED   unset / "false" / anything else   -> "off"   (default)
                      "internal"                         -> "internal"
                      "true" / "1" / "on"                -> "on"

  off       Every Live control route answers 404 (as if it didn't exist).
            Stored rounds, scores, leaderboards and results stay readable:
            turning Live off is the kill switch and never deletes history.
  internal  Live works only for internal test sessions (sessions.is_internal_test,
            set by the server - see below). For validating Production with
            test data before real organisers get it.
  on        Live works for every session its organiser owns.

  TC_INTERNAL_TEST_EMAILS   comma-separated account emails (case-insensitive)
            that are internal test identities in THIS environment. A session
            created by one of them is an internal test session: hidden from
            every public listing, joinable only by other internal accounts,
            published without admin review (it's never public). Production
            and Staging keep separate lists; never reuse Staging accounts.

  Read on every call (not cached at boot): a changed value applies on the
  next restart/redeploy, and unit tests can set it per test.
  Pure apart from process.env - unit-tested in ./liveFeature.test.ts.
*/

export type LiveMode = "off" | "internal" | "on";

type Env = Record<string, string | undefined>;

export function parseLiveMode(raw: string | undefined): LiveMode {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "true" || value === "1" || value === "on") return "on";
  if (value === "internal") return "internal";
  return "off";
}

export function liveMode(env: Env = process.env): LiveMode {
  return parseLiveMode(env.TC_LIVE_ENABLED);
}

export function internalTestEmails(env: Env = process.env): Set<string> {
  return new Set(
    (env.TC_INTERNAL_TEST_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isInternalTestUser(email: string | null | undefined, env: Env = process.env): boolean {
  return !!email && internalTestEmails(env).has(email.trim().toLowerCase());
}

/** May Live controls run for this session in this environment? */
export function liveAllowedFor(session: { isInternalTest?: boolean | null }, env: Env = process.env): boolean {
  const mode = liveMode(env);
  if (mode === "on") return true;
  if (mode === "internal") return session.isInternalTest === true;
  return false;
}
