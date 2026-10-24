import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import {
  PROD_SAFE_GREP,
  productionTestMatch,
  resolveTarget,
} from './tests/safety/environment-guard';
import { ensureRunId } from './tests/fixtures/run-id';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/*
  TARGET ENVIRONMENT - see tests/safety/environment-guard.ts.

  TEST_ENV=local       loopback BASE_URL (default http://localhost:3000), full suite
  TEST_ENV=staging     BASE_URL = staging (https), full suite
  TEST_ENV=production  BASE_URL = production (https), ONLY the explicit
                       PROD_SAFE_ALLOWLIST (@prod-safe) - never @smoke,
                       never the full suite.

  resolveTarget() throws here (before anything runs or is listed) on an
  invalid / inconsistent TEST_ENV + BASE_URL, or if the removed ALLOW_PROD
  bypass is still set. tests/global-setup.ts then verifies the live server
  via GET /api/health and refuses to run if it can't confirm the target.
*/
const target = resolveTarget(process.env);
const isProduction = target.testEnv === 'production';

// One run token per Playwright run, inherited by all workers. Temporary
// records carry it so Stage 3 cleanup can be limited to this run's data.
ensureRunId(process.env);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({

  timeout: 60000,

  testDir: './tests',
  /* Production: only files in PROD_SAFE_ALLOWLIST can even be loaded, and
     only @prod-safe titles are selected. This is not just a grep filter:
     passing a different --grep or a file path on the CLI cannot reach a
     file outside the allowlist. */
  ...(isProduction
    ? {
        testMatch: productionTestMatch(),
        grep: PROD_SAFE_GREP,
      }
    : {}),
  /* Fails closed unless the live server confirms TEST_ENV.
     See tests/global-setup.ts. */
  globalSetup: './tests/global-setup.ts',
  // Stage 3: reports this run's leftover data; deletes it only with
  // E2E_CLEANUP_ON_TEARDOWN=1 (tests/global-teardown.ts).
  globalTeardown: './tests/global-teardown.ts',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Cap workers everywhere, not just CI: each worker opens its own DB
     session, and the Supabase pooler in session mode here has pool_size 15.
     Running unbounded workers (default = CPU core count) against a shared
     Postgres pool is what causes EMAXCONNSESSION.
     Local runs (no BASE_URL - hitting your own machine's dev server)
     default to 1: 4 parallel browsers + 4 concurrent hits against a Vite
     dev server that compiles modules on demand is enough to starve a
     laptop - symptoms look exactly like "everything hangs" (60s+
     timeouts on a plain page.goto, 12-minute test files) even though
     nothing is actually broken, just contended. Runs against a real
     remote server (BASE_URL set, e.g. staging) default back to 4, since
     that server's resources aren't your laptop's. Override either way
     with --workers=N. */
  workers: process.env.CI ? 1 : 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Recorded in the HTML report so every run shows where it ran. */
  metadata: {
    testEnv: target.testEnv,
    target: target.origin,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */

  use: {
    // Validated by resolveTarget() above - never set baseURL anywhere else.
    baseURL: target.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },

    /* {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    }, */

    /* Test against mobile viewports. */
    /* {
      name: 'Pixel 7',
      use: { ...devices['Pixel 7'] },
    }, */
    /*  {
      name: 'iPhone 16',
     use: { ...devices['iPhone 16'] },
    }, */

    /* Test against tablet viewports. */
    /* {
      name: 'iPad Pro',
      use: { ...devices['iPad Pro 11'] },
    }, */

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
