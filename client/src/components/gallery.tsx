import { motion } from "framer-motion";
import img1 from "@assets/generated_images/tennis_match_action_shot_in_sydney.png";
import img2 from "@assets/generated_images/kids_tennis_training_session.png";
import img3 from "@assets/generated_images/modern_tennis_club_lounge.png";
import img4 from "@assets/generated_images/close_up_tennis_racket_hitting_ball.png";

const photos = [
  { src: img1, alt: "Match Action", span: "col-span-1 md:col-span-2 row-span-2" },
  { src: img2, alt: "Kids Training", span: "col-span-1 row-span-1" },
  { src: img3, alt: "Club Lounge", span: "col-span-1 row-span-1" },
  { src: img4, alt: "Close Up Shot", span: "col-span-1 md:col-span-2 row-span-1" },
];

export function Gallery() {
  return (
    <section className="py-24 bg-background" id="gallery">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center md:text-left">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Life on the <span className="text-primary">Court</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Feel the energy of Sydney's tennis community.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 h-auto md:h-[600px]">
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
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                <p className="text-white font-bold text-lg">{photo.alt}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
