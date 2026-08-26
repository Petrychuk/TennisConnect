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

  await page.getByTestId('button-save').click();
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

  await page.getByTestId('button-save').click();
}