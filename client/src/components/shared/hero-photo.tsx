import { HERO_IMAGE_DIR, HERO_IMAGES, heroFallbackSrc, heroSrcSet, type HeroImage, type HeroImageKey } from "@/lib/heroImages";

/*
  The full-bleed photo behind a page hero. The browser picks the
  smallest file that is sharp enough for the screen (srcset + sizes),
  and phones get the cropped mobile photo where a page has one.
  Always eager + high priority: it is the page's LCP image, and
  client/index.html has already started downloading the same file.
*/
export function HeroPhoto({ hero, alt, className }: { hero: HeroImageKey; alt: string; className?: string }) {
  const img: HeroImage = HERO_IMAGES[hero];
  return (
    <picture>
      {img.mobile && <source media={`(max-width: ${img.mobile.maxWidth}px)`} srcSet={`${HERO_IMAGE_DIR}${img.mobile.file}`} />}
      <img
        src={heroFallbackSrc(img)}
        srcSet={heroSrcSet(img)}
        sizes="100vw"
        alt={alt}
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className={className}
        data-testid={`hero-photo-${hero}`}
      />
    </picture>
  );
}
