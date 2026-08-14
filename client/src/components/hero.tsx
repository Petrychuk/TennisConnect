import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "/assets/images/tennis_main.jpg";
import { Link } from "wouter";

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
      <div className="container relative z-10 px-4 mx-auto text-center lg:text-left">
        <div className="max-w-2xl xl:max-w-3xl mx-auto lg:mx-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md mb-6">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-bold tracking-wider uppercase text-white">
              NOW LIVE IN SYDNEY
              </span>
            </div>
            
            <h1 className="
              text-[1.75rem]
                sm:text-5xl
                lg:text-7xl
                font-display
                font-bold
                text-white
                leading-[1.1]
                mb-6
                drop-shadow-xl">
              Everything You Need for  <br />
              <span className="text-primary relative inline-block">
              Your Tennis Journey
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/50" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              </span> 
            </h1>
             
            <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-xl leading-relaxed drop-shadow-md">
            Bringing Australia's tennis community together — one platform for every player.
            </p>
            
            <div className="flex flex-col items-center sm:items-stretch sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/players" className="w-2/3 sm:w-auto">
                <Button size="lg" className="h-11
                  sm:h-14
                  w-full
                  sm:w-auto
                  bg-primary
                  text-primary-foreground
                  hover:bg-primary/90
                  font-bold
                  text-lg
                  px-8
                  rounded-full
                  shadow-[0_0_20px_rgba(223,255,0,0.3)]
                  hover:shadow-[0_0_30px_rgba(223,255,0,0.5)]
                  transition-all
                  duration-300
                  group
                  cursor-pointer">
                  Find a Player
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/coaches" className="w-2/3 sm:w-auto">
                <Button size="lg" variant="outline" className="
                    w-full
                    sm:w-auto
                    bg-[rgba(163,230,53,0.08)]
                    border-primary/30
                    text-white
                    hover:bg-black/90
                    hover:border-primary/60
                    hover:shadow-[0_0_25px_hsl(var(--tennis-ball)/0.25)]
                    font-bold
                    text-lg
                    h-11
                    sm:h-14
                    px-8
                    rounded-full
                    backdrop-blur-md
                    transition-all
                    duration-300
                    cursor-pointer
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
