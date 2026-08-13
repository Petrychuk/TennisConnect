import type { FullConfig } from '@playwright/test';

// Two independent layers, either one can block the run:
//
// 1. Hostname check - catches the real prod domain, wherever it's
//    accessed from. Reliable for deployed prod vs deployed staging
//    (different domains by definition).
//
// 2. Live /api/health check - catches the gap the hostname check can't:
//    running the prod build LOCALLY (`npm start`, NODE_ENV=production)
//    while BASE_URL defaults to localhost. Same host as staging's local
//    dev server, but a different database behind it. Asks the actually
//    running server "which DB are you on" via DB_ENV (see server/env.ts)
//    instead of trusting the URL.
//
// Requires DB_ENV=production / DB_ENV=staging to be set per environment
// (in .env / .env.dev respectively) for layer 2 to mean anything. If
// it's unset ("unknown") or the server can't be reached yet, layer 2
// stays silent rather than false-blocking a legitimate staging run -
// layer 1 (hostname) is still the primary net.
const PROD_HOSTS = ['tennisconnect.com.au', 'www.tennisconnect.com.au'];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

async function isLiveServerProd(baseURL: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${baseURL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const data = await response.json();
    return data?.dbEnv === 'production';
  } catch {
    // Server not reachable yet, /api/health not deployed, network
    // hiccup - don't block on an inconclusive answer. The tests
    // themselves will fail clearly if the server truly isn't up.
    return false;
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    process.env.BASE_URL ||
    config.projects[0]?.use?.baseURL ||
    'http://localhost:3000';

  const allowProd = process.env.ALLOW_PROD === '1';
  if (allowProd) return;

  const hostLooksProd = PROD_HOSTS.includes(hostOf(baseURL));
  const liveServerIsProd = await isLiveServerProd(baseURL);

  if (hostLooksProd || liveServerIsProd) {
    const reason = hostLooksProd
      ? `baseURL's hostname is a known PRODUCTION domain (${baseURL})`
      : `the server actually running at ${baseURL} reports itself as ` +
        `DB_ENV=production, even though the URL doesn't look like it`;

    throw new Error(
      `\n\n` +
      `Refusing to run: ${reason}.\n` +
      `This test run is not the @smoke suite, so it includes destructive ` +
      `tests (registration, profile edits, admin CRUD, delete, security ` +
      `payloads) that must never touch prod data.\n\n` +
      `- If you meant to run the full suite: point BASE_URL at STAGING, ` +
      `and make sure the server you're hitting was started with ` +
      `DB_ENV=staging (or DB_ENV=production only on real prod).\n` +
      `- If you meant to run smoke checks against prod: ` +
      `use "npm run test:e2e:smoke" (it sets ALLOW_PROD=1 for you).\n`
    );
  }
}
