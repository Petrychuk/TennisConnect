import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TravelBookingButtonProps {
  text?: string;
  url?: string;
}

// The retreat's booking CTA - the shared lime button (button.tsx), large.
// It used to be its own pill with white text on lime (~2:1 contrast) and a
// "shine" animation; the button system now owns its shape, colours and
// states like every other primary action.
export function TravelBookingButton({
  text = "Book Now",
  url,
}: TravelBookingButtonProps) {
  const handleClick = () => {
    if (!url) return;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Button size="lg" onClick={handleClick} disabled={!url} className="group w-full shadow-md hover:shadow-lg">
      {text}
      <ExternalLink
        aria-hidden="true"
        className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
      />
      <span className="sr-only">(opens the provider's site in a new tab)</span>
    </Button>
  );
}
