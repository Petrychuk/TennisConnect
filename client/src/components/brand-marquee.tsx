import { motion } from "framer-motion";

const brands = [
  { name: "Wilson", logo: "https://upload.wikimedia.org/wikipedia/commons/3/32/Wilson_Sporting_Goods_logo.svg" },
  { name: "Babolat", logo: "https://upload.wikimedia.org/wikipedia/commons/4/4d/Babolat_logo.svg" },
  { name: "Head", logo: "https://upload.wikimedia.org/wikipedia/commons/9/97/Head_Logo.svg" },
  { name: "Nike", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg" },
  { name: "Adidas", logo: "https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg" },
  { name: "Yonex", logo: "https://upload.wikimedia.org/wikipedia/commons/4/44/Yonex_logo.svg" },
  { name: "Prince", logo: "https://upload.wikimedia.org/wikipedia/commons/8/8b/Prince_Sports_logo.svg" },
  { name: "Tecnifibre", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f9/Tecnifibre_logo.svg" },
  { name: "Dunlop", logo: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Dunlop_Sport_logo.svg" },
  { name: "Asics", logo: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Asics_Logo.svg" },
  { name: "Lacoste", logo: "https://upload.wikimedia.org/wikipedia/commons/9/90/Lacoste_logo.svg" },
  { name: "New Balance", logo: "https://upload.wikimedia.org/wikipedia/commons/e/ea/New_Balance_logo.svg" },
];

// Duplicate for seamless infinite scroll
const duplicatedBrands = [...brands, ...brands];

export function BrandMarquee() {
  return (
    <section className="py-16 bg-secondary/30 overflow-hidden relative">
      {/* Gradient Overlays */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-secondary/30 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-secondary/30 to-transparent z-10 pointer-events-none" />
      
      <div className="container mx-auto px-4 mb-8">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-sm uppercase tracking-widest text-muted-foreground font-medium"
        >
          Trusted by the world's leading tennis brands
        </motion.p>
      </div>

      {/* Marquee Container */}
      <div className="relative">
        <motion.div
          className="flex gap-16 items-center"
          animate={{
            x: [0, -50 * brands.length * 8],
          }}
          transition={{
            x: {
              duration: 40,
              repeat: Infinity,
              ease: "linear",
            },
          }}
        >
          {duplicatedBrands.map((brand, index) => (
            <div
              key={`${brand.name}-${index}`}
              className="flex items-center gap-3 shrink-0 px-6 py-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border/30 hover:border-primary/30 transition-colors group"
            >
              <div className="w-10 h-10 flex items-center justify-center grayscale group-hover:grayscale-0 transition-all duration-300">
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to text if image fails
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <span className="font-bold text-lg text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                {brand.name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
