import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { ConnectWord } from "@/components/ui/brandBall";

// TennisConnect logo for the compact (phone + tablet) top bar of the Organiser Hub
// and Admin screens, where the sidebar with the logo is hidden.
export function OrganiserBarLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("mr-auto md:ml-2 flex shrink-0 items-center gap-1 whitespace-nowrap font-display text-lg font-bold leading-none", className)}
      data-testid="organiser-bar-logo"
    >
      Tennis<span className="text-primary"><ConnectWord /></span>
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
    </Link>
  );
}
