// Public site URL for links in emails (verify email, reset password).
//
// Never taken blindly from the request: the Origin header is set by the
// caller, so `${req.headers.origin}/reset-password?token=...` let anyone
// who requested a reset for someone else's address put their own domain -
// and the victim's token - into a genuine TennisConnect email. The link
// now always points at a known site for the environment:
//
//   APP_URL (if set and a valid https URL; http only for localhost)
//   otherwise the request Origin, ONLY if it is a known site of this
//   environment, otherwise this environment's default site:
//     production  https://www.tennisconnect.com.au (also accepts the apex)
//     staging     https://tennisconnect-staging.up.railway.app
//     development the request Origin if it is localhost/127.0.0.1,
//                 else the production site (previous behaviour)
//
// Pure module - unit-tested in server/lib/appUrl.test.ts.

export const PRODUCTION_SITE = "https://www.tennisconnect.com.au";
export const STAGING_SITE = "https://tennisconnect-staging.up.railway.app";

const KNOWN_SITES: Record<"production" | "staging", readonly string[]> = {
  production: [PRODUCTION_SITE, "https://tennisconnect.com.au"],
  staging: [STAGING_SITE],
};

function normaliseOrigin(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

const isLocalhost = (origin: string) => {
  const host = new URL(origin).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
};

export interface AppUrlSource {
  /** Request Origin header (untrusted). */
  origin: unknown;
  dbEnv: string | undefined;
  /** APP_URL - explicit override, e.g. a preview deployment. */
  configured?: string | undefined;
}

export function publicAppUrl(source: AppUrlSource): string {
  const configured = normaliseOrigin(source.configured);
  if (configured && (configured.startsWith("https://") || isLocalhost(configured))) return configured;

  const dbEnv = (source.dbEnv ?? "").trim().toLowerCase();
  const origin = normaliseOrigin(source.origin);

  if (dbEnv === "production" || dbEnv === "staging") {
    const known = KNOWN_SITES[dbEnv];
    return origin && known.includes(origin) ? origin : known[0];
  }
  // Local development / unknown: a localhost origin, otherwise the old default.
  return origin && isLocalhost(origin) ? origin : PRODUCTION_SITE;
}
