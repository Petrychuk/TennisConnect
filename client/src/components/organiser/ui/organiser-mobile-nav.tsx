import { Home, CalendarDays, Users, CalendarRange, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "home", label: "Home", icon: Home, active: true },
  { key: "sessions", label: "Sessions", icon: CalendarDays },
  { key: "players", label: "Players", icon: Users },
  { key: "seasons", label: "Seasons", icon: CalendarRange },
  { key: "more", label: "More", icon: MoreHorizontal },
];

// Mirrors the site's existing mobile bottom nav pattern (see navbar.tsx) so
// an Organiser moving between the public site and the hub sees the same
// bottom-bar convention.
export function OrganiserMobileNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      data-testid="organiser-mobile-nav"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
              item.active ? "text-primary" : "text-muted-foreground opacity-60"
            )}
            data-testid={`organiser-mobile-nav-${item.key}`}
          >
            <Icon className="w-5 h-5" />
            {item.label}
          </div>
        );
      })}
    </nav>
  );
}
