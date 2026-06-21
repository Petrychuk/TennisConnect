import { ExternalLink } from "lucide-react";

interface TravelBookingButtonProps {
  text?: string;
  url?: string;
}

export function TravelBookingButton({
  text = "Book Now",
  url,
}: TravelBookingButtonProps) {
  const handleClick = () => {
    if (!url) return;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      disabled={!url}
      className="
        group
        relative
        w-full

        rounded-full

        bg-primary
        text-primary-foreground

        font-semibold
        text-sm
        md:text-base

        py-3.5
        px-5

        shadow-lg
        hover:shadow-xl

        hover:-translate-y-0.5
        active:translate-y-0

        transition-all
        duration-300

        disabled:opacity-50
        disabled:cursor-not-allowed

        cursor-pointer
      "
    >
      <span
        className="
          flex
          items-center
          justify-center
          gap-2
        "
      >
        {text}

        <ExternalLink
          className="
            w-4
            h-4

            transition-transform
            duration-300

            group-hover:translate-x-1
            group-hover:-translate-y-1
          "
        />
      </span>

      {/* shine effect */}

      <span
        className="
          absolute
          inset-0
          rounded-full
          overflow-hidden
          pointer-events-none
        "
      >
        <span
          className="
            absolute
            top-0
            -left-[120%]

            h-full
            w-10

            rotate-12

            bg-white/20

            transition-all
            duration-700

            group-hover:left-[120%]
          "
        />
      </span>
    </button>
  );
}