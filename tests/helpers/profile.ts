import { Page } from '@playwright/test';

export async function completeCoachProfile(page: Page) {
  await page.getByTestId('input-title')
    .fill('Playwright Tennis Coach');

  await page.getByTestId('input-location')
    .fill('Sydney, NSW');

  await page.getByTestId('input-experience')
    .fill('10+ years');

  await page.getByTestId('input-rate')
    .fill('$80/hour');

  await page.getByTestId('textarea-bio')
    .fill(
      'Experienced tennis coach created by Playwright automation.'
    );

  // onCoachSubmit does three sequential awaited fetches (PUT
  // coach-profile, POST complete-profile, GET auth/me) before
  // redirecting - individually each is fast, but under the smoke
  // suite's parallel load that combined chain can take longer than a
  // caller's default assertion timeout would allow, even though
  // nothing is actually failing. Waiting for the redirect right here,
  // with a generous timeout, means every caller gets a reliable
  // "profile completion actually finished" signal instead of each one
  // needing to know to extend its own toHaveURL timeout.
  await Promise.all([
    page.waitForURL(/\/coach\/.+/, { timeout: 30_000 }),
    page.getByTestId('button-save').click(),
  ]);
}

export async function completePlayerProfile(page: Page) {
  // Country defaults to "Australia" (see complete-profile.tsx's
  // playerForm defaultValues) - no interaction needed to exercise that;
  // the field used to be a native <Select> matched via role="option",
  // now it's a Command/Popover combobox that doesn't expose that role.

  await page.getByTestId('input-location')
    .fill('Sydney, NSW');

  // Skill Level is a card/radio group now, not a <Select> - see
  // complete-profile.tsx's SKILL_LEVELS.
  await page.getByTestId('radio-skill-intermediate')
    .check();

  await page.getByTestId('input-courts')
    .fill('Bondi, Manly');

  await page.getByTestId('textarea-bio')
    .fill(
      'Player profile created by Playwright automation.'
    );

  // Same reasoning as completeCoachProfile above - onPlayerSubmit's
  // own three sequential fetches before its window.location.href
  // redirect can outrun a short default timeout under parallel load.
  await Promise.all([
    page.waitForURL(/\/player\/.+/, { timeout: 30_000 }),
    page.getByTestId('button-save').click(),
  ]);
}