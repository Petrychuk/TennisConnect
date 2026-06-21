import {
    Bed,
    Trophy,
    Users,
    Waves,
    UtensilsCrossed,
    Plane,
    Dumbbell,
    Sparkles,
    LucideIcon,
  } from "lucide-react";
  
  interface TravelHighlightsProps {
    highlights?: string[];
  }
  
  const getIcon = (text: string): LucideIcon => {
    const value = text.toLowerCase();
  
    if (
      value.includes("accommodation") ||
      value.includes("hotel") ||
      value.includes("luxury")
    )
      return Bed;
  
    if (
      value.includes("coach") ||
      value.includes("coaching") ||
      value.includes("clinic")
    )
      return Dumbbell;
  
    if (
      value.includes("social") ||
      value.includes("community") ||
      value.includes("group")
    )
      return Users;
  
    if (
      value.includes("wellness") ||
      value.includes("surf") ||
      value.includes("retreat")
    )
      return Waves;
  
    if (
      value.includes("tournament") ||
      value.includes("competition")
    )
      return Trophy;
  
    if (
      value.includes("dining") ||
      value.includes("food") ||
      value.includes("restaurant")
    )
      return UtensilsCrossed;
  
    if (
      value.includes("travel") ||
      value.includes("trip")
    )
      return Plane;
  
    return Sparkles;
  };
  
  export default function TravelHighlights({
    highlights = [],
  }: TravelHighlightsProps) {
    if (!highlights.length) return null;
  
    return (
      <section
        className="
          relative
          z-20
          -mt-4
          md:-mt-6
          lg:-mt-8
          mb-6 
          md:mb-8
        "
      >
        <div className="container mx-auto px-4">
          <div
            className="
              bg-white
              rounded-3xl
              shadow-xl
              border
              border-border
              p-3
              md:p-4
            "
          >
            <div
              className="
                grid
                grid-cols-3
                gap-3

                md:flex
                md:flex-nowrap
                md:justify-center
                md:gap-4
              "
            >
              {highlights.map((item) => {
                const Icon = getIcon(item);
  
                return (
                  <div
                    key={item}
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      text-center
  
                      rounded-2xl
                      border
                      border-border
  
                      bg-background/95
  
                      px-3
                      py-3
  
                      md:min-w-[130px]
                      lg:min-w-[150px]
  
                      transition-all
                      duration-300
  
                      hover:-translate-y-1
                      hover:shadow-lg
                    "
                  >
                    <div
                      className="
                        w-8 h-8
                        md:w-12 md:h-12
                        rounded-full
  
                        bg-primary/10
  
                        flex
                        items-center
                        justify-center
  
                        mb-3
                      "
                    >
                      <Icon
                        className="
                          w-6
                          h-6
                          text-primary
                        "
                      />
                    </div>
  
                    <span
                      className="
                        text-xs
                        md:text-sm
                        font-medium
                        leading-tight
                        line-clamp-2
                      "
                    >
                      {item}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }