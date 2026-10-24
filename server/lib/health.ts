// Payload for GET /api/health (server/routes.ts).
//
// Public and deliberately minimal - never add anything secret here.
//
// - dbEnv: which database environment this instance talks to (DB_ENV,
//   see server/env.ts). tests/global-setup.ts refuses to run unless it
//   matches TEST_ENV.
// - commit: the Git commit this instance was built from, so CI can prove
//   the Railway Staging deployment it is about to test is the commit it
//   expects (tests/safety/deployed-commit.ts) - a healthy endpoint alone
//   says nothing about WHICH code is running.
//
//   Source: RAILWAY_GIT_COMMIT_SHA, which Railway sets only for deploys
//   triggered from GitHub (docs.railway.com/variables/reference). A
//   manual "Redeploy"/CLI deploy may not have it - then `commit` is
//   omitted and CI fails closed instead of guessing.
//
//   Only reported on non-production instances: Production has no CI
//   check that needs it yet, and there is no reason to publish more
//   about Production than necessary.

const FULL_SHA = /^[0-9a-f]{40}$/;

export interface HealthPayload {
  dbEnv: string;
  commit?: string;
}

export function buildHealthPayload(source: {
  dbEnv: string;
  railwayGitCommitSha: string | undefined;
}): HealthPayload {
  const payload: HealthPayload = { dbEnv: source.dbEnv };

  const isProduction = source.dbEnv.trim().toLowerCase() === "production";
  const sha = (source.railwayGitCommitSha ?? "").trim().toLowerCase();

  if (!isProduction && FULL_SHA.test(sha)) {
    payload.commit = sha;
  }

  return payload;
}
