// npm run test:ui
//
// Organiser Hub, Phase 2 Batch 1 (docs/organiser-hub/FUNCTIONAL_AUDIT.md):
// one layout and access rule for every page, no mock data on screen, and no
// control that looks real but does nothing. Source-level checks - they keep
// the fixes from quietly coming back.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Source without comments, so an explanatory comment that names an old
// mock ("mockStatStrip showed ...") doesn't count as using it.
const read = (rel: string) =>
  readFileSync(path.join(SRC, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const PAGES = readdirSync(path.join(SRC, "pages/organiser")).filter((f) => f.endsWith(".tsx"));

test("every Organiser Hub page uses the shared layout / access gate, and none redirects during render", () => {
  for (const page of PAGES) {
    const src = read(`pages/organiser/${page}`);
    const usesShell = /OrganiserLayout|OrganiserAccessGate|<OrganiserDashboard\b/.test(src);
    assert.ok(usesShell, `${page}: use OrganiserLayout`);
    assert.doesNotMatch(src, /setLocation\("\/auth"\)/, `${page}: no render-time redirect`);
    assert.doesNotMatch(src, /mockOrganiser/, `${page}: no mock organiser`);
  }
  const dashboard = read("components/organiser/dashboard/organiser-dashboard.tsx");
  assert.match(dashboard, /<OrganiserAccessGate>/);
  const layout = read("components/organiser/ui/organiser-layout.tsx");
  assert.match(layout, /useEffect\(\(\) => \{\s*if \(!loading && !isAuthenticated\)/, "guests are redirected from an effect");
  assert.match(layout, /!!user\.isOrganizer \|\| !!user\.isAdmin/, "same rule as the API's requireOrganizer");
});

test("dashboard: no invented numbers, no artificial delay, real organisation link", () => {
  const dashboard = read("components/organiser/dashboard/organiser-dashboard.tsx");
  assert.doesNotMatch(dashboard, /mockStatStrip|setTimeout\(\(\) => setLoading/, "no mock stat strip or 400 ms delay");
  assert.match(dashboard, /organizationSlug=\{orgQuery\.data\?\.slug \?\? null\}/, "no mock organisation slug fallback");
  const quick = read("components/organiser/dashboard/quick-actions-card.tsx");
  assert.doesNotMatch(quick, /lyne-park-tennis/);
  assert.match(quick, /organizationSlug\s*\?/, "View Public Page only once the organisation exists");
  const mock = read("lib/organiser-hub-mock-data.ts");
  assert.doesNotMatch(mock, /export const mock(StatStrip|Organiser)\b/);
});

test("Create Session wizard: only settings that are saved are shown", () => {
  const step2 = read("components/organiser/sessions/wizard/step2-date-registration.tsx");
  const step3 = read("components/organiser/sessions/wizard/step3-details-rules.tsx");
  const step4 = read("components/organiser/sessions/wizard/step4-review-publish.tsx");
  for (const id of ["random-partners", "avoid-repeat", "balance-waiting", "use-rating", "allow-guests", "qr-checkin", "live-scores", "auto-next-round", "publish-results"]) {
    assert.ok(!step3.includes(`organiser-wizard-${id}`), `step 3: ${id} toggle is gone`);
  }
  assert.ok(!step2.includes("organiser-wizard-late-registration-toggle"), "step 2: late registration toggle is gone");
  assert.ok(!step4.includes("draft.qrCheckIn"), "review doesn't report QR check-in");
  assert.match(step3, /organiser-wizard-pairing-note/, "pairing is described, not toggled");
  assert.match(step2, /doesn't collect payment/, "paid sessions explain that payment isn't collected");
  const types = read("lib/organiser-session-wizard-types.ts");
  assert.doesNotMatch(types, /pairingLabels/, "hidden toggles are not written into the description");
});

test("Session Workspace: no 'coming soon' controls, no fake settings, Photos hidden", () => {
  const workspace = read("pages/organiser/session-workspace.tsx");
  assert.doesNotMatch(workspace, /key: "photos"/, "Photos tab hidden");
  const settings = read("components/organiser/sessions/workspace/settings-tab.tsx");
  assert.doesNotMatch(settings, /not saved yet|Check-in Open|Notify Players of Changes/);
  for (const f of ["players/players-table.tsx", "players/players-list.tsx"]) {
    const src = read(`components/organiser/sessions/workspace/${f}`);
    assert.doesNotMatch(src, /coming soon/i, `${f}: no coming-soon actions`);
    assert.doesNotMatch(src, /<Checkbox/, `${f}: no selection without bulk actions`);
  }
  assert.match(read("components/organiser/sessions/workspace/players-tab.tsx"), /<QuickMessageModal/, "Message player opens the real composer");
});

test("Live entry points are hidden where TC Live is off (Production)", () => {
  for (const f of [
    "components/organiser/sessions/session-card.tsx",
    "components/organiser/sessions/session-card-grid.tsx",
    "components/organiser/sessions/workspace/overview-tab.tsx",
    "components/organiser/dashboard/organiser-dashboard.tsx",
    "pages/organiser/session-workspace.tsx",
  ]) {
    assert.match(read(f), /useLiveAvailable\(|liveAvailableFor\(/, `${f} checks whether Live is available`);
  }
  // TC Live v1: the server's flag (TC_LIVE_ENABLED), not DB_ENV, decides.
  const hook = read("lib/use-live-available.ts");
  assert.match(hook, /\/api\/organizer\/features/);
  assert.doesNotMatch(hook, /dbEnv/);
});

// ---- Phase 2 Batch 2 ----

test("wizard: four categories, settings follow the category, no unsupported format promises", () => {
  const step1 = read("components/organiser/sessions/wizard/step1-session-type.tsx");
  assert.match(step1, /SESSION_CATEGORIES/, "step 1 picks one of the four categories");
  assert.match(step1, /organiser-wizard-session-category-\$\{/);
  const step3 = read("components/organiser/sessions/wizard/step3-details-rules.tsx");
  assert.match(step3, /category\.usesMatchFormat &&/, "format settings only for categories that have them");
  assert.match(step3, /useLiveAvailable\(\)/, "notes depend on whether Live exists here");
  const types = read("lib/organiser-session-wizard-types.ts");
  assert.match(types, /usesMatchFormat/, "coaching sessions don't save match-format fields");
  // The engine only shuffles rounds (liveEngine.planRound): no draws,
  // brackets, qualifying, results-based pairing or team scoring.
  assert.doesNotMatch(types, /Draw · Elimination|Seeded draw · Qualifying|Home vs away · Team points|adjusted between rounds based on results|Winners move up/);
  for (const f of ["pages/play.tsx", "components/play/EventQuickViewModal.tsx"]) {
    assert.doesNotMatch(read(f), /\["tournament", "league", "club-championship", "junior-event"\]/, `${f} uses isCompetitionType`);
  }
});

test("rounds tab shows stored rounds, never placeholder rounds", () => {
  const rounds = read("components/organiser/sessions/workspace/rounds-tab.tsx");
  assert.match(rounds, /getSessionRounds/);
  assert.doesNotMatch(rounds, /\?\? 5|plannedRoundsCount/);
  const workspace = read("pages/organiser/session-workspace.tsx");
  assert.match(workspace, /usesLiveRounds/, "coaching sessions have no Rounds / Results tabs");
});

test("policies are saved to their own fields and shown to players", () => {
  assert.match(read("lib/organiser-session-wizard-types.ts"), /\.\.\.policyColumns\(/);
  assert.match(read("pages/organiser/session-edit.tsx"), /\.\.\.policyColumns\(policies\)/);
  assert.match(read("pages/play-session-details.tsx"), /<SessionPoliciesList/);
});

test("Your Organisation page and session actions", () => {
  const page = read("pages/organiser/organisation.tsx");
  assert.match(page, /updateOrganization\(/);
  assert.match(page, /organizationProfileSchema/, "same validation as the server");
  assert.match(read("components/organiser/ui/organiser-sidebar.tsx"), /href: "\/organiser\/organisation"/);
  assert.match(read("App.tsx"), /path="\/organiser\/organisation"/);
  for (const f of ["components/organiser/sessions/session-card.tsx", "components/organiser/sessions/session-card-grid.tsx"]) {
    assert.doesNotMatch(read(f), /was copied as a new draft/, `${f}: Duplicate opens the wizard, no success toast`);
  }
  const workspace = read("pages/organiser/session-workspace.tsx");
  assert.match(workspace, /canInviteToSession\(session\.status, session\.endAt\)/);
  assert.match(workspace, /canAnnounceToSession\(session\.status\)/);
});

test("no Hub control only announces that it isn't wired up", () => {
  const walk = (dir: string): string[] =>
    readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [],
    );
  for (const f of [...walk("components/organiser"), ...walk("pages/organiser")]) {
    assert.doesNotMatch(read(f), /toast\(\{\s*title:\s*[`"'][^`"']*(isn't wired up|not wired up|coming soon)/i, f);
  }
  // The share link is the real public page, never the old /sessions/:id 404.
  assert.doesNotMatch(read("components/organiser/sessions/workspace/players/invite-players-card.tsx"), /\/sessions\/\$\{/);
});

test("TC Live screen: no fake share link, sections on phones, server rules mirrored, kill switch keeps history", () => {
  const live = read("pages/organiser/session-live.tsx");
  assert.doesNotMatch(live, /handleShareLiveBoard|organiser-session-live-share/, "no 'Share Live Board' copying the organiser URL");
  assert.match(live, /organiser-live-tab-\$\{item\.key\}/, "section tabs below the desktop rail");
  assert.match(live, /scoreProblem\(/, "score validation shared with the server");
  assert.match(live, /goLiveProblem\(/);
  assert.match(live, /UNSCORED_MATCHES/, "End Session handles unscored matches explicitly");
  assert.match(live, /refetchInterval/, "a second device / reconnect sees the same state");
  assert.match(live, /setRegistrationLiveStatus/, "withdraw / sit out / back in are reachable");
  assert.doesNotMatch(live, /dbEnv|isStaging/, "TC_LIVE_ENABLED decides, not DB_ENV");
});

test("player CSV export quotes every cell and defuses spreadsheet formulas", async () => {
  const { playersCsv } = await import("./organiser-export");
  const csv = playersCsv(
    [
      { userName: '=HYPERLINK("http://evil","x")', userSlug: "p-1", status: "registered", checkedInAt: null, createdAt: "2026-10-30T00:00:00Z" },
      { userName: 'Sam "Ace" Lee', userSlug: "+61", status: "waitlisted", checkedInAt: null, createdAt: "2026-10-30T00:00:00Z" },
    ] as never,
    "Australia/Sydney",
  );
  const [header, first, second] = csv.split("\n");
  assert.equal(header, '"Name","Profile","Status","Checked in","Registered at"');
  assert.ok(first.startsWith(`"'=HYPERLINK(""http://evil"",""x"")"`), "formula is neutralised and quotes doubled");
  assert.ok(second.startsWith(`"Sam ""Ace"" Lee","'+61"`), "leading + defused, quotes doubled");
});

test("results CSV: standings in order, names defused", async () => {
  const { resultsCsv, csvFileName } = await import("./organiser-export");
  const row = (userName: string, wins: number) => ({ userId: userName, userName, userAvatar: null, matchesPlayed: 3, wins, losses: 3 - wins, draws: 0, gamesWon: 15, gamesLost: 9, restRounds: 0 });
  const csv = resultsCsv([row("Alex", 3), row("@cmd", 1)] as never);
  assert.deepEqual(csv.split("\n"), [
    '"Position","Player","Played","Won","Drawn","Lost","Games won","Games lost"',
    '"1","Alex","3","3","0","0","15","9"',
    `"2","'@cmd","3","1","0","2","15","9"`,
  ]);
  assert.equal(csvFileName("Wed Social!", "results"), "wed-social-results.csv");
  assert.equal(csvFileName("Wed Social!"), "wed-social-players.csv", "player export name unchanged");
});
