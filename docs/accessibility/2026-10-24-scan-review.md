# Accessibility scan review: 24 October 2026

Two automated scans were reviewed against the code on `main` (1c7e30b):

- **A11y Pulse**: 31 pages, score 82, 38 issue occurrences in 5 failed audits.
- **Skynet Technologies Free Accessibility Checker**: the Staging home page.

Automated results are a starting point, not a compliance statement. Every
finding below was checked in the source. "Fixed" means the cause was found
and changed. "Not reproduced" means the current code no longer has it.

**Most A11y Pulse URLs were Production.** The crawler followed canonical
links to `www.tennisconnect.com.au`, so most of its pages were Production,
which runs an older commit than `main`. A few of those findings were
already fixed on `main` before this work. They are marked "Not reproduced".

## A11y Pulse

| Audit | Pages | Cause found | Status |
|---|---|---|---|
| Buttons must have discernible text (critical) | /clubs (3), /marketplace (1) | Radix `SelectTrigger` renders `<button role="combobox">`, and a combobox doesn't take its name from its text. /clubs has 3 visible filter selects; /marketplace has 1. | **Fixed**: `aria-label` on all 42 unlabelled select triggers site-wide. Guard test added. |
| | /travels/mallorca-tennis-camp-7d (1) | Not reproduced. The gallery controls on `main` already have labels. | Not reproduced. Re-check after deploy. |
| | (found while reviewing) | Icon-only buttons with no name: Organiser Hub menu triggers (12), row and session menus (6), photo/cover edit, copy link, call buttons on club pages, gallery dots, a help tooltip trigger. | **Fixed** (`aria-label`). |
| Colour contrast (serious) | 18 pages | `text-primary` (lime `#90C610`) used as text on light backgrounds: about 2:1, needs 4.5:1. Includes header links, legal-page links and numbered headings, card labels, "Find Your Player"-style accents, and the active state of the clubs filter selects. Other causes: lime buttons with white text (hero "Find a Player", retreat "Book Now"); `--destructive` red at 3.8:1. | **Fixed**: lime text on light backgrounds uses `--primary-text` (dark brand green, about 5:1); about 210 elements. Lime stays on dark sections and photos. Buttons always use near-black text on lime. `--destructive` is now `0 72% 45%` (5.6:1). |
| Text must remain readable when spacing is increased (serious) | /clubs (60) | Club cards had a fixed height (`xl:h-[500px]`), a fixed-height services row with `overflow-hidden`, and fixed-height service badges. Measured: the services row lost 28px of text at 390px wide with WCAG text spacing applied. | **Fixed**: `min-h-*` instead of fixed heights; nothing is clipped now. |
| | home (3), staging home (2), /articles, /tournaments, /travels, two article pages (1 each) | Not pinned to a single element (the report gives counts only). Likely causes: one-line truncated card titles (`line-clamp-1`), two-line truncated excerpts, and the brand marquee. All are deliberate truncations, and each card links to the full content. | **Follow-up**: re-scan after deploy for exact elements. If they are the card titles, use two-line clamps or wrap. |
| Documents must have a `<title>` (serious) | /recreation/* (5) | The recreation detail page's `<SEO>` was commented out (`! not done yet`). `index.html` had no fallback `<title>`, so loading states had none. | **Fixed**: the detail page sets its title, including the loading and not-found states. `index.html` has a fallback title. |
| Heading levels should only increase by one (moderate) | /marketplace, /recreation, /tournaments, /travels | Card titles were `h3` straight after the page `h1`. Empty-state headings were `h3`. | **Fixed**: visually hidden `h2` section headings (as on /players), and `h2` empty states. |

## Skynet

| Check | Finding | Status |
|---|---|---|
| Forms: field labels | Footer newsletter email had only a placeholder | **Fixed**: real `<label>` (visually hidden), `id`, `autocomplete="email"`. The button text changed from "OK" to "Subscribe". |
| Document: viewport scaling | `maximum-scale=5` flagged | **Fixed**: removed. It never blocked zoom, but nothing needs it. |
| Titles: page must contain an `h1` | Flagged on the home page | Not reproduced. The hero has an `h1`. Probably measured before the client rendered. Re-check after deploy. |
| Readability: contrast (50) | Many items are text on photos, gradients or mid-animation (`opacity: 0`), which the checker can't measure. Real ones: lime text on light sections ("Lifestyle", "Tennis World", "Knowledge Hub", "Transform."), the green email link in the dark partnership block (it used the dark green on black), cookie banner buttons. | **Fixed** where real (see the contrast row above). The partnership and home-clubs links now use lime on their dark backgrounds. |
| Text spacing, ARIA, popups | Passed | n/a |

## Related changes in the same branch

- **Header links:**
  - Idle links are foreground (near-black) semibold: 19:1.
  - Hover and active links are dark brand green: 5.05:1 on the header background.
  - The active link also gets bold weight, an underline bar and `aria-current="page"`.
  - The header background is 95% opaque (was 80%), so content scrolling underneath can't grey the links out.
  - Mobile drawer and bottom nav: same colours, plus `aria-current`.
  - Overlaps TC-136 (contrast).
- **Focus ring:** `--ring` changed from lime (about 1.6:1) to `78 85% 30%`, which is 3.7:1 on the page background.
- **Button system** (`components/ui/button.tsx`):
  - One radius token, `--radius-button` (12px, `rounded-button`).
  - Sizes: sm 32px, default 40px, lg 48px, icon 40px.
  - Typography: Inter semibold.
  - Variants: default, secondary, outline, ghost, destructive, inverse (new, for dark sections and photos), link.
  - Shared hover, press, focus and disabled states.
  - Pages no longer set their own radius or variant colours. A guard test enforces this.
  - Inputs and select triggers are now 40px to line up with buttons.
- **Filters** (`components/shared/filters.tsx`): one icon, a `FilterTrigger` and a `FilterChip` (`aria-pressed`). Used on players, coaches, clubs, articles, tournaments, recreation, play and the Organiser Hub.
- **Nav link names:** "Pulse" → "Play", "Escapes" → "Travel" (header, drawer, footer).
- **Retreat cards** (`lib/travelStatus.ts`):
  - A retreat is "Archived" from 00:00 Sydney time on the day after its last day, or when it is inactive.
  - Upcoming retreats are listed before archived ones.
  - Applied on /travels and in the home section.

## Verification done (no deployment)

- **Unit and guard tests:** `npm run test:ui`, 19 tests: retreat dates, timezones and ordering; the button, header, select, filter and title guards.
- **Rendered check:** the app's real CSS (Tailwind 4 compiled from `index.css`), real components, Chromium:
  - All button variants, sizes and states are at least 4.5:1, except disabled, which is exempt.
  - Every button has a 12px radius.
  - The focus ring is 3.69:1.
  - Retreat order and the Archived label are correct.
  - Nothing is clipped under WCAG text spacing.
  - No horizontal scroll at 390px.
- **Client bundle:** 298 modules, no errors.

## Still to do before closing

1. Deploy to Staging (after review and merge).
2. Re-run A11y Pulse and Skynet on Staging. Record the scores here and pin down any remaining text-spacing elements.
3. Manually check:
   - keyboard focus through the header, drawer, filters and dialogs;
   - text spacing with a bookmarklet on /clubs, the home page and /travels;
   - desktop and mobile layouts of hero CTAs, filter bars and Organiser Hub toolbars;
   - a mix of upcoming and past retreats, past-only, and none.

## Follow-up changes (v2, from review on 27 Oct)

- **Filter chip rows:** a shared row style, `FILTER_CHIP_ROW`:
  - phones get one swipeable row with the scrollbar hidden;
  - tablet and desktop wrap the chips;
  - 4px of inner padding keeps the focus ring inside the row.

  Clicking a chip no longer shows scrollbars, for example on /articles.
- **Scrollbars are neutral and thin everywhere.** The lime scroll thumb looked like a long bright button down the support chat. The support chat header text is near-black on lime, and its icon buttons have names.
- **Admin pages:** each page is titled after the sidebar item that opened it (Users, Organiser & Sessions, Club Communities, Travel Packages, Articles, Recreation Services, Discovery) instead of "Content Manager".
  - One shared header shows the title, a one-line description and the actions.
  - "New article", "New package" and the other create buttons use the standard button.
- **Admin tables:**
  - Row actions are shared, labelled icon buttons that wrap on narrow screens.
  - Columns that don't fit are hidden on phones, and their values move under the item name.
  - Filters stack in two columns on phones.
- **Discovery:**
  - Uses the shared header.
  - The Review queue and Sources tabs have tab semantics and the dark-green underline.
  - The status counts are filter chips.
  - Item cards stack on phones.
- **Header links:** 16px on desktop (the tablet drawer was already 16px). The gap between links is 24px, and 32px from 1536px wide.

## Follow-up changes (v3, from review on 28 Oct)

- **Menu names are plural**, because each item opens a collection: Players, Games, Coaches, Clubs, Travels, Articles. Header, mobile drawer, footer and the mobile bottom bar.
  - /play is now "Games". The page is a search for a game to join, social tennis or competition, and its title is already "Find a Game".
  - Clubhouse became "Clubs", and Journal became "Articles".
  - The URLs are unchanged.
- **Hero labels** ("Now live in Sydney", "Find best player" and the rest) use one shared component, `HeroBadge` (`components/shared/hero-badge.tsx`):
  - an opaque near-black pill, so the white text no longer blends into the photo;
  - a lime tracer runs round the border like a ball along the court line, and the dot pings like a ball landing;
  - both animations stop under `prefers-reduced-motion`, which leaves a static lime border.
  - Used on home, /players, /coaches, /clubs, /travels, /articles, /play, /recreation and /marketplace.
- **Hero titles and intros** get a layered text shadow (`.tc-hero-text`) instead of the faint `drop-shadow`, so they stay readable on bright parts of the photos.

## Follow-up changes (v4, 28 Oct)

- **Hero intro lines** (the text under each title) sit on a soft dark glass plate (`.tc-hero-intro`) in full white. On bright photos the shadow alone wasn't enough.
- **New hero photos**, as optimised WebP files with English names:
  - /travels: `travels-hero-cote-dazur.webp` (1920×640, 143 KB; was 295 KB) and `-mobile.webp` (900×675);
  - /play: `games-hero-sydney-harbour.webp` (1920×647) and `-mobile.webp` (900×516, 55 KB; was 97 KB).
  - The old `hurbord_tennis*` and `play-hero-*` files are removed.
  - The early preload in `index.html` points to the new files.

## Follow-up changes (v5, 28 Oct)

- **The /play (Games) hero now has the same structure as the other pages:**
  - the photo fades into the page;
  - `HeroBadge` sits above a left-aligned title, with "Game" in lime and the brush underline;
  - the intro line sits on its plate;
  - the search card floats over the tail of the photo, with "Try:" examples under it.
- **Phones (below 768px)** follow the other pages too: the photo with the small badge on its bottom edge, then the title (with "Game" in dark green), the intro and the search below it.
- **The switch point moved from 640px to 768px**, the same as the other heroes. The image preloads in `index.html` and Helmet match it.
- **Unchanged:** test ids (`play-page-title`, `play-page-search-input`, their `-mobile` variants and the example buttons). The search inputs now have an `aria-label`.

## Follow-up changes (v6, 28 Oct): hero search on Games and Players

- **New shared component** `components/shared/hero-search.tsx`. It only handles presentation: every value and handler still comes from the page. It has three parts:
  - `HeroSearch` is a white pill with an icon, the input, the Filters button and a lime search button (`form role="search"`). It is on the photo on tablet and desktop, and below the hero text on phones.
  - `HeroSearchFiltersButton` is a round sliders button with an active-count badge.
  - `HeroShortcuts` is a row of round icon toggles (`aria-pressed`). It wraps on tablet and desktop and is swipeable on phones.
- **Games (/play):**
  - The lime button and Enter run the smart search, as Enter did before.
  - The sliders button opens the existing Filters dialog.
  - The quick filters became icon shortcuts: Tournaments (competitions only), Social Tennis (format = social), Near Me, This Week and This Weekend. Each one switches an existing filter only.
  - The old chip row above the results is gone.
- **Players:**
  - The Level select moved into the Filters panel as chips, next to "Looking to Play".
  - Shortcuts: Looking to Play, Beginner, Intermediate, Advanced and Professional, using the same state as before.
  - Filtering stays live while typing; the lime button scrolls to the results.
- **Unchanged:** filtering logic and query keys. The test ids the e2e tests use are kept (`play-page-search-input`, `players-search-input` and others).
- **Next:** Coaches, Clubs, Travels and Articles get the same treatment once this is approved.

## Follow-up changes (v7, 28 Oct): hero search on every menu page, and tests

- **The pill** now has a thin 1px dark-green outline on focus, instead of the thick 2px ring with its offset.
  - Desktop sizes went up: a 68px pill, 18px input text, 56px shortcut circles and 16px labels.
- **Phones** show at most 4 shortcuts (`maxOnPhone`), so the row fits without scrolling. The rest stay in the Filters panel.
- **The intro under each hero title** no longer sits on a dark plate. It gets a soft, feathered darkening (a radial gradient on `::before`) with no edges, and is 24px from 1024px wide.
- **Phones:** the space above the hero title and between the title and the search is halved on every page.
- **Coaches:**
  - Location moved into the Filters panel, next to price and rating.
  - Shortcuts: Top Rated (4.8+), 4.5+ Stars, Under $100 and Under $70. They set the same values the panel sets.
- **Clubs:**
  - One Filters panel at every width: type, surface, price, location and services.
  - The organisation types are the shortcuts.
  - Test ids are unchanged: `clubs-*-filter` on desktop and `clubs-*-filter-mobile` on phones.
- **Travels:** the search pill only. There are no other filters on that page.
- **Articles:** the categories (Training, Equipment, Health, News) are the shortcuts. Tapping the selected one shows all again.
- **Results:** the lime button and Enter scroll to the results, which have new anchors (`#players-results`, `#coaches-results`, `#clubs-results`, `#travel-results`, `#articles-results`). Travel and article cards got test ids.
- **Tests:** `tests/public/hero-search.spec.ts` has 84 guest-only, read-only tests (SEARCH-001..084) on desktop and phone for all six pages.
  - They cover the pill and labels, no-match and clearing, the Search button and Enter, the Filters button and its badge, shortcuts synced with the panel, 4 shortcuts on phones, the 1px focus outline, and no sideways scroll.
  - The Games smart-search POST is answered inside the browser.
  - They are listed as local-only in `tests/safety/staging-phases.ts` until they are reviewed for the Staging read-only set.

## Follow-up changes (v8, 28 Oct)

- **Phones:** the gap between the hero label and the title is half what it was (52px down to 26px) on every page with the hero search. The spacer under the hero photo is 6px on phones (was 32px), so the title and everything below it move up. Tablet and desktop are unchanged.

## Follow-up changes (v9, 28 Oct)

- **Logo:** "Connect" (lime) gets a soft, layered dark text shadow under the letters (`.tc-brand-connect`), with a matching drop shadow on the ball. It is set once in `ConnectWord`, so it applies everywhere the logo appears.
- **Tablet and desktop heroes:**
  - The photo darkens smoothly towards its left edge across the left half (`.tc-hero-left-shade`, eased stops, no visible edge). Phones are unchanged.
  - The intro is 22px with a 1.3 line height (was 24px/1.625).
- **Games "Try" examples** are small dark glass pills. The white links disappeared on the bright photo.
- **One Filters panel on every page with filters** (`components/shared/hero-filters.tsx`), the same on Games, Players, Coaches and Clubs:
  - tablet and desktop: a dropdown under the Filters button, with a title, a close button and a "Clear all / Show results" footer;
  - phones: a modal with a title, a close (X) button and the same footer, so it is clear how to finish.
  - Games keeps its draft behaviour: "Show results" applies the draft. Its dialog is now the shared panel, and its fields are `PlayFilterFields`.
  - Section labels share one style (small uppercase with an icon).
- **Coaches:** the rating filter and the rating shortcuts are hidden until coaches have real reviews (cards show "(0)"). The `minRating` logic stays. The shortcuts are now Under $50, Under $70 and Under $100.
- **Tests:**
  - `hero-search.spec.ts` now has 94 tests (SEARCH-001..094). New ones cover the panel as a dropdown or a modal with open, close and "Show results", the Games draft that applies only on "Show results", and no rating filter on Coaches.
  - Local-only list updated.

## Follow-up changes (v10, 28 Oct): accent colour from the deck

- **New brand accent:** `--primary` is the soft lime from the TennisConnect deck, `#C3E254` (`73 71% 61%`), in light and dark themes.
  - `--primary-foreground` is near-black: 13.6:1 on the lime. White on it would only be 1.5:1.
- **Green text on light backgrounds** (`--primary-text`) is the matching olive `#5A7314`:
  - 5.4:1 on white;
  - 4.7:1 on the pale lime `--accent` (`#EFF2DB`).
  - Lime text on light would only be 1.3:1.
- **Focus ring:** olive `76 70% 30%`.
- **Logo unchanged:**
  - the main logo keeps `--tennis-ball`;
  - the Organiser Hub logos used `text-primary`, so they now use a fixed `--logo-connect` (the old colours: `78 85% 42%` light, `75 90% 55%` dark).
- **Not changed:** 21 hard-coded Tailwind `lime-*` classes, mostly in the admin club forms and profile covers. They don't follow the accent.

## Follow-up changes (v11, 28 Oct)

- **Buttons sized to their text** (with a 176px minimum), not two-thirds or full width:
  - Sign In, Create Account and every password-recovery button (`auth.tsx`, `reset-password.tsx`);
  - the action button in the event quick-view modal (View original, Sign in to Register, Join...).
- **Heroes:**
  - The intro is 20px on tablet and desktop.
  - Every page except home starts its content the same distance under the header as Coaches: a measured 39px from the header to the label at 820, 1024 and 1440px. Before, the gap was 15px on most pages, and Coaches overlapped the header at 1024px.
- **Menus close instantly:** the closing animations were removed from Select, DropdownMenu, Popover, ContextMenu, Menubar, HoverCard and Tooltip, so a picked item's menu disappears on click.
- **Organiser Hub:**
  - Seasons: the search sits in the same row as the status chips on tablet and desktop, and drops to a second row on phones.
  - Pale-lime status and level badges ("Active", "Advanced", "registered", "paid"...) use dark olive text on a slightly stronger tint.
  - Checkbox and radio borders are olive, so they are visible.
  - A shared "Home > page" breadcrumb (`OrganiserBreadcrumb`) is on Sessions, Seasons, Players, Rankings, Reports and Messages, and on every Admin page through `AdminPageHeader`.
  - Messages uses the site's page loader (the full-size ball, after the usual short delay) instead of the small button spinner.
- **Remaining lime text and icons on light backgrounds** (90 elements in 40 files) moved to the olive `--primary-text`, because the softer accent is only 1.4:1 on white. Lime stays on dark sections and photos, including the accent words in hero titles.
