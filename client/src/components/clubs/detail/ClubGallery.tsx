import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ChevronLeft, X, Image as ImageIcon } from "lucide-react";

interface ClubGalleryProps {
  images: string[];
  clubName: string;
  location?: string;
}

const SLIDE_INTERVAL_MS = 4500;
const SWIPE_THRESHOLD_PX = 40;

export function ClubGallery({ images: rawImages, clubName, location }: ClubGalleryProps) {
  // Defensive: drop any empty/missing URLs so a bad upload never leaves a
  // blank bordered box in the thumbnail grid.
  const images = (rawImages || []).filter(Boolean);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    if (images.length <= 1 || paused || lightboxOpen) return;

    const timer = setInterval(() => {
      setSlide((s) => (s + 1) % images.length);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [images.length, paused, lightboxOpen]);

  if (images.length === 0) {
    return null;
  }

  const openAt = (index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  const goTo = (index: number) => {
    setPaused(true);
    setSlide((index + images.length) % images.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    didSwipe.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

    didSwipe.current = true;
    setPaused(true);
    if (deltaX < 0) {
      setSlide((s) => (s + 1) % images.length);
    } else {
      setSlide((s) => (s - 1 + images.length) % images.length);
    }
  };

  return (
    <section
      className="rounded-2xl border bg-card p-4 md:p-5"
      data-testid="club-gallery"
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div>
          <h3 className="font-display font-bold text-lg md:text-xl">
            Gallery
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Moments from our tennis community
          </p>
        </div>

        {images.length > 1 && (
          <button
            type="button"
            onClick={() => openAt(0)}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline cursor-pointer shrink-0"
            data-testid="club-gallery-view-all"
          >
            View all photos
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative w-full md:w-1/2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (didSwipe.current) {
                didSwipe.current = false;
                return;
              }
              openAt(slide);
            }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative block w-full aspect-video md:aspect-auto md:h-full rounded-xl overflow-hidden bg-muted cursor-pointer touch-pan-y"
            data-testid="club-gallery-main-image"
          >
            <AnimatePresence mode="sync">
              <motion.img
                key={slide}
                src={images[slide]}
                alt={clubName}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>

            {/* Caption overlay */}
            <div className="absolute left-3 bottom-3 flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-sm px-3 py-2 text-left">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <ImageIcon className="w-3.5 h-3.5 text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold leading-tight truncate">
                  {clubName}
                </p>
                {location && (
                  <p className="text-white/70 text-xs leading-tight truncate">
                    {location}
                  </p>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === slide ? "w-5 bg-white" : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </button>

          {/* Prev/next arrows — desktop/tablet only, mobile uses swipe */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(slide - 1);
                }}
                className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md hover:bg-white transition-colors cursor-pointer"
                data-testid="club-gallery-prev"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(slide + 1);
                }}
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md hover:bg-white transition-colors cursor-pointer"
                data-testid="club-gallery-next"
                aria-label="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnails: desktop/tablet only — mobile uses the swipeable
            slider above instead */}
        {images.length > 1 && (
          <div className="hidden md:grid grid-cols-3 gap-2 flex-1 content-start">
            {images.slice(1, 7).map((img, i) => {
              const isLastVisible = i === 5 && images.length > 7;
              return (
                <button
                  type="button"
                  key={img + i}
                  onClick={() => openAt(i + 1)}
                  className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                  data-testid={`club-gallery-thumb-${i}`}
                >
                  <img
                    src={img}
                    alt={`${clubName} photo ${i + 2}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  {isLastVisible && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-sm">
                      +{images.length - 7}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
          data-testid="club-gallery-lightbox"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white cursor-pointer"
            data-testid="club-gallery-lightbox-close"
          >
            <X className="w-7 h-7" />
          </button>

          <img
            src={images[activeIndex]}
            alt={`${clubName} full size`}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(i);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    i === activeIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
