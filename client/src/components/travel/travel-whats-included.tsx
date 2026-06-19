import { Check  } from "lucide-react";
import { motion } from "framer-motion";

interface TravelWhatsIncludedProps {
  includes?: string[];
}

export function TravelWhatsIncluded({
  includes,
}: TravelWhatsIncludedProps) {
  if (!includes?.length) return null;

  return (
    <section className="mt-10 md:mt-12">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h2
          className="
            font-display
            font-bold
            text-1xl
            md:text-2xl
            mb-5
          "
        >
          What's Included
        </h2>

        <div
          className="
            grid
            grid-cols-1
            md:grid-cols-3
            gap-x-8
            gap-y-2
          "
        >
          {includes.map((item) => (
            <div
              key={item}
              className="
                flex
                items-start
                gap-3
              "
            >
              <div
                className="
                  w-5 h-5
                  rounded-full
                  bg-primary
                  flex
                  items-center
                  justify-center
                  shrink-0
                  mt-0.5
                "
              >
                <Check
                  className="
                    w-3 h-3
                    text-white
                    stroke-[3]
                  "
                />
              </div>

              <span
                className="
                  text-sm
                  md:text-base
                  leading-6
                  text-foreground
                "
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}