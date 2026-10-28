/*
  Page hero photos, one entry per page. Each photo ships in a few widths
  (re-encoded WebP, quality 72) so a 1280px laptop doesn't download the
  1920px file, and phones get a 900px one - see components/shared/hero-photo.tsx.

  `mobile` = a separately cropped phone photo (art direction), used below
  `maxWidth` instead of the srcset.

  client/index.html preloads the same files before the JS bundle runs
  (its inline script has a copy of this table - keep the two in sync;
  uiConsistency.test.ts checks they match).
*/

export interface HeroImage {
  /** File name stem in /assets/images, without "-<width>.webp". */
  base: string;
  /** Widths that exist as `${base}-${width}.webp`, smallest first. */
  widths: number[];
  mobile?: { file: string; maxWidth: number };
}

export const HERO_IMAGE_DIR = "/assets/images/";

export const HERO_IMAGES = {
  players: { base: "dashboard_players", widths: [900, 1280, 1920] },
  coaches: { base: "dashboard_coach", widths: [900, 1280, 1920] },
  articles: { base: "Dashboard_articles", widths: [900, 1280, 1774] },
  clubs: { base: "Dashboard_club", widths: [1280, 1774], mobile: { file: "Dashboard_club-mobile.webp", maxWidth: 639 } },
  travels: {
    base: "travels-hero-cote-dazur",
    widths: [1280, 1920],
    mobile: { file: "travels-hero-cote-dazur-mobile.webp", maxWidth: 639 },
  },
  games: {
    base: "games-hero-sydney-harbour",
    widths: [1280, 1920],
    mobile: { file: "games-hero-sydney-harbour-mobile.webp", maxWidth: 767 },
  },
} satisfies Record<string, HeroImage>;

export type HeroImageKey = keyof typeof HERO_IMAGES;

export function heroSrcSet(hero: HeroImage): string {
  return hero.widths.map((w) => `${HERO_IMAGE_DIR}${hero.base}-${w}.webp ${w}w`).join(", ");
}

export function heroFallbackSrc(hero: HeroImage): string {
  return `${HERO_IMAGE_DIR}${hero.base}-${hero.widths[hero.widths.length - 1]}.webp`;
}
