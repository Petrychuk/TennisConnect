import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { becomeOrganiser, seedPlayers, seedSession } from '../helpers/organiser';

/*
  Organiser Hub - responsive checks (Phase 2 Batch 2).

  Mandatory viewports (docs/organiser-hub/TEST_COVERAGE.md):
    Desktop 1440x900, Laptop 1280x800, Tablet portrait 768x1024,
    Tablet landscape 1024x768, Mobile 390x844, Small mobile 360x800.

  Safety (docs/CLAUDE_PLAYWRIGHT_RULES.md): Staging / local only - phase
  hub-msg-admin (tests/safety/staging-phases.ts). Everything is run-owned:
  a fresh organiser (becomeOrganiser), seeded test players and a seeded
  session in that organiser's own organisation. Writes: one check-in on
  that session, and that organisation's own name / contact details. No
  emails, messages, payments or uploads. The run-scoped global teardown
  removes it all (tests/helpers/run-cleanup.ts).

  Every page/viewport: no horizontal page overflow, the right navigation
  for the width (sidebar >= 1280, menu button 768-1279, bottom bar < 768),
  and a screenshot attached to the report for visual review.
*/

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 360, height: 800 },
] as const;

type Viewport = (typeof VIEWPORTS)[number];

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${label}: page is ${scrollWidth}px wide in a ${clientWidth}px viewport`).toBeLessThanOrEqual(clientWidth + 1);
}

async function expectNavigationFor(page: Page, viewport: Viewport, label: string) {
  if (viewport.width >= 1280) {
    await expect(page.getByTestId('organiser-sidebar').first(), `${label}: sidebar`).toBeVisible();
  } else if (viewport.width >= 768) {
    await expect(page.getByTestId('organiser-sidebar-trigger'), `${label}: menu button`).toBeVisible();
  } else {
    await expect(page.getByTestId('organiser-mobile-nav-home'), `${label}: bottom bar`).toBeVisible();
    await expect(page.getByTestId('organiser-mobile-nav-more'), `${label}: full menu`).toBeVisible();
  }
}

async function snapshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

test.describe('Organiser Hub responsive', () => {
  test('ORG-RESP-001 Hub pages: no horizontal overflow and the right navigation at all six viewports', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const organiser = await becomeOrganiser(page);
    const players = await seedPlayers(page, 2);
    const session = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Responsive social ${Date.now()}`,
      startAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      status: 'published',
      type: 'social',
      registrations: players.map((p) => ({ userId: p.id })),
    });

    const pages: { path: string; testId: string; name: string }[] = [
      { path: '/organiser', testId: 'organiser-dashboard', name: 'dashboard' },
      { path: '/organiser/sessions', testId: 'organiser-sessions-page', name: 'sessions' },
      { path: '/organiser/sessions/new', testId: 'organiser-session-new-page', name: 'wizard' },
      { path: `/organiser/sessions/${session.id}?tab=players`, testId: 'organiser-session-workspace', name: 'workspace-players' },
      { path: `/organiser/sessions/${session.id}?tab=rounds`, testId: 'organiser-session-workspace', name: 'workspace-rounds' },
      { path: `/organiser/sessions/${session.id}?tab=format`, testId: 'organiser-session-workspace', name: 'workspace-format' },
      { path: '/organiser/organisation', testId: 'organiser-organisation-page', name: 'organisation' },
    ];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const target of pages) {
        const label = `${target.name} @ ${viewport.name} ${viewport.width}x${viewport.height}`;
        await page.goto(target.path);
        await expect(page.getByTestId(target.testId).first(), label).toBeVisible({ timeout: 15_000 });
        await page.waitForLoadState('networkidle');
        await expectNavigationFor(page, viewport, label);
        await expectNoHorizontalOverflow(page, label);
        await snapshot(page, testInfo, `${target.name}-${viewport.name}`);
      }
    }
  });

  test('ORG-RESP-002 Wizard categories and players check-in work by touch on a phone', async ({ page }, testInfo) => {
    const organiser = await becomeOrganiser(page);
    const [player] = await seedPlayers(page, 1);
    const session = await seedSession(page, {
      organizationId: organiser.organizationId,
      createdBy: organiser.id,
      title: `Responsive check-in ${Date.now()}`,
      startAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      status: 'published',
      type: 'social',
      registrations: [{ userId: player.id }],
    });
    const registrationId = session.registrationIds[0];

    for (const viewport of [VIEWPORTS[5], VIEWPORTS[2]]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // Wizard: picking Coaching & Fitness hides match-format settings.
      await page.goto('/organiser/sessions/new');
      const coaching = page.getByTestId('organiser-wizard-session-category-coaching-fitness');
      await expect(coaching).toBeVisible({ timeout: 15_000 });
      const box = await coaching.boundingBox();
      expect(box?.height ?? 0, `category card is tall enough to tap (${viewport.name})`).toBeGreaterThanOrEqual(44);
      await coaching.click();
      await expectNoHorizontalOverflow(page, `wizard step 1 @ ${viewport.name}`);
      await snapshot(page, testInfo, `wizard-coaching-${viewport.name}`);
    }

    // Check-in on a 360 px phone: the card list, a 44 px button.
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/organiser/sessions/${session.id}?tab=players`);
    const checkIn = page.getByTestId(`organiser-players-list-item-${registrationId}-checkin`);
    await expect(checkIn).toBeVisible({ timeout: 15_000 });
    expect((await checkIn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await checkIn.click();
    await expect(checkIn).toBeHidden({ timeout: 15_000 });
    await expectNoHorizontalOverflow(page, 'players tab after check-in @ 360');
    await snapshot(page, testInfo, 'checkin-small-mobile');

    // The check-in is real: the API agrees.
    const res = await page.request.get(`/api/organizer/sessions/${session.id}/registrations`);
    expect(res.ok()).toBeTruthy();
    const registrations = (await res.json()) as { id: string; checkedInAt: string | null }[];
    expect(registrations.find((r) => r.id === registrationId)?.checkedInAt).toBeTruthy();
  });

  test('ORG-RESP-003 Your Organisation: edit on a phone, contacts shown on the public page', async ({ page }, testInfo) => {
    const organiser = await becomeOrganiser(page);
    const name = `E2E Club ${Date.now()}`;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/organiser/organisation');
    await expect(page.getByTestId('organiser-organisation-name')).toHaveValue(organiser.organizationName, { timeout: 15_000 });

    // Client-side validation: a script URL is refused before anything is sent.
    await page.getByTestId('organiser-organisation-website').fill('javascript:alert(1)');
    await page.getByTestId('organiser-organisation-save').click();
    await expect(page.getByTestId('org-website-error')).toBeVisible();

    await page.getByTestId('organiser-organisation-name').fill(name);
    await page.getByTestId('organiser-organisation-website').fill('e2e-club.example');
    await page.getByTestId('organiser-organisation-email').fill('contact@e2e-club.example');
    await page.getByTestId('organiser-organisation-phone').fill('+61 2 9000 0000');
    await page.getByTestId('organiser-organisation-save').click();
    await expect(page.getByTestId('organiser-organisation-save')).toBeDisabled({ timeout: 15_000 }); // saved -> nothing left to save
    await expectNoHorizontalOverflow(page, 'organisation @ 390');
    await snapshot(page, testInfo, 'organisation-mobile');

    // Persisted: a reload shows the saved values.
    await page.reload();
    await expect(page.getByTestId('organiser-organisation-name')).toHaveValue(name, { timeout: 15_000 });
    await expect(page.getByTestId('organiser-organisation-website')).toHaveValue('https://e2e-club.example');

    // Public page on the smallest phone.
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByTestId('organiser-organisation-view-public').click();
    await expect(page.getByTestId('organization-name')).toHaveText(name, { timeout: 15_000 });
    await expect(page.getByTestId('organization-website')).toHaveAttribute('href', 'https://e2e-club.example');
    await expect(page.getByTestId('organization-email')).toHaveAttribute('href', 'mailto:contact@e2e-club.example');
    await expect(page.getByTestId('organization-phone')).toHaveAttribute('href', 'tel:+61290000000');
    await expectNoHorizontalOverflow(page, 'public organisation page @ 360');
    await snapshot(page, testInfo, 'organisation-public-small-mobile');
  });
});
