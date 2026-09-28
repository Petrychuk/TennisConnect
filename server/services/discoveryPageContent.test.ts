// npx tsx server/services/discoveryPageContent.test.ts

import assert from "node:assert/strict";
import { extractReadableContent, assessPage, decodeEntities, MAX_PAGE_TEXT_CHARS } from "./discoveryPageContent";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  }
}

console.log("discoveryPageContent.ts");

// A mega-menu like Tennis Victoria's: hundreds of links, well over the
// 12,000-character budget, sitting BEFORE the page's real content.
const megaMenu = Array.from({ length: 400 }, (_, i) => `<li><a href="/play/section-${i}">Navigation entry number ${i} for the site</a></li>`).join("");

const vicLikePage = `<!doctype html><html><head><title>What's On | Tennis Victoria</title>
<script>window.dataLayer = [];</script><style>.x{color:red}</style></head>
<body>
<header><nav><ul>${megaMenu}</ul></nav></header>
<main>
  <h1>What's On</h1>
  <h2>Event calendar</h2>
  <h3>September 2026</h3>
  <h4>Friday Night Smash</h4>
  <p>Weekly in-house junior matchplay program.</p>
  <p><strong>Every Friday night<br>Eaglemont Tennis Club</strong></p>
  <h4>2026 Pride Cup</h4>
  <p><strong>Saturday 12 September<br>2&ndash;4pm<br>Keon Park Tennis Club</strong></p>
  <h3>October 2026</h3>
  <h4>Growing the Game</h4>
  <p>Register: <a href="https://www.trybooking.com/au/event/1637610">https://www.trybooking.com/au/event/1637610</a></p>
</main>
<footer><ul><li>Privacy policy</li></ul><p>&copy; 2026 Tennis Australia</p></footer>
</body></html>`;

test("the main content survives even when navigation alone is far bigger than the budget", () => {
  const naive = vicLikePage
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, MAX_PAGE_TEXT_CHARS);
  // The old approach: 12,000 characters of menu, no events at all.
  assert.equal(naive.includes("Friday Night Smash"), false);

  const result = extractReadableContent(vicLikePage);
  assert.equal(result.usedMainContent, true);
  assert.ok(result.text.includes("Friday Night Smash"));
  assert.ok(result.text.includes("Every Friday night"));
  assert.ok(result.text.includes("Keon Park Tennis Club"));
  assert.ok(result.text.includes("September 2026")); // the heading that supplies the year
  assert.equal(result.text.includes("Navigation entry number"), false);
});

test("the result never exceeds the character budget", () => {
  const huge = `<html><body><main>${"<p>Social tennis every Saturday at the club courts.</p>".repeat(2000)}</main></body></html>`;
  const result = extractReadableContent(huge);
  assert.ok(result.text.length <= MAX_PAGE_TEXT_CHARS);
  assert.ok(result.fullLength > MAX_PAGE_TEXT_CHARS);
  assert.ok(extractReadableContent(huge, 500).text.length <= 500);
});

test("scripts, styles and comments never reach the text", () => {
  const result = extractReadableContent(vicLikePage);
  assert.equal(result.text.includes("dataLayer"), false);
  assert.equal(result.text.includes("color:red"), false);
});

test("the page title is kept - it often carries the event name", () => {
  assert.ok(extractReadableContent(vicLikePage).text.startsWith("Page title: What's On | Tennis Victoria"));
});

test("line structure is preserved so headings and details stay separate", () => {
  const lines = extractReadableContent(vicLikePage).text.split("\n");
  assert.ok(lines.includes("Every Friday night"));
  assert.ok(lines.includes("Eaglemont Tennis Club"));
});

// A Strathfield-shaped event page: article, a registration link, a huge
// calendar-export link, and the address only in the footer.
const clubEventPage = `<html><head><title>Saturday Social - Strathfield Sports Club</title></head><body>
<header><nav>${megaMenu}</nav></header>
<article>
  <h2>Saturday Social</h2>
  <p>Come and play a social game of doubles every Saturday.</p>
  <p>FREE for tennis members. $20 pp applicable to non-tennis members each week.</p>
  <p>Beginners Social: 6.30pm &#8211; 8pm<br>Competitive/Advanced Social: 8pm &#8211; 9.30pm</p>
  <p><a href="https://forms.clickup.com/3462635/f/39nfb-10456/ABC?Comment=xxxx">Sign Up Here</a></p>
  <h3>When</h3><p>Saturday, 1 Aug 2026 6:30 pm &#8211; 9:30 pm</p>
  <p><a href="https://www.google.com/calendar/event?action=TEMPLATE&text=Saturday+Social&details=${"x".repeat(900)}">Google Calendar</a>
     <a href="webcal://club.example/ical/">iCalendar</a></p>
</article>
<footer><h5>Location</h5><p>4a Lyons Street<br>Strathfield NSW 2135</p><p>T: <a href="tel:97475055">02 9747 5055</a></p></footer>
</body></html>`;

test("a registration-style link keeps its address, so the model can return a real registrationUrl", () => {
  const { text } = extractReadableContent(clubEventPage);
  assert.ok(text.includes("Sign Up Here [link: https://forms.clickup.com/3462635/f/39nfb-10456/ABC?Comment=xxxx]"));
});

test("other links (calendar exports, mailto, tel) do not spend the budget on their addresses", () => {
  const { text } = extractReadableContent(clubEventPage);
  assert.equal(text.includes("google.com/calendar"), false);
  assert.equal(text.includes("webcal://"), false);
  assert.equal(text.includes("tel:"), false);
  assert.equal(text.includes("[link: mailto"), false);
});

test("a footer address is appended after the main content, so location isn't lost", () => {
  const { text } = extractReadableContent(clubEventPage);
  assert.ok(text.includes("Strathfield NSW 2135"));
  assert.ok(text.indexOf("Saturday Social") < text.indexOf("Strathfield NSW 2135"));
});

test("HTML entities become plain text (en-dash -> '-')", () => {
  const { text } = extractReadableContent(clubEventPage);
  assert.ok(text.includes("6.30pm - 8pm"));
  assert.equal(text.includes("&#8211;"), false);
});

test("entity decoding handles named, decimal and hex forms, and leaves unknown ones alone", () => {
  assert.equal(decodeEntities("Fish &amp; chips"), "Fish & chips");
  assert.equal(decodeEntities("it&#8217;s"), "it's");
  assert.equal(decodeEntities("Caf&#xE9;"), "Caf\u00e9");
  assert.equal(decodeEntities("A&#x2013;B"), "A-B"); // typographic dashes are flattened on purpose
  assert.equal(decodeEntities("&madeup;"), "&madeup;");
});

// A QTC-shaped page: no <main>/<article>, content in a plain div.
const plainThemePage = `<html><head><title>Social Tennis - Queensland Tennis Centre</title></head><body>
<div class="top"><ul>${megaMenu}</ul></div>
<nav>${megaMenu}</nav>
<div id="content">
  <h1>Social Tennis</h1>
  <p>Social Tennis runs every Tuesday and Sunday! Registrations are only available via the QTC App.</p>
  <h4>Tuesday Night Social Tennis</h4><p><strong>7:00pm &ndash; 10:00pm</strong> Open to ages 17+ and all standards.</p>
  <h4>Sunday Afternoon Social Tennis</h4><p><strong>3:00pm &ndash; 6:00pm</strong> Play singles or mixed doubles.</p>
  <p>Casual Players: <strong>$24.00</strong></p>
  <p><a href="http://qldtcproshop@tennis.com.au">Enquire Now</a></p>
</div>
<footer>190 King Arthur Tce, Tennyson QLD, 4105</footer></body></html>`;

test("without <main>/<article>, a role/id content region is found and the site nav is dropped", () => {
  const result = extractReadableContent(plainThemePage);
  assert.equal(result.usedMainContent, true);
  assert.ok(result.text.includes("Tuesday Night Social Tennis"));
  assert.ok(result.text.includes("Sunday Afternoon Social Tennis"));
  assert.ok(result.text.includes("Tennyson QLD, 4105"));
});

test("a non-registration link ('Enquire Now') is not kept even though it is a link", () => {
  assert.equal(extractReadableContent(plainThemePage).text.includes("[link:"), false);
});

test("with no main region at all, the body is used minus header/nav/footer furniture", () => {
  const html = `<html><body><header>${megaMenu}</header><div><h2>Round Robin</h2><p>${"Every Sunday morning we play a friendly round robin at the club. ".repeat(6)}</p></div></body></html>`;
  const result = extractReadableContent(html);
  assert.equal(result.usedMainContent, false);
  assert.ok(result.text.includes("Round Robin"));
  assert.equal(result.text.includes("Navigation entry"), false);
});

test("a <main> that is just an empty app shell falls back to the body instead of being trusted", () => {
  const html = `<html><body><main><div id="mount"></div></main><div><p>${"Real events are listed here every week at the club. ".repeat(8)}</p></div></body></html>`;
  const result = extractReadableContent(html);
  assert.equal(result.usedMainContent, false);
  assert.ok(result.text.includes("Real events are listed here"));
});

// --- unsupported pages ---

test("a JavaScript app shell is reported unsupported, with the reason", () => {
  const html = `<html><head><title>Events</title><script src="/a.js"></script><script src="/b.js"></script></head>
    <body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body></html>`;
  const result = assessPage(html);
  assert.equal(result.supported, false);
  if (!result.supported) assert.ok(result.reason.includes("JavaScript rendering"), result.reason);
});

test("a page with tiny text and no SPA signs is still skipped, with a different reason", () => {
  const result = assessPage("<html><body><p>Coming soon</p></body></html>");
  assert.equal(result.supported, false);
  if (!result.supported) assert.ok(result.reason.includes("too little readable text"), result.reason);
});

test("a normal server-rendered page is supported and returns its text", () => {
  const result = assessPage(vicLikePage);
  assert.equal(result.supported, true);
  if (result.supported) assert.ok(result.text.includes("Growing the Game"));
});

test("a script-heavy page that DOES have real server-rendered content is not wrongly rejected", () => {
  const scripts = Array.from({ length: 12 }, (_, i) => `<script src="/bundle${i}.js"></script>`).join("");
  const html = `<html><head>${scripts}</head><body><main><p>${"Social tennis every Thursday night with a friendly round robin format. ".repeat(6)}</p></main></body></html>`;
  assert.equal(assessPage(html).supported, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
