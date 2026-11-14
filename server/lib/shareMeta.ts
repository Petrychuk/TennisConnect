/*
  Link previews for a shared session (/play/:id) on Facebook, WhatsApp,
  Messenger, Slack...: their crawlers read the HTML and never run the app's
  JavaScript, so the per-page tags components/seo.tsx sets in the browser are
  invisible to them. serveStatic (server/static.ts) puts these tags into the
  HTML it sends for a published public session instead.

  Pure module - unit-tested in server/lib/shareMeta.test.ts.
*/

export interface ShareMeta {
  title: string;
  description: string;
  image: string;
  url: string;
}

export const DEFAULT_SHARE_IMAGE = "https://www.tennisconnect.com.au/og-image.jpg";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** First real sentence(s) of a description, as plain text, at most ~200 characters. */
export function shareDescription(description: string | null | undefined, fallback: string): string {
  const text = (description ?? "")
    .split(/\n/)
    .filter((line) => line.trim() && !/^Format:/.test(line.trim()))
    .join(" ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  return text.length > 200 ? `${text.slice(0, 197).replace(/\s+\S*$/, "")}...` : text;
}

export function buildSessionShareMeta(
  session: { id: string; title: string; description: string | null; coverImage: string | null; organizationName: string; location: string | null },
  site: string,
  when: string,
): ShareMeta {
  const where = session.location ? ` at ${session.location}` : "";
  return {
    title: `${session.title} | TennisConnect`,
    description: shareDescription(session.description, `${when}${where}. Organised by ${session.organizationName} - join on TennisConnect.`),
    // Only an absolute https image can be fetched by a crawler.
    image: session.coverImage && /^https:\/\//i.test(session.coverImage) ? session.coverImage : DEFAULT_SHARE_IMAGE,
    url: `${site}/play/${session.id}`,
  };
}

/** Replaces the shell's <title> and adds Open Graph / Twitter tags before </head>. */
export function injectShareMeta(html: string, meta: ShareMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const i = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);
  const tags = [
    `<meta name="description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="TennisConnect" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${i}" />`,
    `<meta property="og:url" content="${u}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${i}" />`,
  ].join("\n    ");
  const withTitle = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);
  return withTitle.replace("</head>", `    ${tags}\n  </head>`);
}
