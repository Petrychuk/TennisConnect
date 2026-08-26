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
  await page.getByTestId('select-country')
    .click();

  await page.getByRole('option', {
    name: 'Australia',
  }).click();

  await page.getByTestId('input-location')
    .fill('Sydney, NSW');

  await page.getByTestId('select-skill')
    .click();

  await page.getByRole('option', {
    name: 'Intermediate',
  }).click();

  await page.getByTestId('input-courts')
    .fill('Bondi, Manly');

  await page.getByTestId('textarea-bio')
    .fill(
      'Player profile created by Playwright automation.'
    );

  await page.getByTestId('button-save').click();
}