import type { FullConfig } from '@playwright/test';

// The site isn't live yet, so BASE_URL defaults to localhost during local
// dev/staging runs. Once it goes live, PROD will be:
//   BASE_URL=https://tennisconnect.com.au
// Update this if the production domain ever changes.
const PROD_HOSTS = ['tennisconnect.com.au', 'www.tennisconnect.com.au'];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export default function globalSetup(config: FullConfig) {
  const baseURL =
    process.env.BASE_URL ||
    config.projects[0]?.use?.baseURL ||
    'http://localhost:3000';

  const isProd = PROD_HOSTS.includes(hostOf(baseURL));
  const allowProd = process.env.ALLOW_PROD === '1';

  if (isProd && !allowProd) {
    throw new Error(
      `\n\n` +
      `Refusing to run: baseURL points at PRODUCTION (${baseURL}).\n` +
      `This test run is not the @smoke suite, so it includes destructive ` +
      `tests (registration, profile edits, admin CRUD, delete, security ` +
      `payloads) that must never touch prod data.\n\n` +
      `- If you meant to run the full suite: point BASE_URL at STAGING.\n` +
      `- If you meant to run smoke checks against prod: ` +
      `use "npm run test:e2e:smoke" (it sets ALLOW_PROD=1 for you).\n`
    );
  }
}
