import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TravelGalleryProps {
  images?: string[];
}

export function TravelGallery({
  images = [],
}: TravelGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images.length) return null;

  const next = () => {
    setActiveIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    );
  };

  const prev = () => {
    setActiveIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-display font-bold mb-5">
        Retreat Gallery
      </h2>

      <div className="bg-card border rounded-3xl p-4 md:p-5 shadow-sm">

        {/* Desktop + Tablet */}
        <div className="hidden md:block">
          <div className="relative overflow-hidden rounded-2xl">
            <img
              src={images[activeIndex]}
              alt={`Gallery ${activeIndex + 1}`}
              className="
                w-full
                aspect-[16/9]
                object-cover
              "
            />

            <Button
              size="icon"
              variant="secondary"
              onClick={prev}
              className="
                absolute
                left-4
                top-1/2
                -translate-y-1/2
                rounded-full
                bg-white/90
                hover:bg-white
              "
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <Button
              size="icon"
              variant="secondary"
              onClick={next}
              className="
                absolute
                right-4
                top-1/2
                -translate-y-1/2
                rounded-full
                bg-white/90
                hover:bg-white
              "
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-3 mt-3">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`
                  overflow-hidden
                  rounded-xl
                  border-2
                  transition-all
                  ${
                    activeIndex === index
                      ? "border-primary"
                      : "border-transparent"
                  }
                `}
              >
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  className="
                    w-full
                    h-20
                    object-cover
                  "
                />
              </button>
            ))}
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <div className="relative overflow-hidden rounded-2xl">
            <img
              src={images[activeIndex]}
              alt={`Gallery ${activeIndex + 1}`}
              className="
                w-full
                aspect-[4/3]
                object-cover
              "
            />

            <Button
              size="icon"
              variant="secondary"
              onClick={prev}
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                h-8
                w-8
                rounded-full
                bg-white/90
              "
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <Button
              size="icon"
              variant="secondary"
              onClick={next}
              className="
                absolute
                right-3
                top-1/2
                -translate-y-1/2
                h-8
                w-8
                rounded-full
                bg-white/90
              "
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <div
              className="
                absolute
                top-3
                right-3
                bg-black/70
                text-white
                text-xs
                px-2
                py-1
                rounded-full
              "
            >
              {activeIndex + 1}/{images.length}
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-4">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`
                  h-2
                  w-2
                  rounded-full
                  transition-all
                  ${
                    activeIndex === index
                      ? "bg-primary w-4"
                      : "bg-primary/30"
                  }
                `}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}