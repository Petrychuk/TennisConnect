import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TravelHeroProps {
  title: string;
  destination: string;
  startDate: string | null;
  coverImage: string;
  providerName?: string;
  isFeatured?: boolean;
}

export function TravelHero({
  title,
  destination,
  startDate,
  coverImage,
  providerName,
  isFeatured,
}: TravelHeroProps) {
  const formattedDate = startDate
    ? new Date(startDate).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Date TBA";

  return (
    <section className="relative mt-16 overflow-hidden">
      {/* Background Image */}
      <div className="relative 
        h-[420px]
        sm:h-[500px]
        md:h-[600px]
        lg:h-[700px]">
        <img
          src={coverImage}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />

        <div className="container mx-auto px-4 h-full relative z-10">
          {/* Back button */}
          <div className="pt-6">
              <Link href="/travel">
                <Button variant="ghost" className="mb-6 text-white gap-2 cursor-pointer">
                  <ArrowLeft className="w-4 h-4" /> All Packages
                </Button>
              </Link>
          </div>

          {/* Content */}
          <div className="h-full flex items-end pb-28 md:pb-24 lg:pb-36">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-4xl"
            >
              {isFeatured && (
                <Badge
                  className="
                    mb-4
                    bg-primary
                    text-primary-foreground
                    font-semibold
                    rounded-full
                  "
                >
                Featured Travel Experience
                </Badge>
              )}

              <h1
                className="
                text-[28px]
                leading-[0.95]

                sm:text-[42px]
                md:text-5xl
                xl:text-6xl

                font-display
                font-bold
                text-white

                max-w-[260px]
                sm:max-w-[320px]
                md:max-w-3xl
              "
              >
                {title}
              </h1>

              {providerName && (
                <p className="text-white/90 text-base md:text-xl mb-5">
                  by <span className="font-semibold">{providerName}</span>
                </p>
              )}

              <div className="flex flex-wrap gap-4 md:gap-6 text-white/90">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span>{destination}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <span>{formattedDate}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}