import { Link, useLocation } from "wouter";
import { Home, CalendarDays, Users, CalendarRange, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "home", label: "Home", icon: Home, href: "/organiser" },
  { key: "sessions", label: "Sessions", icon: CalendarDays, href: "/organiser/sessions" },
  { key: "players", label: "Players", icon: Users, href: "/organiser/players" },
  { key: "seasons", label: "Seasons", icon: CalendarRange },
  { key: "more", label: "More", icon: MoreHorizontal },
];

// Mirrors the site's existing mobile bottom nav pattern (see navbar.tsx) so
// an Organiser moving between the public site and the hub sees the same
// bottom-bar convention. "Home" and "Sessions" are real now; the rest is
// still a placeholder until those pages exist.
export function OrganiserMobileNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
      data-testid="organiser-mobile-nav"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.href
          ? item.href === "/organiser"
            ? location === "/organiser"
            : location.startsWith(item.href)
          : false;

        const content = (
          <>
            <Icon className="w-5 h-5" />
            {item.label}
          </>
        );

        const sharedClasses = cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
          isActive ? "text-primary" : item.href ? "text-muted-foreground" : "text-muted-foreground opacity-60"
        );

        if (item.href) {
          return (
            <Link key={item.key} href={item.href} className={sharedClasses} data-testid={`organiser-mobile-nav-${item.key}`}>
              {content}
            </Link>
          );
        }

        return (
          <div key={item.key} className={sharedClasses} data-testid={`organiser-mobile-nav-${item.key}`} title="Coming soon">
            {content}
          </div>
        );
      })}
    </nav>
  );
}
