import { motion } from "framer-motion";

// Brand logos as inline SVGs for reliability
const brands = [
  {
    name: "Wilson",
    light: false,
    logo: (
      <svg viewBox="0 0 100 20" className="h-5 w-auto">
        <text x="0" y="16" className="fill-current font-bold text-[16px]" style={{fontFamily: 'Arial Black, sans-serif'}}>WILSON</text>
      </svg>
    )
  },
  {
    name: "Babolat",
    light: false,
    logo: (
      <svg viewBox="0 0 100 24" className="h-5 w-auto">
        <text x="0" y="18" className="fill-current font-bold text-[14px]" style={{fontFamily: 'Arial, sans-serif'}}>BABOLAT</text>
      </svg>
    )
  },
  {
    name: "Head",
    light: false,
    logo: (
      <svg viewBox="0 0 60 24" className="h-6 w-auto">
        <text x="0" y="18" className="fill-current font-black text-[18px]" style={{fontFamily: 'Impact, sans-serif'}}>HEAD</text>
      </svg>
    )
  },
  {
    name: "Nike",
    light: false,
    logo: (
      <svg viewBox="0 0 100 35" className="h-5 w-auto">
        <path className="fill-current" d="M21 0c-1.2 0-2.3.2-3.4.6L.5 30.8c-.3.9-.5 1.8-.5 2.7 0 .9.7 1.5 1.5 1.5.7 0 1.4-.4 1.9-1l45.6-25.8c1.5-.8 3.1-1.2 4.7-1.2 1.5 0 3 .4 4.3 1.1L100 30.5V8.9L58.4.7C55.8.2 53.1 0 50.5 0H21z"/>
      </svg>
    )
  },
  {
    name: "Adidas",
    light: false,
    logo: (
      <svg viewBox="0 0 100 60" className="h-6 w-auto">
        <path className="fill-current" d="M50 0L0 60h20l30-36 30 36h20L50 0zm0 18l18 22H32l18-22z"/>
      </svg>
    )
  },
  {
    name: "Yonex",
    light: false,
    logo: (
      <svg viewBox="0 0 80 24" className="h-5 w-auto">
        <text x="0" y="18" className="fill-current font-bold text-[16px]" style={{fontFamily: 'Arial, sans-serif'}}>YONEX</text>
      </svg>
    )
  },
  {
    name: "Prince",
    light: false,
    logo: (
      <svg viewBox="0 0 80 24" className="h-5 w-auto">
        <text x="0" y="18" className="fill-current font-bold text-[15px]" style={{fontFamily: 'Georgia, serif'}}>PRINCE</text>
      </svg>
    )
  },
  {
    name: "Tecnifibre",
    light: false,
    logo: (
      <svg viewBox="0 0 100 20" className="h-4 w-auto">
        <text x="0" y="15" className="fill-current font-semibold text-[12px]" style={{fontFamily: 'Arial, sans-serif'}}>TECNIFIBRE</text>
      </svg>
    )
  },
  {
    name: "Dunlop",
    light: true,
    logo: (
      <svg viewBox="0 0 90 24" className="h-5 w-auto">
        <text x="0" y="18" className="fill-current font-bold text-[16px]" style={{fontFamily: 'Arial Black, sans-serif'}}>DUNLOP</text>
      </svg>
    )
  },
  {
    name: "Asics",
    light: false,
    logo: (
      <svg viewBox="0 0 70 24" className="h-5 w-auto">
        <text x="0" y="18" className="fill-current font-bold italic text-[16px]" style={{fontFamily: 'Arial, sans-serif'}}>ASICS</text>
      </svg>
    )
  },
  {
    name: "Lacoste",
    light: false,
    logo: (
      <svg viewBox="0 0 24 24" className="h-6 w-auto">
        <path className="fill-[#00703C]" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.5 14c-1 1-2.5 1.5-4 1.5s-3-.5-4-1.5c-.5-.5-.5-1 0-1.5.5-.5 1-.5 1.5 0 .5.5 1.5 1 2.5 1s2-.5 2.5-1c.5-.5 1-.5 1.5 0s.5 1 0 1.5zM8 11c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1zm8 0c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1z"/>
      </svg>
    )
  },
  {
    name: "New Balance",
    light: false,
    logo: (
      <svg viewBox="0 0 100 24" className="h-5 w-auto">
        <text x="0" y="17" className="fill-current font-bold text-[13px]" style={{fontFamily: 'Arial, sans-serif'}}>NEW BALANCE</text>
      </svg>
    )
  },
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
          className="flex gap-6 md:gap-10 items-center"
          animate={{
            x: [0, -120 * brands.length],
          }}
          transition={{
            x: {
              duration: 100,
              repeat: Infinity,
              ease: "linear",
            },
          }}
        >
          {duplicatedBrands.map((brand, index) => (
            <div
              key={`${brand.name}-${index}`}
              className={`shrink-0 px-5 md:px-6 py-2.5 rounded-full backdrop-blur-sm border transition-all duration-300 group flex items-center gap-2 ${
                brand.light 
                  ? 'bg-gray-800 border-gray-700 hover:border-primary/60 text-white' 
                  : 'bg-background/70 border-border/30 hover:border-primary/40 hover:bg-background/90 text-foreground'
              }`}
            >
              <div className="opacity-70 group-hover:opacity-100 transition-opacity">
                {brand.logo}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
