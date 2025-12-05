import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "@assets/118174652_3488272227872998_1093348718284959373_n_1764914380008.jpg";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16 bg-black">
      {/* Background Image - Positioned to the right with blending */}
      <div className="absolute inset-0 z-0">
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-[75%] h-full">
          <img
            src={heroImage}
            alt="Tennis Player"
            className="w-full h-full object-cover object-[50%_15%] opacity-90"
          />
          {/* Gradient Overlay for Text Legibility - Heavy on the left */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        </div>
      </div>

      {/* Content */}
      <div className="container relative z-10 px-4 mx-auto text-center md:text-left">
        <div className="max-w-3xl mx-auto md:mx-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md mb-6">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-bold tracking-wider uppercase text-white">
                Sydney Season Open
              </span>
            </div>
            
            <h1 className="text-4xl md:text-7xl font-display font-bold text-white leading-[1.1] mb-6 drop-shadow-xl">
              Find your perfect <br />
              <span className="text-primary relative inline-block">
                tennis partner
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/50" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              </span> in Australia
            </h1>
            
            <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-xl leading-relaxed drop-shadow-md">
              Join Australia's largest tennis community. Find sparring partners, professional coaches, and book courts across Sydney, Melbourne, and Brisbane.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-lg h-14 px-8 rounded-full shadow-[0_0_20px_rgba(223,255,0,0.3)] hover:shadow-[0_0_30px_rgba(223,255,0,0.5)] transition-all duration-300 group">
                Find a Partner
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-bold text-lg h-14 px-8 rounded-full backdrop-blur-md">
                I'm a Coach
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
