import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

// Real photos from the TennisConnect community, replacing the placeholder
// set below (kept, commented out, in case we want to bring any of them
// back later - not deleted).
import img1 from "/assets/images/community_net_handshake.webp";
import img2 from "/assets/images/clubhouse_social_lounge.webp";
import img3 from "/assets/images/ao_gear_courtside.webp";
import img4 from "/assets/images/ao_practice_courts.webp";

// import img1 from "/assets/images/tennis_match_action_shot_in_sydney.webp";
// import img2 from "/assets/images/kids_tennis_training_session.webp";
// import img3 from "/assets/images/modern_tennis_club_lounge.webp";
// import img4 from "/assets/images/close_up_tennis_racket_hitting_ball.webp";

// Second, smaller row - more moments from around the community, in a
// uniform grid that wraps naturally at every breakpoint (2 cols on
// mobile, 3 on tablet, 5 on desktop) instead of the fixed mosaic above.
import img5 from "/assets/images/tennis_world_entrance.webp";
import img6 from "/assets/images/eastside_tennis_centre.webp";
import img7 from "/assets/images/ao_nadal_sculpture.webp";
import img8 from "/assets/images/ao_venue_crowd.webp";
import img9 from "/assets/images/wide_courts_view.webp";

const photos = [
  { src: img1, alt: "Sportsmanship at the net after a match", span: "col-span-1 md:col-span-2 row-span-2" },
  { src: img2, alt: "Clubhouse hangout after tennis", span: "col-span-1 row-span-1" },
  { src: img3, alt: "Courtside gear at the Australian Open", span: "col-span-1 row-span-1" },
  { src: img4, alt: "Practice courts at the Australian Open", span: "col-span-1 md:col-span-2 row-span-1" },
];

const morePhotos = [
  { src: img5, alt: "Tennis World, Sydney Olympic Park" },
  { src: img6, alt: "Eastside Tennis Centre" },
  { src: img7, alt: "Australian Open grounds" },
  { src: img8, alt: "Between matches at the Open" },
  { src: img9, alt: "Courts ready for play" },
];

// Auto-advances a Carousel every few seconds - built on the app's existing
// embla-carousel-react setup (no new dependency), same as the ordinary
// <Carousel> used elsewhere (e.g. the organiser dashboard stat strip).
// Pauses while the person is actively interacting so an auto-advance
// never fights a manual swipe.
function AutoScrollCarousel({
  children,
  intervalMs = 3200,
}: {
  children: React.ReactNode;
  intervalMs?: number;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!api || isPaused) return;
    const id = setInterval(() => {
      api.scrollNext();
    }, intervalMs);
    return () => clearInterval(id);
  }, [api, isPaused, intervalMs]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true, align: "start" }}
      onPointerDown={() => setIsPaused(true)}
      onPointerUp={() => setIsPaused(false)}
    >
      {children}
    </Carousel>
  );
}

export function Gallery() {
  return (
    <section className="py-24 bg-background" id="gallery">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center md:text-left">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
           The Tennis <span className="text-primary">Lifestyle</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Real moments from the TennisConnect community on and off the court.
          </p>
        </div>

        {/* Desktop/tablet: same fixed mosaic as before, untouched. */}
        <div className="hidden md:grid md:grid-cols-4 grid-rows-2 gap-4 h-[600px]">
          {photos.map((photo, index) => (
            <motion.div
              key={index}
              className={`relative overflow-hidden rounded-2xl group ${photo.span}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                <p className="text-white font-bold text-lg">{photo.alt}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile: same photos, but a swipeable auto-scrolling slider
            instead of nine full-width images stacked one under another. */}
        <div className="md:hidden">
          <AutoScrollCarousel>
            <CarouselContent>
              {photos.map((photo, index) => (
                <CarouselItem key={index} className="basis-[85%]">
                  <div className="relative aspect-4/5 overflow-hidden rounded-2xl">
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-4">
                      <p className="text-white font-bold">{photo.alt}</p>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </AutoScrollCarousel>
        </div>

        {/* Desktop/tablet: same wrapped grid as before, untouched. */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
          {morePhotos.map((photo, index) => (
            <motion.div
              key={index}
              className="relative aspect-square overflow-hidden rounded-2xl group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <p className="text-white font-bold text-sm">{photo.alt}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile: same second-row photos, also a slider. */}
        <div className="md:hidden mt-4">
          <AutoScrollCarousel intervalMs={2800}>
            <CarouselContent>
              {morePhotos.map((photo, index) => (
                <CarouselItem key={index} className="basis-[45%]">
                  <div className="relative aspect-square overflow-hidden rounded-2xl">
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-3">
                      <p className="text-white font-bold text-sm">{photo.alt}</p>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </AutoScrollCarousel>
        </div>
      </div>
    </section>
  );
}
