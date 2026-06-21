import { motion } from "framer-motion";

interface TravelFullExperienceProps {
  content?: string;
}

export function TravelFullExperience({
  content,
}: TravelFullExperienceProps) {
  if (!content) return null;

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
            text-2xl
            md:text-2xl
            mb-4
          "
        >
          The Full Experience
        </h2>

        <div className="max-w-4xl">
          <div
            className="
              prose
              prose-sm
              md:prose-base
              max-w-none
              text-muted-foreground
            "
          >
            {content
              .split("\n")
              .filter(Boolean)
              .map((paragraph, index) => (
                <p
                  key={index}
                  className="
                    leading-6
                    md:leading-7
                    mb-4
                  "
                >
                  {paragraph}
                </p>
              ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}