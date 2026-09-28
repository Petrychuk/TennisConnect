// [PLAY][AI] TC Discovery Agent, spec section 29 (cost control) - turn a
// fetched page into the smallest useful text for the model.
//
// A real club or association page is mostly furniture: a mega-menu, a
// header, a footer, cookie banners. Tennis Victoria's "What's On" page
// puts several thousand characters of navigation BEFORE the first event,
// so cutting the raw text at a character limit can leave the model with
// menus and no events at all. This module isolates the page's main
// content first, and only then applies the limit.
//
// Deliberately dependency-free (regex, no HTML parser). It's a pragmatic
// extractor for server-rendered pages, not a browser: pages that build
// their content with JavaScript are detected and skipped, not rendered
// (V1 pilot decision - no Playwright yet).

/** The pilot's per-page budget for text sent to the model. */
export const MAX_PAGE_TEXT_CHARS = 12_000;

/** Contact details (street address, phone) usually live in the footer,
    outside the main content - so a short slice of it is appended after
    the main content, inside the same overall budget. */
const FOOTER_BUDGET_CHARS = 1_200;

/** Below this much readable text, a page has nothing worth extracting. */
const MIN_READABLE_CHARS = 200;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "-", mdash: "-", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: "...",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return " ";
      // Typographic dashes/quotes become plain ASCII so the text (and its
      // hash) is stable and the model sees "6.30pm - 8pm", not "&#8211;".
      if (code === 8211 || code === 8212) return "-";
      if (code === 8216 || code === 8217) return "'";
      if (code === 8220 || code === 8221) return '"';
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Link text that signals "this is how you register" - only these
    links keep their address in the extracted text (see keepActionLinks). */
const ACTION_LINK_TEXT = /\b(register|registration|sign\s*up|book(?:ing)?|enrol(?:l)?(?:ment)?|buy|tickets?|join|apply|rsvp)\b/i;

/**
 * Plain text drops every href, and with it any "Sign Up Here" address the
 * model could return as the registration link. Keeping every URL would
 * waste the budget (calendar-export links alone run to thousands of
 * characters), so only links whose TEXT reads like a registration action
 * are rewritten as "text [link: URL]" - and only when the URL is a
 * reasonably short http(s) address. mailto:/tel:/javascript: never qualify.
 */
function keepActionLinks(html: string): string {
  return html.replace(/<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi, (whole, dq, sq, inner: string) => {
    const href = decodeEntities((dq ?? sq ?? "").trim());
    const label = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!/^https?:\/\//i.test(href) || href.length > 200 || !ACTION_LINK_TEXT.test(label)) return inner;
    return `${inner} [link: ${href}]`;
  });
}

const NOISE_BLOCKS = ["script", "style", "noscript", "svg", "template", "iframe", "select", "textarea", "canvas"];

function removeBlocks(html: string, tags: string[]): string {
  let out = html;
  for (const tag of tags) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), " ");
  }
  return out;
}

/** First opening tag to the LAST closing tag of the same name - a
    contiguous slice, robust to nested/repeated elements. */
function sliceBetween(html: string, tag: string): string | null {
  const open = new RegExp(`<${tag}\\b[^>]*>`, "i").exec(html);
  if (!open) return null;
  const close = html.toLowerCase().lastIndexOf(`</${tag}`);
  if (close <= open.index) return null;
  return html.slice(open.index, close);
}

function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section|article|table|dt|dd|blockquote)\s*>/gi, "\n")
    .replace(/<(h[1-6])\b[^>]*>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export interface ReadableContent {
  text: string;
  /** True when a <main>/<article>/role=main region was found; false when
      the whole body (minus navigation furniture) was used. */
  usedMainContent: boolean;
  /** Characters of readable text before the budget was applied. */
  fullLength: number;
}

/**
 * Main readable content of a page, capped at `maxChars`.
 *  1. Prefer <main>, then <article>, then role="main" / #main / #content.
 *  2. Inside a main region, drop only non-content noise (nav, aside, forms,
 *     scripts...) - a <header> there may hold the event title.
 *  3. With no main region, use the whole <body> and ALSO drop the site
 *     <header>/<footer> furniture.
 *  4. Append a short slice of the page footer (address/phone), then apply
 *     the budget to the MAIN content first so furniture never crowds it out.
 */
export function extractReadableContent(html: string, maxChars: number = MAX_PAGE_TEXT_CHARS): ReadableContent {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const titleLine = title ? `Page title: ${decodeEntities(title.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()}` : "";

  const cleaned = removeBlocks(html.replace(/<!--[\s\S]*?-->/g, " "), NOISE_BLOCKS);

  // Footer text is captured from the whole page before any slicing.
  const footerHtml = sliceBetween(cleaned, "footer");
  const footerText = footerHtml ? htmlToText(removeBlocks(footerHtml, ["nav", "form"])).slice(0, FOOTER_BUDGET_CHARS) : "";

  let region = sliceBetween(cleaned, "main") ?? sliceBetween(cleaned, "article");
  if (!region) {
    const roleMain = /<(div|section)\b[^>]*(?:role\s*=\s*["']main["']|id\s*=\s*["'](?:main|main-content|content)["'])[^>]*>/i.exec(cleaned);
    if (roleMain) region = cleaned.slice(roleMain.index);
  }

  // A "main" region that turns out nearly empty (a shell around an
  // app-mounted div) is worse than the body - fall back rather than trust it.
  let usedMainContent = !!region && htmlToText(region).length >= MIN_READABLE_CHARS;
  let bodyHtml: string;
  if (usedMainContent) {
    bodyHtml = removeBlocks(region!, ["nav", "aside", "form"]);
  } else {
    bodyHtml = /<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(cleaned)?.[1] ?? cleaned;
    bodyHtml = removeBlocks(bodyHtml, ["nav", "header", "footer", "aside", "form"]);
    usedMainContent = false;
  }

  const mainText = htmlToText(keepActionLinks(bodyHtml));
  const fullLength = mainText.length;

  const parts: string[] = [];
  if (titleLine) parts.push(titleLine);
  const overhead = parts.join("\n").length + (footerText ? footerText.length + 20 : 0);
  parts.push(mainText.slice(0, Math.max(0, maxChars - overhead)));
  if (footerText) parts.push(`Page footer (contact details):\n${footerText}`);

  return { text: parts.join("\n").slice(0, maxChars), usedMainContent, fullLength };
}

export type PageAssessment =
  | { supported: true; text: string; usedMainContent: boolean; fullLength: number }
  | { supported: false; reason: string };

/**
 * Decide whether a fetched page can be read at all. A page whose events
 * are built by JavaScript arrives as an empty shell - an app-mount div, a
 * "please enable JavaScript" notice, a heap of script bundles - and would
 * look to the Agent like a page with no events. That must be reported as
 * unsupported (with the reason logged), not silently treated as "nothing
 * found", and it must not be sent to the model.
 */
export function assessPage(html: string, maxChars: number = MAX_PAGE_TEXT_CHARS): PageAssessment {
  const content = extractReadableContent(html, maxChars);
  // Judge readability on the page's own text, not the "Page title:" line
  // and footer added around it.
  const readable = content.fullLength;
  if (readable >= MIN_READABLE_CHARS) {
    return { supported: true, text: content.text, usedMainContent: content.usedMainContent, fullLength: content.fullLength };
  }

  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  const appShell = /<div[^>]+id\s*=\s*["'](?:root|app|__next|__nuxt|___gatsby)["']/i.test(html);
  const needsJs = /<noscript[^>]*>[\s\S]*?(enable\s+javascript|requires?\s+javascript|javascript\s+(is\s+)?(required|disabled))/i.test(html);

  if (appShell || needsJs || scriptCount >= 8) {
    return {
      supported: false,
      reason: `Unsupported: page appears to need JavaScript rendering (only ${readable} characters of readable text in the server HTML)`,
    };
  }
  return { supported: false, reason: `Unsupported: page has too little readable text to extract from (${readable} characters)` };
}
