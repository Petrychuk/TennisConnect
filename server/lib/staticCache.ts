import path from "path";

/*
  Cache-Control for files served from the client build (dist/public).

  - index.html (and any .html): no-cache - it names the current build's
    chunk files, so it must be revalidated on every visit.
  - Vite's hashed build output (/assets/<name>-<hash>.js|css|...): the file
    name changes whenever its content does, so it can be cached for a year
    without revalidation. Before, every chunk was re-checked on every
    navigation (max-age=0), so a lazy page's JS and CSS cost an extra round
    trip each time.
  - Everything else (public/ files such as /assets/images/*.webp, whose
    names don't change when replaced): one day, then served from cache
    while revalidating in the background for up to a week.
*/
const HASHED_BUILD_FILE = /^[\w.-]+-[A-Za-z0-9_-]{8,}\.(?:js|mjs|css|woff2?|ttf|svg|png|jpe?g|webp|avif|gif)$/;

export function staticCacheControl(filePath: string): string {
  const normalised = filePath.split(path.sep).join("/");
  if (normalised.endsWith(".html")) return "no-cache";
  const match = normalised.match(/\/assets\/([^/]+)$/);
  if (match && HASHED_BUILD_FILE.test(match[1])) return "public, max-age=31536000, immutable";
  return "public, max-age=86400, stale-while-revalidate=604800";
}
