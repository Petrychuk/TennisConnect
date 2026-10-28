import { test, expect, type Page, type Locator } from '@playwright/test';

/*
  Hero search (components/shared/hero-search.tsx) on every menu page:
  Games (/play), Players, Coaches, Clubs, Travels and Articles.

  Covers, on desktop (1280px) and phone (390px) widths:
  - the right pill is shown for the width, with a labelled input and a
    labelled Search button;
  - typing filters the results (no-match term -> empty state; clearing
    restores the list);
  - the lime Search button and Enter take you to the results (or run the
    smart search on Games);
  - the Filters button opens the page's filters, and its badge counts
    the active filters;
  - the round shortcuts toggle (aria-pressed) and stay in sync with the
    Filters panel; phones show at most 4 of them;
  - the focus outline is the thin 1px one; no horizontal scroll on phones.

  Safety: guest only (no login, no registration, no seeded users), no
  form submits that change data, no uploads, messages, emails or
  payments. The only POST the page can make - the Games smart search
  (/api/play/smart-search, an AI call) - is answered by page.route()
  inside the test, so it never leaves the browser. Every other request is
  a GET. Assertions on lists don't depend on how many records an
  environment has: they compare against the count the page loaded.

  Run (local):    TEST_ENV=local npx playwright test tests/public/hero-search.spec.ts
  Not added to the Staging read-only allowlist (tests/safety/staging-readonly.ts):
  that is a separate, reviewed decision.
*/

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const NO_MATCH = 'zzz-no-such-thing-zzz';

interface PageConfig {
  name: string;
  path: string;
  /** Desktop input test id; the phone one is `${inputId}-mobile`. */
  inputId: string;
  /** Desktop submit test id; the phone one is `${submitId}-mobile`. */
  submitId: string;
  cards: (page: Page) => Locator;
  empty: (page: Page) => Locator;
  /** Shown when the page has nothing at all to list (Games only). */
  nothingYet?: (page: Page) => Locator;
  /** Element the Search button scrolls to (not on Games: it runs the smart search). */
  results?: string;
  /** Test id of the Filters button (desktop; phone adds -mobile unless phoneFiltersId is set). */
  filtersId?: string;
  phoneFiltersId?: string;
  shortcutCount: number;
}

const PAGES: PageConfig[] = [
  {
    name: 'Games',
    path: '/play',
    inputId: 'play-page-search-input',
    submitId: 'play-page-search-submit',
    cards: (page) => page.locator('[data-testid^="play-session-card-"]'),
    empty: (page) => page.getByTestId('play-page-no-matches'),
    nothingYet: (page) => page.getByTestId('play-page-empty'),
    filtersId: 'play-quick-filter-open',
    shortcutCount: 5,
  },
  {
    name: 'Players',
    path: '/players',
    inputId: 'players-search-input',
    submitId: 'players-search-submit',
    cards: (page) => page.locator('[data-testid^="player-card-"]'),
    empty: (page) => page.getByRole('heading', { name: 'No partners found' }),
    results: '#players-results',
    filtersId: 'players-filters-open',
    shortcutCount: 5,
  },
  {
    name: 'Coaches',
    path: '/coaches',
    inputId: 'coaches-search-input',
    submitId: 'coaches-search-submit',
    cards: (page) => page.locator('[data-testid^="coach-card-"]'),
    empty: (page) => page.getByRole('heading', { name: 'No coaches found' }),
    results: '#coaches-results',
    filtersId: 'coaches-filters-open',
    shortcutCount: 3,
  },
  {
    name: 'Clubs',
    path: '/clubs',
    inputId: 'clubs-search-input',
    submitId: 'clubs-search-submit',
    cards: (page) => page.getByTestId('club-card'),
    empty: (page) => page.getByRole('heading', { name: 'No clubs found' }),
    results: '#clubs-results',
    filtersId: 'clubs-more-filters-trigger',
    phoneFiltersId: 'clubs-service-filter-trigger',
    shortcutCount: 6,
  },
  {
    name: 'Travels',
    path: '/travels',
    inputId: 'travel-search-input',
    submitId: 'travel-search-submit',
    cards: (page) => page.locator('[data-testid^="travel-card-"]'),
    empty: (page) => page.getByRole('heading', { name: 'No packages found' }),
    results: '#travel-results',
    shortcutCount: 0,
  },
  {
    name: 'Articles',
    path: '/articles',
    inputId: 'articles-search-input',
    submitId: 'articles-search-submit',
    cards: (page) => page.locator('[data-testid^="article-card-"]'),
    empty: (page) => page.getByRole('heading', { name: 'No articles found' }),
    results: '#articles-results',
    shortcutCount: 4,
  },
];

const ids = (cfg: PageConfig, phone: boolean) => ({
  input: phone ? `${cfg.inputId}-mobile` : cfg.inputId,
  otherInput: phone ? cfg.inputId : `${cfg.inputId}-mobile`,
  submit: phone ? `${cfg.submitId}-mobile` : cfg.submitId,
  filters: cfg.filtersId && (phone ? cfg.phoneFiltersId ?? `${cfg.filtersId}-mobile` : cfg.filtersId),
});

/** The visible "Quick filters"-style shortcut group (one per width). */
const shortcutGroup = (page: Page) =>
  page.getByRole('group').filter({ has: page.locator('button[aria-pressed]') }).filter({ visible: true }).first();

/** Waits until the list has finished its first load (cards or the empty state). */
async function waitForList(cfg: PageConfig, page: Page) {
  let loaded = cfg.cards(page).first().or(cfg.empty(page));
  if (cfg.nothingYet) loaded = loaded.or(cfg.nothingYet(page));
  await expect(loaded.first()).toBeVisible();
}

/** Distance from the top of the viewport to the top of `selector`. */
const topOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => Math.round(el.getBoundingClientRect().top));

// SEARCH-001.. in definition order (stable: the loops below are fixed).
// `npx playwright test tests/public/hero-search.spec.ts --list` prints them.
let nextId = 1;
const tid = () => `SEARCH-${String(nextId++).padStart(3, '0')}`;

for (const [widthName, viewport] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
  const phone = widthName === 'phone';

  for (const cfg of PAGES) {
    test.describe(`${cfg.name} hero search (${widthName})`, () => {
      test.use({ viewport });

      test(`${tid()} ${cfg.name} (${widthName}): shows one search pill with a labelled input and Search button`, async ({ page }) => {

        // ---------- Open page ----------

        await page.goto(cfg.path);
        const { input, otherInput, submit } = ids(cfg, phone);

        // ---------- Verify ----------

        await expect(page.getByTestId(input)).toBeVisible();
        await expect(page.getByTestId(otherInput)).toBeHidden();
        await expect(page.getByRole('search').filter({ visible: true })).toHaveCount(1);
        await expect(page.getByTestId(input)).toHaveAccessibleName(/.+/);
        await expect(page.getByTestId(submit)).toHaveAccessibleName('Search');
        await expect(page.getByTestId(submit)).toBeEnabled();

        if (phone) {
          // No sideways scrolling on a phone.
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow).toBeLessThanOrEqual(0);
        }

      });

      test(`${tid()} ${cfg.name} (${widthName}): a term with no match shows the empty state, clearing it restores the list`, async ({ page }) => {

        // ---------- Open page ----------

        await page.goto(cfg.path);
        const search = page.getByTestId(ids(cfg, phone).input);
        await waitForList(cfg, page);
        const initialCount = await cfg.cards(page).count();

        // ---------- Actions ----------

        await search.fill(NO_MATCH);

        // ---------- Verify ----------

        await expect(cfg.cards(page)).toHaveCount(0);
        await expect(cfg.empty(page)).toBeVisible();

        // ---------- Actions ----------

        await search.fill('');

        // ---------- Final verification ----------

        await expect(cfg.cards(page)).toHaveCount(initialCount);
        if (initialCount > 0) await expect(cfg.empty(page)).toBeHidden();

      });

      if (cfg.results) {
        const resultsSelector = cfg.results;

        test(`${tid()} ${cfg.name} (${widthName}): the Search button and Enter take you to the results`, async ({ page }) => {

          // ---------- Open page ----------

          await page.goto(cfg.path);
          const { input, submit } = ids(cfg, phone);
          await waitForList(cfg, page);
          const before = await topOf(page, resultsSelector);

          // ---------- Actions ----------

          await page.getByTestId(submit).click();

          // ---------- Verify ----------

          // scroll-mt-24 leaves 96px for the sticky header.
          await expect.poll(() => topOf(page, resultsSelector)).toBeLessThan(140);
          expect(before).toBeGreaterThan(140);

          // ---------- Actions ----------

          await page.evaluate(() => window.scrollTo(0, 0));
          await expect.poll(() => topOf(page, resultsSelector)).toBeGreaterThan(140);
          await page.getByTestId(input).press('Enter');

          // ---------- Final verification ----------

          await expect.poll(() => topOf(page, resultsSelector)).toBeLessThan(140);
          // The page didn't reload or navigate (the form submit is handled in-page).
          await expect(page).toHaveURL(new RegExp(`${cfg.path}(\\?.*)?$`));

        });
      }

      test(`${tid()} ${cfg.name} (${widthName}): ${cfg.shortcutCount ? `shows ${phone ? Math.min(4, cfg.shortcutCount) : cfg.shortcutCount} shortcuts` : 'has no shortcuts'}${cfg.filtersId ? ' and a Filters button' : ' and no Filters button'}`, async ({ page }) => {

        // ---------- Open page ----------

        await page.goto(cfg.path);
        const { filters } = ids(cfg, phone);

        // ---------- Verify ----------

        const visibleShortcuts = page.locator('button[aria-pressed]').filter({ visible: true });
        if (cfg.shortcutCount === 0) {
          await expect(page.getByRole('search').filter({ visible: true }).getByRole('button', { name: /filter/i })).toHaveCount(0);
          await expect(visibleShortcuts).toHaveCount(0);
        } else {
          const group = shortcutGroup(page);
          await expect(group).toBeVisible();
          await expect(group.locator('button[aria-pressed]').filter({ visible: true })).toHaveCount(
            phone ? Math.min(4, cfg.shortcutCount) : cfg.shortcutCount,
          );
          // Phones: the row fits - nothing scrolls sideways inside it.
          if (phone) {
            const overflow = await group.evaluate((el) => el.scrollWidth - el.clientWidth);
            expect(overflow).toBeLessThanOrEqual(1);
          }
        }

        if (filters) {
          await expect(page.getByTestId(filters)).toBeVisible();
          await expect(page.getByTestId(filters)).toHaveAccessibleName(/filter/i);
        } else {
          await expect(page.getByRole('search').filter({ visible: true }).getByRole('button')).toHaveCount(1); // only Search
        }

      });

      if (!phone) {
        test(`${tid()} ${cfg.name} (${widthName}): keyboard focus shows a thin 1px dark-green outline on the pill`, async ({ page }) => {

          // ---------- Open page ----------

          await page.goto(cfg.path);
          const input = page.getByTestId(ids(cfg, phone).input);
          const pill = page.getByRole('search').filter({ visible: true });

          // ---------- Actions ----------

          await input.focus();

          // ---------- Verify ----------

          await expect(input).toBeFocused();
          // --primary-text (78 85% 25%) = rgb(85, 118, 10). The border fades
          // in (transition-colors), so poll until it settles.
          await expect.poll(() => pill.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(85, 118, 10)');
          await expect.poll(() => pill.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
          // No thick ring around it.
          expect(await pill.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');

        });
      }
    });
  }

  // ---------------------------------------------------------------------
  // Page-specific filter behaviour
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // The Filters panel: a dropdown on tablet/desktop, a modal on phones
  // ---------------------------------------------------------------------

  const PANELS = [
    { name: 'Games', path: '/play', trigger: 'play-quick-filter-open', content: 'play-filters-dialog', apply: 'play-filters-show-results' },
    { name: 'Players', path: '/players', trigger: 'players-filters-open', content: 'players-filters-panel', apply: 'players-filters-show-results' },
    { name: 'Coaches', path: '/coaches', trigger: 'coaches-filters-open', content: 'coaches-filters-panel', apply: phone ? 'coaches-filters-show-results-mobile' : 'coaches-filters-show-results' },
    {
      name: 'Clubs',
      path: '/clubs',
      trigger: phone ? 'clubs-service-filter-trigger' : 'clubs-more-filters-trigger',
      content: phone ? 'clubs-filters-panel-mobile' : 'clubs-filters-panel',
      apply: phone ? 'clubs-filters-show-results-mobile' : 'clubs-filters-show-results',
    },
  ];

  for (const panelCfg of PANELS) {
    test.describe(`${panelCfg.name} Filters panel (${widthName})`, () => {
      test.use({ viewport });
      const triggerId = phone && !panelCfg.trigger.startsWith('clubs-') ? `${panelCfg.trigger}-mobile` : panelCfg.trigger;

      test(`${tid()} ${panelCfg.name} (${widthName}): Filters opens as ${phone ? 'a modal with a close button' : 'a dropdown under the button'} and closes again`, async ({ page }) => {

        // ---------- Open page ----------

        await page.goto(panelCfg.path);
        const trigger = page.getByTestId(triggerId);
        const panel = page.getByTestId(panelCfg.content);

        // ---------- Actions ----------

        await trigger.click();

        // ---------- Verify ----------

        await expect(panel).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
        await expect(page.getByTestId(panelCfg.apply)).toHaveText('Show results');

        if (phone) {
          // A modal: an explicit close button, and only one panel open.
          await expect(page.getByRole('dialog')).toHaveCount(1);
          await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
        } else {
          // A dropdown: it opens below the Filters button.
          const t = await trigger.boundingBox();
          const c = await panel.boundingBox();
          expect(t && c && c.y >= t.y + t.height - 1).toBeTruthy();
          await page.getByRole('button', { name: 'Close filters' }).click();
        }

        // ---------- Verify ----------

        await expect(panel).toBeHidden();

        // ---------- Actions ----------

        await trigger.click();
        await expect(panel).toBeVisible();
        await page.getByTestId(panelCfg.apply).click();

        // ---------- Final verification ----------

        await expect(panel).toBeHidden();
        await expect(trigger).toBeVisible();

      });
    });
  }

  test.describe(`Games Filters panel applies its draft (${widthName})`, () => {
    test.use({ viewport });
    const sfx = phone ? '-mobile' : '';

    test(`${tid()} Games (${widthName}): a date chosen in the panel applies only on "Show results" and lights up its shortcut`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/play');
      const thisWeek = page.getByTestId(`play-quick-filter-this-week${sfx}`);

      // ---------- Actions ----------

      await page.getByTestId(`play-quick-filter-open${sfx}`).click();
      await page.getByTestId('play-filter-date-this_week').click();

      // ---------- Verify ----------

      // Still a draft.
      await expect(thisWeek).toHaveAttribute('aria-pressed', 'false');

      // ---------- Actions ----------

      const request = page.waitForRequest((r) => r.method() === 'GET' && r.url().includes('/api/play/sessions') && r.url().includes('dateFrom='));
      await page.getByTestId('play-filters-show-results').click();

      // ---------- Verify request ----------

      await request;

      // ---------- Final verification ----------

      await expect(page.getByTestId('play-filters-dialog')).toBeHidden();
      await expect(thisWeek).toHaveAttribute('aria-pressed', 'true');

    });
  });

  test.describe(`Players filters and shortcuts (${widthName})`, () => {
    test.use({ viewport });
    const sfx = phone ? '-mobile' : '';

    test(`${tid()} Players (${widthName}): a level shortcut, the Filters panel and the badge stay in sync`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/players');
      const filters = page.getByTestId(`players-filters-open${sfx}`);
      const intermediate = page.getByTestId(`players-shortcut-level-intermediate${sfx}`);
      await expect(filters).toHaveAccessibleName('Filters');

      // ---------- Actions ----------

      await intermediate.click();

      // ---------- Verify ----------

      await expect(intermediate).toHaveAttribute('aria-pressed', 'true');
      await expect(filters).toHaveAccessibleName('Filters (1 active)');
      await filters.click();
      await expect(page.getByTestId('players-level-Intermediate')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('players-level-all')).toHaveAttribute('aria-pressed', 'false');

      // ---------- Actions ----------

      await page.getByTestId('players-level-Beginner').click();

      // ---------- Verify ----------

      await page.keyboard.press('Escape');
      await expect(intermediate).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId(`players-shortcut-level-beginner${sfx}`)).toHaveAttribute('aria-pressed', 'true');

      // ---------- Actions ----------

      await page.getByTestId(`players-shortcut-level-beginner${sfx}`).click();

      // ---------- Final verification ----------

      await expect(page.getByTestId(`players-shortcut-level-beginner${sfx}`)).toHaveAttribute('aria-pressed', 'false');
      await expect(filters).toHaveAccessibleName('Filters');

    });

    test(`${tid()} Players (${widthName}): "Looking to Play" asks the API for players looking to play and Clear all resets it`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/players');
      const shortcut = page.getByTestId(`players-shortcut-looking-to-play${sfx}`);
      await expect(shortcut).toHaveAttribute('aria-pressed', 'false');

      // ---------- Actions ----------

      const request = page.waitForRequest((r) => r.method() === 'GET' && r.url().includes('/api/players') && r.url().includes('lookingToPlay=true'));
      await shortcut.click();

      // ---------- Verify request ----------

      await request;
      await expect(shortcut).toHaveAttribute('aria-pressed', 'true');

      // ---------- Actions ----------

      await page.getByTestId(`players-filters-open${sfx}`).click();
      await expect(page.getByTestId('players-filter-looking-to-play')).toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId('players-filters-clear-all').click();

      // ---------- Final verification ----------

      await expect(shortcut).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId(`players-filters-open${sfx}`)).toHaveAccessibleName('Filters');

    });

    if (phone) {
      test(`${tid()} Players (phone): "Professional" is not a shortcut on phones but stays in the Filters panel`, async ({ page }) => {

        // ---------- Open page ----------

        await page.goto('/players');

        // ---------- Verify ----------

        await expect(page.getByTestId('players-shortcut-level-professional-mobile')).toBeHidden();
        await page.getByTestId('players-filters-open-mobile').click();
        await expect(page.getByTestId('players-level-Professional')).toBeVisible();

      });
    }
  });

  test.describe(`Coaches filters and shortcuts (${widthName})`, () => {
    test.use({ viewport });
    const sfx = phone ? '-mobile' : '';

    test(`${tid()} Coaches (${widthName}): a price shortcut sets the price filter; one price at a time; Clear all resets it`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/coaches');
      await waitForList(PAGES[2], page);
      const filters = page.getByTestId(`coaches-filters-open${sfx}`);
      const under100 = page.getByTestId(`coaches-shortcut-under-100${sfx}`);
      const under70 = page.getByTestId(`coaches-shortcut-under-70${sfx}`);

      // ---------- Actions ----------

      await under100.click();

      // ---------- Verify ----------

      await expect(under100).toHaveAttribute('aria-pressed', 'true');
      await expect(filters).toHaveAccessibleName('Filters (1 active)');

      // ---------- Actions ----------

      await under70.click();

      // ---------- Verify ----------

      // One price at a time: 70 replaces 100.
      await expect(under100).toHaveAttribute('aria-pressed', 'false');
      await expect(under70).toHaveAttribute('aria-pressed', 'true');
      await expect(filters).toHaveAccessibleName('Filters (1 active)');
      await filters.click();
      await expect(page.getByTestId('coaches-filters-panel')).toContainText('$70/hr');

      // ---------- Actions ----------

      await page.getByTestId(`coaches-clear-filters${sfx}`).click();

      // ---------- Final verification ----------

      await page.keyboard.press('Escape');
      await expect(under70).toHaveAttribute('aria-pressed', 'false');
      await expect(filters).toHaveAccessibleName('Filters');

    });

    test(`${tid()} Coaches (${widthName}): no rating filter or rating shortcuts while coaches have no reviews`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/coaches');

      // ---------- Actions ----------

      await page.getByTestId(`coaches-filters-open${sfx}`).click();

      // ---------- Verify ----------

      const panel = page.getByTestId('coaches-filters-panel');
      await expect(panel).toBeVisible();
      await expect(panel).not.toContainText(/rating/i);
      await expect(page.locator('[data-testid^="coaches-shortcut-top-rated"], [data-testid^="coaches-rating-"]')).toHaveCount(0);

    });

    test(`${tid()} Coaches (${widthName}): the location filter lives in the Filters panel`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/coaches');

      // ---------- Actions ----------

      await page.getByTestId(`coaches-filters-open${sfx}`).click();

      // ---------- Verify ----------

      const location = page.getByTestId(`coaches-location-filter${sfx}`);
      await expect(location).toBeVisible();
      await expect(location).toHaveAccessibleName('Filter by location');
      await expect(location).toContainText('All Sydney');

    });
  });

  test.describe(`Clubs filters and shortcuts (${widthName})`, () => {
    test.use({ viewport });
    const sfx = phone ? '-mobile' : '';
    const trigger = phone ? 'clubs-service-filter-trigger' : 'clubs-more-filters-trigger';

    test(`${tid()} Clubs (${widthName}): an organisation-type shortcut sets the type filter shown in the Filters panel`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/clubs');
      const filters = page.getByTestId(trigger);
      const shortcut = page.getByTestId(`clubs-shortcut-club${sfx}`);
      await expect(filters).toHaveAccessibleName('Filter clubs');

      // ---------- Actions ----------

      await shortcut.click();

      // ---------- Verify ----------

      await expect(shortcut).toHaveAttribute('aria-pressed', 'true');
      await expect(filters).toHaveAccessibleName('Filter clubs (1 active)');
      await filters.click();
      await expect(page.getByTestId(`clubs-category-filter${sfx}`)).toContainText('Tennis Club');

      // ---------- Actions ----------

      await page.getByTestId(`clubs-clear-all-filters${sfx}`).click();

      // ---------- Final verification ----------

      await expect(shortcut).toHaveAttribute('aria-pressed', 'false');
      await expect(filters).toHaveAccessibleName('Filter clubs');

    });

    test(`${tid()} Clubs (${widthName}): all five filters are in one panel`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/clubs');

      // ---------- Actions ----------

      await page.getByTestId(trigger).click();

      // ---------- Verify ----------

      for (const id of ['category', 'surface', 'price', 'location']) {
        await expect(page.getByTestId(`clubs-${id}-filter${sfx}`)).toBeVisible();
      }
      await expect(page.getByTestId(`clubs-services-scroll-area${sfx}`)).toBeVisible();

    });
  });

  test.describe(`Articles category shortcuts (${widthName})`, () => {
    test.use({ viewport });
    const prefix = phone ? 'articles-category-mobile-' : 'articles-category-';

    test(`${tid()} Articles (${widthName}): a category shortcut shows only that category; tapping it again shows all`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/articles');
      await waitForList(PAGES[5], page);
      const cards = PAGES[5].cards(page);
      const allCount = await cards.count();
      const training = page.getByTestId(`${prefix}Training`);

      // ---------- Actions ----------

      await training.click();

      // ---------- Verify ----------

      await expect(training).toHaveAttribute('aria-pressed', 'true');
      for (const other of ['Equipment', 'Health', 'News']) {
        await expect(page.getByTestId(`${prefix}${other}`)).toHaveAttribute('aria-pressed', 'false');
      }
      expect(await cards.count()).toBeLessThanOrEqual(allCount);

      // ---------- Actions ----------

      await training.click();

      // ---------- Final verification ----------

      await expect(training).toHaveAttribute('aria-pressed', 'false');
      await expect(cards).toHaveCount(allCount);

    });

    test(`${tid()} Articles (${widthName}): ?category= in the URL pre-selects the shortcut`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/articles?category=Health');

      // ---------- Verify ----------

      await expect(page.getByTestId(`${prefix}Health`)).toHaveAttribute('aria-pressed', 'true');

    });
  });

  test.describe(`Games shortcuts and smart search (${widthName})`, () => {
    test.use({ viewport });
    const sfx = phone ? '-mobile' : '';

    /** Answers the AI smart search in the browser - nothing reaches the server. */
    async function mockSmartSearch(page: Page) {
      const queries: string[] = [];
      await page.route('**/api/play/smart-search', async (route) => {
        queries.push((route.request().postDataJSON() as { query: string }).query);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            intent: 'FIND_ACTIVITY',
            aiUsed: true,
            resolvedFilters: {
              location: 'Bondi', format: 'social', level: null, gameFormat: null,
              timeOfDay: null, dateFrom: null, dateTo: null,
            },
            sessions: [],
            recommendations: [],
            players: [],
            suggestions: [],
          }),
        });
      });
      return queries;
    }

    test(`${tid()} Games (${widthName}): the Search button runs the smart search with the typed text`, async ({ page }) => {

      // ---------- Test data ----------

      const queries = await mockSmartSearch(page);

      // ---------- Open page ----------

      await page.goto('/play');

      // ---------- Actions ----------

      await page.getByTestId(`play-page-search-input${sfx}`).fill('social tennis in Bondi');
      await page.getByTestId(`play-page-search-submit${sfx}`).click();

      // ---------- Verify request ----------

      await expect.poll(() => queries).toEqual(['social tennis in Bondi']);

      // ---------- Verify ----------

      await expect(page.getByTestId('play-smart-search-result')).toBeVisible();
      await expect(page.getByTestId('play-smart-search-chips')).toContainText('Bondi');
      await expect(page.getByTestId('play-smart-search-no-results')).toBeVisible();

      // ---------- Actions ----------

      // Typing again drops the stale AI answer.
      await page.getByTestId(`play-page-search-input${sfx}`).fill('social tennis in Manly');

      // ---------- Final verification ----------

      await expect(page.getByTestId('play-smart-search-result')).toBeHidden();

    });

    test(`${tid()} Games (${widthName}): Enter runs the smart search; an empty box does not`, async ({ page }) => {

      // ---------- Test data ----------

      const queries = await mockSmartSearch(page);

      // ---------- Open page ----------

      await page.goto('/play');
      const input = page.getByTestId(`play-page-search-input${sfx}`);

      // ---------- Actions ----------

      await input.press('Enter');
      await input.fill('doubles this weekend');
      await input.press('Enter');

      // ---------- Verify request ----------

      await expect.poll(() => queries).toEqual(['doubles this weekend']);
      await expect(page.getByTestId('play-smart-search-result')).toBeVisible();

    });

    test(`${tid()} Games (${widthName}): a "Try" example fills the box and runs that search`, async ({ page }) => {

      // ---------- Test data ----------

      const queries = await mockSmartSearch(page);

      // ---------- Open page ----------

      await page.goto('/play');

      // ---------- Actions ----------

      await page.getByTestId(`play-search-example${sfx}-social-tennis-near-me`).click();

      // ---------- Verify ----------

      await expect.poll(() => queries).toEqual(['Social tennis near me']);
      await expect(page.getByTestId(`play-page-search-input${sfx}`)).toHaveValue('Social tennis near me');

    });

    test(`${tid()} Games (${widthName}): "Social Tennis" asks for social sessions; tapping it again clears it`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/play');
      const social = page.getByTestId(`play-quick-filter-social${sfx}`);
      await expect(social).toHaveAttribute('aria-pressed', 'false');

      // ---------- Actions ----------

      const request = page.waitForRequest((r) => r.method() === 'GET' && r.url().includes('/api/play/sessions') && r.url().includes('format=social'));
      await social.click();

      // ---------- Verify request ----------

      await request;
      await expect(social).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId(`play-quick-filter-open${sfx}`)).toHaveAccessibleName('Filters (1 active)');

      // ---------- Actions ----------

      await social.click();

      // ---------- Final verification ----------

      await expect(social).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId(`play-quick-filter-open${sfx}`)).toHaveAccessibleName('Filters');

    });

    test(`${tid()} Games (${widthName}): "This Week" asks for a date range; "Tournaments" toggles competitions only`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/play');
      const thisWeek = page.getByTestId(`play-quick-filter-this-week${sfx}`);
      const tournaments = page.getByTestId(`play-quick-filter-competitions${sfx}`);

      // ---------- Actions ----------

      const request = page.waitForRequest((r) => r.method() === 'GET' && r.url().includes('/api/play/sessions') && r.url().includes('dateFrom='));
      await thisWeek.click();

      // ---------- Verify request ----------

      await request;
      await expect(thisWeek).toHaveAttribute('aria-pressed', 'true');

      // ---------- Actions ----------

      await tournaments.click();

      // ---------- Verify ----------

      await expect(tournaments).toHaveAttribute('aria-pressed', 'true');
      await tournaments.click();
      await expect(tournaments).toHaveAttribute('aria-pressed', 'false');

    });

    test(`${tid()} Games (${widthName}): "Near Me" needs sign-in for a guest`, async ({ page }) => {

      // ---------- Open page ----------

      await page.goto('/play');

      // ---------- Verify ----------

      const nearMe = page.getByTestId(`play-quick-filter-near-me${sfx}`);
      await expect(nearMe).toBeDisabled();
      await expect(nearMe).toHaveAttribute('title', 'Sign in to filter by your own area');

    });

    if (phone) {
      test(`${tid()} Games (phone): "This Weekend" is not a shortcut on phones`, async ({ page }) => {

        // ---------- Open page ----------

        await page.goto('/play');

        // ---------- Verify ----------

        await expect(page.getByTestId('play-quick-filter-this-weekend-mobile')).toBeHidden();
        await expect(page.getByTestId('play-quick-filter-this-week-mobile')).toBeVisible();

      });
    }
  });
}
