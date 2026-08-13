import { expect, Page } from '@playwright/test';

// ---------- Send via profile "Contact" tab ----------

// Shared by MSG-001 (player -> coach), MSG-005 (player -> player),
// MSG-006 (coach -> player), MSG-007 (organizer -> player) - they all
// land on the same recipient profile page and the same Contact tab UI,
// only the logged-in sender's role differs.
export async function sendContactMessage(
  page: Page,
  profilePath: string,
  data: { subject: string; message: string; phone?: string }
) {
  await page.goto(`${profilePath}?tab=contact`);

  await page.getByTestId('contact-tab').click();

  await page.getByTestId('input-contact-subject').fill(data.subject);

  if (data.phone) {
    await page.getByTestId('input-contact-phone').fill(data.phone);
  }

  await page.getByTestId('textarea-contact-message').fill(data.message);

  const sendButton = page.getByTestId('button-send-contact-message');
  await expect(sendButton).toBeEnabled();

  const [response] = await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/messages') &&
        response.request().method() === 'POST'
    ),
    sendButton.click(),
  ]);

  return response;
}
