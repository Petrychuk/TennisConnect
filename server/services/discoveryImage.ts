// [PLAY][AI] TC Discovery Agent - the event's own picture.
//
// A source page publishes a share image (og:image) precisely so that other
// sites can show a preview of it. We store only the LINK (never copy the
// file) and the card shows it with the source named underneath. Nothing is
// invented: no share image, no picture - the card falls back to a
// TennisConnect placeholder.
//
// Dependency-free and pure so it can be tested without a network.

const MAX_URL_LENGTH = 500;

/** Images that are never an event photo (site logos, icons, tracking pixels). */
const NOT_A_PHOTO = /(favicon|apple-touch-icon|\/logo[^/]*\.|[-_/]logo[-_.]|sprite|pixel|spacer|blank\.)/i;

function metaContent(html: string, key: string): string | null {
  // <meta property="og:image" content="..."> in either attribute order.
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (name !== key) continue;
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const value = (content?.[1] ?? content?.[2] ?? "").trim();
    if (value) return value.replace(/&amp;/g, "&");
  }
  return null;
}

/** Resolves a candidate to an absolute http(s) URL, or null when unusable. */
export function resolveImageUrl(candidate: string | null | undefined, pageUrl: string): string | null {
  if (!candidate) return null;
  let url: URL;
  try {
    url = new URL(candidate.trim(), pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (/\.svg(\?|$)/i.test(url.pathname)) return null; // logos / icons, and scriptable
  if (NOT_A_PHOTO.test(url.href)) return null;
  const href = url.toString();
  return href.length <= MAX_URL_LENGTH ? href : null;
}

/** The page's share image as an absolute URL, or null when there isn't a usable one. */
export function extractPageImage(html: string, pageUrl: string): string | null {
  for (const key of ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) {
    const url = resolveImageUrl(metaContent(html, key), pageUrl);
    if (url) return url;
  }
  const link = /<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*>/i.exec(html);
  const href = link && /href\s*=\s*["']([^"']+)["']/i.exec(link[0])?.[1];
  return resolveImageUrl(href, pageUrl);
}
