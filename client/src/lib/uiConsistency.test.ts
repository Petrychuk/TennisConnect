// npx tsx --test client/src/lib/uiConsistency.test.ts   (part of npm run test:ui)
//
// Static guards for the button system, header links and the accessibility
// fixes from the 24 Oct 2026 Staging scans. Reads source files only - no
// browser, no build. Each check names the file:line to fix.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLIENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(CLIENT, "src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

/** Opening tags of `tag`, with their raw attribute text (handles {...} and quotes). */
function openingTags(source: string, tag: string): { line: number; attrs: string }[] {
  const out: { line: number; attrs: string }[] = [];
  const re = new RegExp(`<${tag}(?=[\\s>/])`, "g");
  for (let m = re.exec(source); m; m = re.exec(source)) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
    }
    out.push({ line: source.slice(0, m.index).split("\n").length, attrs: source.slice(m.index + m[0].length, i) });
  }
  return out;
}

const files = tsxFiles(SRC).filter((f) => !f.includes(`${path.sep}ui${path.sep}`) && !f.endsWith(" copy.tsx"));
const rel = (f: string) => path.relative(CLIENT, f);
const read = (f: string) => readFileSync(f, "utf8");

test("one shared button radius token, used by the Button component", () => {
  const css = read(path.join(SRC, "index.css"));
  assert.match(css, /--radius-button:\s*0\.75rem;/, "index.css defines --radius-button (12px)");
  const button = read(path.join(SRC, "components/ui/button.tsx"));
  assert.match(button, /rounded-button/);
  assert.doesNotMatch(button, /rounded-(md|lg|xl|full)\b/, "button.tsx uses only the shared token");
  const utils = read(path.join(SRC, "lib/utils.ts"));
  assert.match(utils, /radius:\s*\["button"\]/, "tailwind-merge knows rounded-button");
});

test("standard <Button>s don't override the shared radius (round icon-only buttons excepted)", () => {
  const offenders: string[] = [];
  for (const file of files) {
    for (const { line, attrs } of openingTags(read(file), "Button")) {
      // Round icon-only buttons (size icon, or square with an accessible
      // name / sr-only text, e.g. the support chat launcher) may stay circles.
      const square = /(?<![\w-])h-(\S+) w-\1(?![\w-])|(?<![\w-])w-(\S+) h-\2(?![\w-])/.test(attrs);
      const iconOnly = /size="icon(-sm)?"/.test(attrs) || (square && /aria-label=|data-testid="support-chat/.test(attrs));
      if (iconOnly) continue;
      if (/(?<![\w:-])rounded-(full|xl|2xl|3xl|lg|md|sm)(?![\w-])|(?<![\w:-])rounded(?=[\s"'`])/.test(attrs)) offenders.push(`${rel(file)}:${line}`);
    }
  }
  assert.deepEqual(offenders, [], "remove rounded-* from these Buttons - the button system sets the radius");
});

test("the lime button never gets white text (only ~2:1 contrast)", () => {
  const offenders: string[] = [];
  for (const file of files) {
    for (const { line, attrs } of openingTags(read(file), "Button")) {
      const variant = /variant=/.test(attrs) ? (/variant="([\w-]+)"/.exec(attrs)?.[1] ?? "dynamic") : "default";
      if (variant === "default" && /(?<![\w:-])text-(white|primary-foreground)(?![\w/-])/.test(attrs)) offenders.push(`${rel(file)}:${line}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("every Select trigger has an accessible name (role=combobox doesn't take its name from its text)", () => {
  const offenders: string[] = [];
  for (const file of files) {
    for (const { line, attrs } of openingTags(read(file), "SelectTrigger")) {
      if (!/aria-label(ledby)?=|\bid=/.test(attrs)) offenders.push(`${rel(file)}:${line}`);
    }
  }
  assert.deepEqual(offenders, [], "add aria-label (or an id referenced by a <Label htmlFor>)");
});

test("filter controls use the shared components and the one filter icon", () => {
  const offenders: string[] = [];
  for (const file of files) {
    if (file.endsWith(path.join("shared", "filters.tsx"))) continue;
    const s = read(file);
    for (const m of s.matchAll(/<(Filter|ListFilter|Funnel)\s/g)) offenders.push(`${rel(file)} uses <${m[1]}>`);
    if (/<SlidersHorizontal\b/.test(s) && !file.includes("PlayerOverviewSections")) offenders.push(`${rel(file)} uses <SlidersHorizontal> directly`);
  }
  assert.deepEqual(offenders, [], "use FilterIcon / FilterTrigger / FilterChip from components/shared/filters");
});

test("header: readable idle links, dark-green active links, aria-current, plural link names", () => {
  const nav = read(path.join(SRC, "components/navbar.tsx"));
  const styles = readFileSync(path.join(SRC, "components/navLinkStyles.ts"), "utf8");
  assert.match(styles, /export const NAV_LINK_IDLE = "font-semibold text-foreground hover:text-primary-text";/);
  assert.match(styles, /export const NAV_LINK_ACTIVE = "font-bold text-primary-text";/);
  assert.match(nav, /cn\(NAV_LINK_BASE, isNavActive\(location, link\.href\) \? NAV_LINK_ACTIVE : NAV_LINK_IDLE\)/);
  assert.match(nav, /aria-current=\{isNavActive\(location, link\.href\) \? "page" : undefined\}/);
  assert.doesNotMatch(nav, /hover:text-lime-600"\s*$/m);
  // Menu items name collections, so they are plural.
  for (const [name, href] of [["Players", "/players"], ["Games", "/play"], ["Coaches", "/coaches"], ["Clubs", "/clubs"], ["Travels", "/travels"], ["Articles", "/articles"]]) {
    assert.ok(nav.includes(`{ name: "${name}", href: "${href}"`), `header link ${name} -> ${href}`);
  }
  assert.doesNotMatch(nav + read(path.join(SRC, "components/footer.tsx")), />\s*(Pulse|Escapes|Play|Travel|Clubhouse|Journal)\s*</);
  const css = read(path.join(SRC, "index.css"));
  assert.match(css, /--primary-text: 76 70% 26%;/);
  assert.match(css, /--ring: 76 70% 30%;/);
});

test("every page has a document title (fallback in index.html, recreation detail sets its own)", () => {
  const html = readFileSync(path.join(CLIENT, "index.html"), "utf8");
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.doesNotMatch(html, /maximum-scale/);
  const recreation = read(path.join(SRC, "pages/recreation-detail.tsx"));
  assert.match(recreation, /<SEO\s+title=\{`\$\{svc\.name\} \| TennisConnect`\}/);
});

test("the footer newsletter field has a real label", () => {
  const footer = read(path.join(SRC, "components/footer.tsx"));
  assert.match(footer, /<label htmlFor="footer-newsletter-email"/);
  assert.match(footer, /id="footer-newsletter-email"/);
});

test("admin pages are titled after the sidebar item and share one header", () => {
  const admin = read(path.join(SRC, "pages/admin.tsx"));
  const discovery = read(path.join(SRC, "pages/admin-discovery.tsx"));
  assert.doesNotMatch(admin + discovery, /Content Manager|Australian Tennis Discovery/);
  assert.match(admin, /<AdminPageHeader\s+section=\{activeTab\}/);
  assert.match(discovery, /<AdminPageHeader\s+section="discovery"/);
  const sidebar = read(path.join(SRC, "components/organiser/ui/organiser-sidebar.tsx"));
  for (const key of ["users", '"organizer-requests"', "clubs", "travel", "articles", "recreation", "discovery"]) {
    const ref = key.startsWith('"') ? `ADMIN_SECTIONS[${key}].title` : `ADMIN_SECTIONS.${key}.title`;
    assert.ok(sidebar.includes(ref), `sidebar label comes from ADMIN_SECTIONS (${key})`);
  }
});

test("chip rows never show scrollbars after a click; scrollbars are neutral", () => {
  const filters = read(path.join(SRC, "components/shared/filters.tsx"));
  assert.match(filters, /export const FILTER_CHIP_ROW =\s*"-m-1 flex items-center gap-2 overflow-x-auto p-1 \[scrollbar-width:none\]/);
  const offenders: string[] = [];
  for (const file of files) {
    const s = read(file);
    if (!s.includes("<FilterChip")) continue;
    // A horizontally scrolling row of chips must use FILTER_CHIP_ROW (or hide its scrollbar itself).
    for (const m of s.matchAll(/className="([^"]*overflow-x-auto[^"]*)"/g)) {
      if (/\bflex\b/.test(m[1]) && !m[1].includes("scrollbar-width:none")) offenders.push(`${rel(file)}: ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
  const scroll = read(path.join(SRC, "components/ui/scroll-area.tsx"));
  assert.doesNotMatch(scroll, /tennis-ball/);
  assert.doesNotMatch(read(path.join(SRC, "index.css")), /scrollbar-thumb \{\s*background: (hsl\(var\(--tennis-ball\)\)|rgba\(180)/);
});

test("page heroes share the HeroBadge label and the readable title shadow", () => {
  const css = read(path.join(SRC, "index.css"));
  assert.match(css, /\.tc-hero-badge \{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.tc-hero-badge \{\s*animation: none;/);
  assert.match(css, /\.tc-hero-text \{\s*text-shadow:/);
  const heroes = ["components/hero.tsx", "pages/partners.tsx", "pages/coaches.tsx", "pages/clubs.tsx", "pages/travel.tsx", "pages/articles.tsx", "pages/play.tsx", "pages/recreation.tsx", "pages/marketplace.tsx"];
  for (const file of heroes) {
    const s = read(path.join(SRC, file));
    assert.match(s, /<HeroBadge[\s>]/, `${file} uses <HeroBadge>`);
    assert.doesNotMatch(s, /rounded-full bg-(primary\/20|black\/50) border border-(primary\/30|white\/20) backdrop-blur-md/, `${file} has no old translucent pill`);
    for (const { line, attrs } of openingTags(s, "h1")) {
      if (/text-white/.test(attrs)) assert.match(attrs, /tc-hero-text/, `${file}:${line} hero h1 has tc-hero-text`);
    }
    assert.match(s, /<p className="[^"]*tc-hero-intro[^"]*"/, `${file}: the hero intro sits on the tc-hero-intro plate`);
    assert.doesNotMatch(s, /<p className="[^"]*tc-hero-intro[^"]*text-white\/\d+/, `${file}: the hero intro is full white`);
  }
  assert.match(css, /\.tc-hero-intro::before \{[^}]*radial-gradient/);
  assert.doesNotMatch(css, /\.tc-hero-intro \{[^}]*(border-radius|padding)/, "the intro has no visible box");
});

test("hero photos use English, descriptive file names", () => {
  const images = readdirSync(path.join(CLIENT, "public/assets/images"));
  for (const name of ["travels-hero-cote-dazur.webp", "travels-hero-cote-dazur-mobile.webp", "games-hero-sydney-harbour.webp", "games-hero-sydney-harbour-mobile.webp"]) {
    assert.ok(images.includes(name), `${name} exists`);
  }
  const refs = read(path.join(SRC, "pages/travel.tsx")) + read(path.join(SRC, "pages/play.tsx")) + readFileSync(path.join(CLIENT, "index.html"), "utf8");
  assert.doesNotMatch(refs, /hurbord|play-hero-(desktop|mobile)/);
});

test("every menu page uses the shared hero search pill and keeps its test ids", () => {
  const pages: [string, string[], boolean][] = [
    ["pages/play.tsx", ["play-page-search-input", "play-page-search-input-mobile", "play-quick-filter-open"], true],
    ["pages/partners.tsx", ["players-search-input", "players-search-input-mobile", "players-filter-looking-to-play"], true],
    ["pages/coaches.tsx", ["coaches-search-input", "coaches-search-input-mobile"], true],
    ["pages/clubs.tsx", ["clubs-search-input", "clubs-search-input-mobile", "clubs-more-filters-trigger", "clubs-service-filter-trigger"], true],
    ["pages/travel.tsx", ["travel-search-input", "travel-search-input-mobile"], false],
    ["pages/articles.tsx", ["articles-search-input", "articles-search-input-mobile"], false],
  ];
  for (const [file, ids, hasFiltersPanel] of pages) {
    const s = read(path.join(SRC, file));
    assert.equal((s.match(/<HeroSearch\b/g) ?? []).length, 2, `${file}: one pill for tablet/desktop, one for phones`);
    assert.match(s, /tone="light"/, `${file}: the phone pill sits on the page background`);
    if (hasFiltersPanel) assert.match(s, /<HeroSearchFiltersButton\b/, `${file} opens its filters from the pill`);
    for (const id of ids) assert.ok(s.includes(`"${id}"`) || s.includes(`"${id}\${`) || s.includes(id), `${file} keeps data-testid ${id}`);
    // The old frosted filter card is gone - no block around the search.
    assert.doesNotMatch(s, /bg-card\/50 backdrop-blur/, `${file} has no filter card`);
    // No select boxes next to the search any more - they live in the Filters panel.
    assert.doesNotMatch(s, /\{\/\* Filter (& Search )?Bar \((desktop|mobile)/i, `${file} has no old filter bar`);
  }
  const players = read(path.join(SRC, "pages/partners.tsx"));
  assert.doesNotMatch(players, /<SelectTrigger/, "Players: the level select moved into the Filters panel as chips");
  const quick = read(path.join(SRC, "components/play/PlayQuickFilters.tsx"));
  assert.match(quick, /<HeroShortcuts\b/);
  assert.doesNotMatch(quick, /useQuery|fetch\(/, "shortcuts only flip existing filters");
});

test("hero search: thin focus outline, at most 4 shortcuts on phones", () => {
  const hs = read(path.join(SRC, "components/shared/hero-search.tsx"));
  assert.match(hs, /focus-within:border-primary-text/);
  assert.doesNotMatch(hs, /focus-within:ring-2/, "no thick focus ring on the pill");
  assert.match(hs, /maxOnPhone = 4/);
  assert.match(hs, /index >= maxOnPhone && "max-md:hidden"/);
});

test("filter panels: one shared panel (dropdown on tablet/desktop, modal on phones) on every page that has filters", () => {
  for (const file of ["pages/play.tsx", "pages/partners.tsx", "pages/coaches.tsx", "pages/clubs.tsx"]) {
    const s = read(path.join(SRC, file));
    assert.match(s, /<HeroFiltersPanel\b/, `${file} uses <HeroFiltersPanel>`);
    assert.doesNotMatch(s, /<PopoverContent\b|<DialogContent[^>]*data-testid="play-filters-dialog"/, `${file} has no page-specific filter popover/dialog`);
  }
  const panel = read(path.join(SRC, "components/shared/hero-filters.tsx"));
  assert.match(panel, /useIsMobile\(\)/);
  assert.match(panel, /<Dialog open=\{open && isCurrent\}/, "phones: a modal");
  assert.match(panel, /<Popover open=\{open && isCurrent\}/, "tablet/desktop: a dropdown");
  const coaches = read(path.join(SRC, "pages/coaches.tsx"));
  assert.doesNotMatch(coaches, /Minimum Rating|coaches-shortcut-top-rated/, "no rating filter until coaches have reviews");
});

test("hero readability: left shade on tablet/desktop only, 20px intro, same top spacing, brand shadow on Connect", () => {
  const css = read(path.join(SRC, "index.css"));
  assert.match(css, /\.tc-hero-left-shade \{\s*background: linear-gradient\(\s*to right/);
  assert.match(css, /\.tc-brand-connect \{\s*text-shadow:/);
  assert.match(read(path.join(SRC, "components/ui/brandBall.tsx")), /tc-brand-connect/);
  for (const file of ["pages/play.tsx", "pages/partners.tsx", "pages/coaches.tsx", "pages/clubs.tsx", "pages/travel.tsx", "pages/articles.tsx"]) {
    const s = read(path.join(SRC, file));
    assert.match(s, /tc-hero-left-shade absolute inset-0 hidden md:block/, `${file}: left shade, tablet/desktop only`);
    assert.match(s, /md:text-\[20px\]/, `${file}: 20px intro on tablet/desktop`);
    assert.match(s, /md:pt-\[104px\]/, `${file}: same header-to-label gap as the other pages`);
  }
});

test("accent is the deck's soft lime; the logo keeps its own colours", () => {
  const css = read(path.join(SRC, "index.css"));
  assert.match(css, /--primary: 73 71% 61%;/, "#C3E254");
  assert.match(css, /--primary-foreground: 240 10% 3\.9%;/, "near-black text on the lime");
  assert.match(css, /--tennis-ball: 75 90% 60%;/, "main logo colour unchanged");
  assert.match(css, /--logo-connect: 78 85% 42%;/);
  for (const file of ["components/organiser/ui/organiser-sidebar.tsx", "components/organiser/ui/organiser-bar-logo.tsx", "pages/organiser/session-live.tsx"]) {
    const s = read(path.join(SRC, file));
    assert.doesNotMatch(s, /Tennis<span className="text-primary"><ConnectWord/, `${file}: logo doesn't follow the accent`);
  }
});

test("v11: buttons sized to content, instant-closing menus, readable statuses, breadcrumbs, site loader", () => {
  const auth = read(path.join(SRC, "pages/auth.tsx")) + read(path.join(SRC, "pages/reset-password.tsx"));
  assert.doesNotMatch(auth, /w-2\/3/, "auth buttons are sized to their text");
  assert.match(read(path.join(SRC, "components/play/EventQuickViewModal.tsx")), /<Button className="mx-auto flex w-fit min-w-44 px-8" asChild data-testid="event-modal-view-original">/);
  for (const ui of ["select", "dropdown-menu", "popover"]) {
    assert.doesNotMatch(read(path.join(SRC, `components/ui/${ui}.tsx`)), /data-\[state=closed\]/, `${ui} closes instantly`);
  }
  assert.match(read(path.join(SRC, "lib/season-utils.ts")), /active: "bg-primary\/20 text-primary-text"/);
  assert.match(read(path.join(SRC, "components/ui/checkbox.tsx")), /border border-primary-text/);
  for (const page of ["sessions", "seasons", "players", "rankings", "reports", "messages"]) {
    assert.match(read(path.join(SRC, `pages/organiser/${page}.tsx`)), /<OrganiserBreadcrumb current=/, `${page} has the Home breadcrumb`);
  }
  assert.match(read(path.join(SRC, "components/admin/AdminPageHeader.tsx")), /<OrganiserBreadcrumb current=\{title\}/);
  const inbox = read(path.join(SRC, "components/messages/MessagesInbox.tsx"));
  assert.match(inbox, /<DelayedTennisLoader text="Loading messages…" \/>/);
  assert.doesNotMatch(inbox, /<TennisBallSpinner/);
});

test("hero photos: responsive files exist and index.html preloads exactly what HeroPhoto renders", async () => {
  const { HERO_IMAGES } = await import("./heroImages");
  const images = new Set(readdirSync(path.join(CLIENT, "public/assets/images")));
  const html = readFileSync(path.join(CLIENT, "index.html"), "utf8");
  const routes: Record<string, string> = { players: "/players", coaches: "/coaches", articles: "/articles", clubs: "/clubs", travels: "/travels", games: "/play" };
  for (const [key, hero] of Object.entries(HERO_IMAGES)) {
    for (const w of hero.widths) assert.ok(images.has(`${hero.base}-${w}.webp`), `${hero.base}-${w}.webp exists`);
    const mobile = (hero as { mobile?: { file: string; maxWidth: number } }).mobile;
    if (mobile) assert.ok(images.has(mobile.file), `${mobile.file} exists`);
    const expected = mobile
      ? `"${routes[key]}": ["${hero.base}", [${hero.widths.join(", ")}], "${mobile.file}", ${mobile.maxWidth}]`
      : `"${routes[key]}": ["${hero.base}", [${hero.widths.join(", ")}]]`;
    assert.ok(html.includes(expected), `index.html preload table has ${expected}`);
  }
  for (const page of ["partners", "coaches", "articles", "clubs", "travel", "play"]) {
    const s = read(path.join(SRC, `pages/${page}.tsx`));
    assert.match(s, /<HeroPhoto\b/, `${page}.tsx renders its hero through HeroPhoto`);
    assert.doesNotMatch(s, /src="\/assets\/images\/(dashboard_players|Dashboard_articles|Dashboard_club)\.webp"/);
  }
});

test("directory pages never show their empty state while the list is still loading", () => {
  const checks: [string, RegExp][] = [
    ["pages/coaches.tsx", /\{!loading && !loadError && filteredCoaches\.length === 0 && \(/],
    ["pages/partners.tsx", /\{!loading && filteredPartners\.length === 0 && \(/],
    ["pages/clubs.tsx", /loading && filteredClubs\.length === 0 \?/],
    ["pages/travel.tsx", /\{!loaded \? \(/],
    ["pages/articles.tsx", /\{!loaded \? \(/],
  ];
  for (const [file, pattern] of checks) assert.match(read(path.join(SRC, file)), pattern, file);
});

test("complete-profile: logo + Sign out header, compact responsive grid, dark-green level dots, auth-width Save", () => {
  const s = read(path.join(SRC, "pages/complete-profile.tsx"));
  assert.match(s, /data-testid="complete-profile-logo"/);
  assert.match(s, /<ConnectWord \/>/);
  assert.match(s, /data-testid="complete-profile-logout"/);
  assert.equal((s.match(/grid gap-5 md:grid-cols-2 md:gap-4/g) ?? []).length, 2, "country + city on one row (player and coach)");
  assert.match(s, /grid gap-2 sm:grid-cols-2" role="radiogroup"/, "skill levels 2 x 2 from tablet up");
  assert.match(s, /i < level\.dots \? "bg-primary-text"/, "level dots use the dark green text colour");
  assert.equal((s.match(/mx-auto flex w-fit min-w-44 px-8 items-center justify-center transition-opacity/g) ?? []).length, 2, "Save sized like the auth buttons");
});

test("message modal Send and profile Sign In buttons are sized like the auth / Message buttons", () => {
  assert.match(read(path.join(SRC, "components/messaging/QuickMessageModal.tsx")), /className="mx-auto flex w-fit min-w-44 px-8"/);
  for (const f of ["components/profile/shared/MySessionsSection.tsx", "components/profile/shared/MyClubsSection.tsx"]) {
    const s = read(path.join(SRC, f));
    assert.match(s, /<Button asChild className="min-w-\[150px\]"/, f);
    assert.doesNotMatch(s, /<Button asChild size="sm" data-testid=[^>]*sign-in/, f);
  }
});

test("home page on phones: 40px section padding, 26px headings, compact cards with icon + title on one line; desktop unchanged", () => {
  for (const f of ["components/about-us.tsx", "components/features.tsx", "components/home-clubs.tsx", "components/home-travel.tsx", "components/home-articles.tsx", "components/partnership.tsx", "components/gallery.tsx", "pages/home.tsx"]) {
    const s = read(path.join(SRC, f));
    assert.match(s, /py-10 md:py-24/, `${f}: 40px top/bottom on phones, 96px from tablet up`);
    assert.match(s, /text-\[26px\] md:text-5xl/, `${f}: 26px section heading on phones`);
  }
  const about = read(path.join(SRC, "components/about-us.tsx"));
  assert.match(about, /mt-\[30px\] md:mt-20 grid grid-cols-2/, "stats 30px below the cards on phones");
  assert.match(about, /flex items-center gap-2\.5 mb-2 md:block/, "value cards: icon + title in one row on phones");
  assert.match(read(path.join(SRC, "components/features.tsx")), /flex items-center gap-3 mb-2 md:block/, "Discover cards: icon + title in one row on phones");
});
