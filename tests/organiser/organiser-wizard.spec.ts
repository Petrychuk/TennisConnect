import { test, expect, type Page } from '@playwright/test';
import { becomeOrganiser } from '../helpers/organiser';
import { findMySession, getSession, inDays, openMoreMenu, openWorkspaceTab, seedHubSession } from '../helpers/organiser-hub';

/*
  Create Session wizard, Edit and Duplicate (Organiser Hub Phase 2).

  Four categories (shared/sessionCategories.ts); each draft is read back from
  the API, so what's asserted is what was saved, not what the form showed.

  Staging / local only (phase hub-msg-admin). One run-owned organiser per
  test. Drafts only: saving a draft sends nothing to anyone.

  ORG-WIZ-004 (Publish) is opt-in - E2E_ALLOW_PUBLISH_REVIEW=1. An
  organiser's Publish submits for review, and the server then messages
  EVERY admin. If Staging has any admin besides e2e-admin, run cleanup
  refuses the whole run ("messages exchanged with users outside the run",
  server/services/e2eRunCleanup.ts) and the run's data stays behind.
  Decision recorded in docs/testing/E2E_COVERAGE_MATRIX.md.
*/

test.use({ viewport: { width: 1440, height: 900 } }); // desktop wizard buttons (-bottom)

/** yyyy-mm-dd in the browser's local calendar, `days` from today. */
function dateInput(days: number): string {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function pickFormat(page: Page, category: string, format: string) {
  await page.getByTestId(`organiser-wizard-session-category-${category}`).click();
  const chip = page.getByTestId(`organiser-wizard-type-${format}`);
  if (await chip.count()) await chip.click();
  await page.getByTestId('organiser-wizard-next-bottom').click();
}

async function fillBasics(page: Page, title: string) {
  await expect(page.getByTestId('organiser-wizard-step2')).toBeVisible();
  await page.getByTestId('organiser-wizard-session-name').fill(title);
  await page.getByTestId('organiser-wizard-session-venue').fill('Rushcutters Bay Tennis Centre');
  await page.getByTestId('organiser-wizard-date').fill(dateInput(21));
  await page.getByTestId('organiser-wizard-next-bottom').click();
  await expect(page.getByTestId('organiser-wizard-step3')).toBeVisible();
}

async function addPolicies(page: Page, rules: string, refund: string) {
  await page.getByTestId('organiser-wizard-rules-policies-expand').click();
  await page.getByTestId('organiser-wizard-rules-text').fill(rules);
  await page.getByTestId('organiser-wizard-refund-policy').fill(refund);
}

// Save as Draft keeps the organiser in the wizard (so they can keep going and save again):
// the success toast, then the URL carries ?draft=<id>.
async function saveDraft(page: Page) {
  await page.getByTestId('organiser-wizard-save-draft-bottom').click();
  await expect(page.getByText('Session saved as draft').first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/organiser\/sessions\/new\?draft=/);
}

test.describe('Create Session wizard', () => {
  test('ORG-WIZ-001 Each category saves a draft with only its own settings', async ({ page }) => {
    test.slow(); // four drafts through the full UI
    await becomeOrganiser(page);
    const cases = [
      { category: 'social-play', format: 'americano', format_fields: true, note: null },
      { category: 'competition', format: 'tournament', format_fields: true, note: 'organiser-wizard-competition-note' },
      { category: 'coaching-fitness', format: 'junior-development', format_fields: false, note: 'organiser-wizard-coaching-note' },
      { category: 'other', format: 'custom', format_fields: true, note: null },
    ] as const;

    for (const c of cases) {
      const title = `Wizard ${c.category} ${Date.now()}`;
      await page.goto('/organiser/sessions/new');
      await pickFormat(page, c.category, c.format);
      await fillBasics(page, title);

      await expect(page.getByTestId('organiser-wizard-step3')).toHaveAttribute('data-category', c.category);
      await expect(page.getByTestId('organiser-wizard-format-card')).toHaveCount(c.format_fields ? 1 : 0);
      await expect(page.getByTestId('organiser-wizard-pairing-card')).toHaveCount(c.format_fields ? 1 : 0);
      if (c.note) await expect(page.getByTestId(c.note)).toBeVisible();
      if (c.category === 'competition') {
        // No promise of draws or brackets the Live engine doesn't have.
        await expect(page.getByTestId('organiser-wizard-competition-note')).toContainText("aren't available yet");
      }
      if (c.format_fields) await page.getByTestId('organiser-wizard-match-type-singles').click();

      await addPolicies(page, `Rules for ${c.category}`, 'Full refund up to 48 hours before.');
      await saveDraft(page);

      const saved = await findMySession(page, title);
      const full = await getSession(page, saved.id);
      expect(full.status, c.category).toBe('draft');
      expect(full.type, c.category).toBe(c.format);
      expect(full.rulesText, c.category).toBe(`Rules for ${c.category}`);
      expect(full.refundPolicy, c.category).toBe('Full refund up to 48 hours before.');
      expect(full.latePolicy, c.category).toBeNull();
      // Policies live in their own fields, not in the description any more.
      expect(full.description ?? '', c.category).not.toContain('Rules:');
      if (c.format_fields) {
        expect(full.matchMode, c.category).toBe('singles');
        expect(full.gamesTo, c.category).not.toBeNull();
        expect(full.description ?? '', c.category).toContain('Format: Singles');
      } else {
        // Coaching & Fitness: no scoring or rounds saved, no format text.
        expect(full.gamesTo, c.category).toBeNull();
        expect(full.plannedRoundsCount, c.category).toBeNull();
        expect(full.description ?? '', c.category).not.toContain('Format:');
      }
    }
  });

  test('ORG-WIZ-002 Required fields: Next needs name, venue and date; a draft does not; publishing does', async ({ page }) => {
    await becomeOrganiser(page);
    const before = (await (await page.request.get('/api/organizer/sessions/mine')).json()).length;

    await page.goto('/organiser/sessions/new');
    // Step 1: Next without a category stays on step 1.
    await page.getByTestId('organiser-wizard-next-bottom').click();
    await expect(page.getByTestId('organiser-wizard-step1')).toBeVisible();

    await pickFormat(page, 'social-play', 'social');
    // Step 2 with no name/venue: Next refuses...
    await page.getByTestId('organiser-wizard-session-name').fill('');
    await page.getByTestId('organiser-wizard-next-bottom').click();
    await expect(page.getByTestId('organiser-wizard-step2')).toBeVisible();
    await expect(page.getByText('Give your session a name, venue, and date to continue').first()).toBeVisible();
    expect((await (await page.request.get('/api/organizer/sessions/mine')).json()).length, 'Next saved nothing').toBe(before);

    // ...but Save as Draft keeps the incomplete draft (one row, as a draft).
    await saveDraft(page);
    const mine = (await (await page.request.get('/api/organizer/sessions/mine')).json()) as { id: string; status: string }[];
    expect(mine.length, 'exactly one draft was created').toBe(before + 1);
    expect(mine.find((s) => s.status === 'draft')).toBeTruthy();
  });

  test('ORG-WIZ-003 Edit keeps the policies after a reload; Duplicate pre-fills without saving', async ({ page }) => {
    const organiser = await becomeOrganiser(page);
    const title = `Edit me ${Date.now()}`;
    const seeded = await seedHubSession(
      page,
      organiser,
      { title, startAt: inDays(10), status: 'published', type: 'coaching-clinic' },
      { location: 'Court 3', rulesText: 'Bring a racquet', cancellationPolicy: 'Cancel from My Sessions' },
    );

    // Edit restores the policies as separate fields...
    await page.goto(`/organiser/sessions/${seeded.id}/edit`);
    await page.getByTestId('organiser-session-edit-policies-toggle').click(); // Rules & policies start collapsed
    await expect(page.getByTestId('organiser-session-edit-policy-rules')).toHaveValue('Bring a racquet', { timeout: 15_000 });
    await expect(page.getByTestId('organiser-session-edit-policy-cancellation')).toHaveValue('Cancel from My Sessions');
    await page.getByTestId('organiser-session-edit-policy-lateArrival').fill('Spots go to the waiting list after 15 minutes');
    await page.getByTestId('organiser-session-edit-policy-rules').fill('');
    await page.getByTestId('organiser-session-edit-save').click();
    await expect(page).toHaveURL(new RegExp(`/organiser/sessions/${seeded.id}`), { timeout: 15_000 });

    // ...saved: the API and a fresh Edit page agree.
    const saved = await getSession(page, seeded.id);
    expect(saved.latePolicy).toBe('Spots go to the waiting list after 15 minutes');
    expect(saved.rulesText).toBeNull();
    expect(saved.cancellationPolicy).toBe('Cancel from My Sessions');
    await page.goto(`/organiser/sessions/${seeded.id}/edit`);
    await page.getByTestId('organiser-session-edit-policies-toggle').click();
    await expect(page.getByTestId('organiser-session-edit-policy-lateArrival')).toHaveValue('Spots go to the waiting list after 15 minutes', { timeout: 15_000 });

    // Duplicate opens the wizard pre-filled and creates nothing by itself.
    const before = (await (await page.request.get('/api/organizer/sessions/mine')).json()).length;
    await openWorkspaceTab(page, seeded.id, 'overview');
    await openMoreMenu(page);
    await page.getByTestId('organiser-session-more-duplicate').click();
    await expect(page).toHaveURL(new RegExp(`duplicateFrom=${seeded.id}`));
    await expect(page.getByTestId('organiser-wizard-session-category-coaching-fitness')).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
    await page.getByTestId('organiser-wizard-next-bottom').click();
    await expect(page.getByTestId('organiser-wizard-session-name')).toHaveValue(`${title} (Copy)`);
    const after = (await (await page.request.get('/api/organizer/sessions/mine')).json()).length;
    expect(after).toBe(before);
  });

  test('ORG-WIZ-004 Publish submits the session for review (opt-in: messages every admin)', async ({ page }) => {
    test.skip(process.env.E2E_ALLOW_PUBLISH_REVIEW !== '1', 'Publish messages every admin; run cleanup refuses messages to admins outside the run. Opt in with E2E_ALLOW_PUBLISH_REVIEW=1.');
    await becomeOrganiser(page);
    const title = `Publish ${Date.now()}`;
    await page.goto('/organiser/sessions/new');
    await pickFormat(page, 'social-play', 'social');
    await fillBasics(page, title);
    await page.getByTestId('organiser-wizard-next-bottom').click(); // review
    await page.getByTestId('organiser-wizard-publish-bottom').click();
    await expect(page.getByTestId('organiser-wizard-pending-approval-dialog')).toBeVisible({ timeout: 15_000 });
    const saved = await findMySession(page, title);
    expect(saved.status).toBe('pending_review');
  });
  test('ORG-WIZ-005 Step 2 layout at all six viewports: nothing overflows, icons are centred, controls are 44px on touch', async ({ page }) => {
    await becomeOrganiser(page);
    const viewports = [
      { name: '1440x900', width: 1440, height: 900, touch: false },
      { name: '1280x800', width: 1280, height: 800, touch: false },
      { name: '768x1024', width: 768, height: 1024, touch: true },
      { name: '1024x768', width: 1024, height: 768, touch: true },
      { name: '390x844', width: 390, height: 844, touch: true },
      { name: '360x800', width: 360, height: 800, touch: true },
    ];
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/organiser/sessions/new');
      await page.getByTestId('organiser-wizard-session-category-social-play').click();
      // xl and up has the bottom action bar; below it the stacked buttons
      await page.getByTestId(vp.width >= 1280 ? 'organiser-wizard-next-bottom' : 'organiser-wizard-next').click();
      await expect(page.getByTestId('organiser-wizard-step2')).toBeVisible();

      const m = await page.evaluate(() => {
        const step = document.querySelector('[data-testid=organiser-wizard-step2]')!;
        const spill: string[] = [];
        step.querySelectorAll<HTMLElement>('input, button:not([role=radio]):not([role=switch]):not([role=combobox])').forEach((el) => {
          const card = el.closest('[data-testid^=organiser-wizard-section]');
          if (!card || (el as HTMLInputElement).type === 'file') return;
          const r = el.getBoundingClientRect();
          const c = card.getBoundingClientRect();
          if (r.width && (r.left < c.left - 0.5 || r.right > c.right + 0.5)) spill.push(el.getAttribute('data-testid') ?? el.tagName);
        });
        const iconOff = Array.from(step.querySelectorAll('svg.pointer-events-none')).filter((svg) => {
          const a = svg.getBoundingClientRect();
          const b = svg.parentElement!.getBoundingClientRect();
          return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) > 1;
        }).length;
        const heights = ['organiser-wizard-session-name', 'organiser-wizard-session-venue', 'organiser-wizard-date', 'organiser-wizard-max-players']
          .map((id) => document.querySelector(`[data-testid=${id}]`)!.getBoundingClientRect().height);
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          spill,
          iconOff,
          minHeight: Math.min(...heights),
          // Controls are 44 px on a coarse pointer or a narrow screen, 36 px (md:pointer-fine) with a mouse.
          fine: window.matchMedia('(pointer: fine)').matches,
        };
      });
      expect(m.overflow, `${vp.name}: horizontal overflow`).toBeLessThanOrEqual(0);
      expect(m.spill, `${vp.name}: controls outside their card`).toEqual([]);
      expect(m.iconOff, `${vp.name}: icons not vertically centred in their field`).toBe(0);
      // Desktop Chrome has a mouse: from 768 px up the app (correctly) uses 36 px controls there.
      if (vp.touch && (vp.width < 768 || !m.fine)) expect(m.minHeight, `${vp.name}: control height`).toBeGreaterThanOrEqual(43.5);
      else if (vp.touch) expect(m.minHeight, `${vp.name}: control height (mouse)`).toBeGreaterThanOrEqual(35.5);
    }
  });
});
