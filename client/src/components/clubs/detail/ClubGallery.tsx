import { useState } from "react";
import { ChevronRight, ImageOff, X } from "lucide-react";

interface ClubGalleryProps {
  images: string[];
  clubName: string;
}

export function ClubGallery({ images, clubName }: ClubGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const openAt = (index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  return (
    <section
      className="rounded-2xl border bg-card p-4 md:p-5"
      data-testid="club-gallery"
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="font-display font-bold text-lg md:text-xl">
          Gallery
        </h3>

        {images.length > 1 && (
          <button
            type="button"
            onClick={() => openAt(0)}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline cursor-pointer"
            data-testid="club-gallery-view-all"
          >
            View all photos
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {images.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground rounded-xl bg-muted/40"
          data-testid="club-gallery-empty"
        >
          <ImageOff className="w-8 h-8" />
          <p className="text-sm">No photos yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => openAt(0)}
            className="block w-full rounded-xl overflow-hidden aspect-video bg-muted cursor-pointer"
            data-testid="club-gallery-main-image"
          >
            <img
              src={images[0]}
              alt={clubName}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </button>

          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.slice(1, 5).map((img, i) => {
                const isLastVisible = i === 3 && images.length > 5;
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
                        +{images.length - 5}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
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
