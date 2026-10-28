import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "/assets/images/tennis_main.jpg";
import { Link } from "wouter";
import { HeroBadge } from "@/components/shared/hero-badge";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-end md:items-center overflow-hidden pt-16 pb-24 md:pb-0 bg-black">
      {/* Background Image - Positioned to the right with blending */}
      <div className="absolute inset-0 z-0">
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-[75%] h-full">
          <img
            src={heroImage}
            alt="Tennis Player"
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover object-[50%_0%]"
          />
          {/* Gradient Overlay for Text Legibility - Lighter intensity */}
          <div className="absolute inset-0 bg-linear-to-r from-black via-black/10 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent" />
        </div>
      </div>

      {/* Content */}
      <div className="container relative z-10 px-4 mx-auto text-center xl:text-left">
        <div className="max-w-2xl xl:max-w-3xl mx-auto xl:mx-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <HeroBadge className="mb-6">NOW LIVE IN SYDNEY</HeroBadge>
            
            <h1 className="
              text-[1.75rem]
                sm:text-5xl
                xl:text-7xl
                font-display
                font-bold
                text-white
                leading-[1.1]
                mb-6
                tc-hero-text">
              <span className="bg-[rgba(0,0,0,0.3)] rounded-xl py-0.5 box-decoration-clone [box-shadow:-12px_0_0_rgba(0,0,0,0.3),12px_0_0_rgba(0,0,0,0.3)]">Everything You Need for</span><br />
              <span className="text-primary relative inline-block bg-black/40 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none rounded-lg px-2 py-0.5 sm:px-0 sm:py-0">
              Your Tennis Journey
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/50" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              </span> 
            </h1>
             
            <p className="text-lg md:text-xl text-white mb-8 max-w-xl mx-auto xl:mx-0 leading-relaxed tc-hero-intro">
            Bringing Australia's tennis community together — one platform for every player.
            </p>
            
            <div className="flex flex-col items-center sm:items-stretch sm:flex-row gap-4 justify-center xl:justify-start">
              <Link href="/players" className="w-2/3 sm:w-auto">
                <Button size="lg" className="
                  group
                  w-full
                  sm:w-auto
                  ">
                  Find a Player
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/coaches" className="w-2/3 sm:w-auto">
                <Button size="lg" variant="inverse" className="
                    group
                    w-full
                    sm:w-auto
                  ">
                   Find a Coach
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
