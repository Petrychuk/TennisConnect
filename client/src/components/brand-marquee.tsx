import { motion } from "framer-motion";

const brands = [
  "Wilson",
  "Babolat", 
  "Head",
  "Nike",
  "Adidas",
  "Yonex",
  "Prince",
  "Tecnifibre",
  "Dunlop",
  "Asics",
  "Lacoste",
  "New Balance",
];

// Duplicate for seamless infinite scroll
const duplicatedBrands = [...brands, ...brands, ...brands];

export function BrandMarquee() {
  return (
    <section className="py-6 bg-secondary/30 overflow-hidden relative">
      {/* Gradient Overlays */}
      <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-r from-secondary/30 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-l from-secondary/30 to-transparent z-10 pointer-events-none" />
      
      <div className="container mx-auto px-4 mb-4">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-xs uppercase tracking-widest text-muted-foreground font-medium"
        >
          Trusted by the world's leading tennis brands
        </motion.p>
      </div>

      {/* Marquee Container */}
      <div className="relative">
        <motion.div
          className="flex gap-8 md:gap-12 items-center"
          animate={{
            x: [0, -100 * brands.length],
          }}
          transition={{
            x: {
              duration: 120,
              repeat: Infinity,
              ease: "linear",
            },
          }}
        >
          {duplicatedBrands.map((brand, index) => (
            <div
              key={`${brand}-${index}`}
              className="shrink-0 px-4 md:px-6 py-2 rounded-full bg-background/60 backdrop-blur-sm border border-border/20 hover:border-primary/40 transition-all duration-300 hover:bg-background/80 group"
            >
              <span className="font-semibold text-sm md:text-base text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                {brand}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
