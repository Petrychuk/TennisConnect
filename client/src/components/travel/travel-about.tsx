import { motion } from "framer-motion";

interface TravelAboutProps {
  description: string;
}

export function TravelAbout({
  description,
}: TravelAboutProps) {
  return (
    <section className="mb-8 md:mb-4">
      <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
        About This Retreat
      </h2>

      <div className="max-w-4xl">
        <p className="text-muted-foreground leading-6">
          {description}
        </p>
      </div>
    </section>
  );
}