import type { Page } from '@playwright/test';
import { registerCoach, registerPlayer } from './auth';
import { completeCoachProfile, completePlayerProfile } from './profile';

/*
  Fresh, run-owned accounts for tests that CHANGE an account - edit a
  profile, upload a photo, change settings. The permanent Stage 2 accounts
  (TEST_USERS, e2e-*@tennisconnect.test) are shared by every test and must
  never be modified, so these tests get their own account instead.

  The address is e2e-run-<runId>-...@tennisconnect.test (registerPlayer ->
  generateTestUser), so the run's cleanup removes the account and
  everything it created.
*/

/** Registers a run-owned player, completes the profile, ends on /player/<slug> signed in. */
export async function signInAsNewPlayer(page: Page) {
  const user = await registerPlayer(page);
  await completePlayerProfile(page);
  return user;
}

/** Registers a run-owned coach, completes the profile, ends on /coach/<slug> signed in. */
export async function signInAsNewCoach(page: Page) {
  const user = await registerCoach(page);
  await completeCoachProfile(page);
  return user;
}
