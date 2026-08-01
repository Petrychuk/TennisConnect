import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Home,
  CalendarDays,
  Users,
  CalendarRange,
  Trophy,
  MessageSquare,
  FileBarChart,
  Settings,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganiserUser } from "@/lib/organiser-hub-mock-data";

interface NavItem {
  key: string;
  label: string;
  icon: typeof Home;
  href?: string; // present once the page behind it actually exists
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: Home, href: "/organiser" },
  { key: "sessions", label: "Sessions", icon: CalendarDays, href: "/organiser/sessions" },
  { key: "players", label: "Players", icon: Users, href: "/organiser/players" },
  { key: "seasons", label: "Seasons", icon: CalendarRange },
  { key: "rankings", label: "Rankings", icon: Trophy },
  { key: "messages", label: "Messages", icon: MessageSquare, href: "/messages" },
  { key: "reports", label: "Reports", icon: FileBarChart },
  { key: "settings", label: "Settings", icon: Settings },
];

interface OrganiserSidebarProps {
  organiser: OrganiserUser;
  profileHref: string;
  className?: string;
}

// "Home" and "Sessions" are wired up to real pages now — the rest is
// visually complete but not built yet, so it stays a disabled-looking
// placeholder instead of a dead link.
//
// Wrapped in the project's own `.dark` scope (see index.css's
// @custom-variant dark rule) rather than hardcoded colours, so the
// permanently-dark sidebar still only ever uses the existing palette
// tokens — just their dark-theme values, scoped to this subtree.
export function OrganiserSidebarNav({ organiser, profileHref, className }: OrganiserSidebarProps) {
  const [location] = useLocation();

  // Same endpoint the navbar's own unread badge already uses - one
  // shared inbox, so the count here always matches whatever the
  // organiser would see opening /messages from their profile instead.
  const unreadQuery = useQuery({
    queryKey: ["/api/messages/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/messages/unread-count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
  });
  const unreadCount = unreadQuery.data?.count ?? 0;

  return (
    <div className={cn("dark flex flex-col h-full bg-background text-foreground", className)} data-testid="organiser-sidebar">
      <div className="px-5 pt-6">
        <Link href="/" className="text-xl font-display font-bold flex items-center gap-1" data-testid="organiser-sidebar-logo">
          Tennis<span className="text-primary">Connect</span>
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
        </Link>
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground mt-3 px-1">
          ORGANISER HUB
        </p>
      </div>

      <nav className="px-3 pt-4 space-y-1" data-testid="organiser-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          // "/organiser" itself must match exactly (else it'd also light up
          // for every /organiser/* sub-route); everything else matches by prefix.
          const isActive = item.href
            ? item.href === "/organiser"
              ? location === "/organiser"
              : location.startsWith(item.href)
            : false;

          const content = (
            <>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.key === "messages" && unreadCount > 0 && (
                <Badge className="h-5 min-w-5 px-1.5 justify-center" data-testid={`organiser-sidebar-nav-${item.key}-badge`}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </>
          );

          const sharedClasses = cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive
              ? "bg-primary/10 text-primary"
              : item.href
              ? "text-foreground/80 hover:bg-accent/10 hover:text-foreground"
              : "text-muted-foreground opacity-60 cursor-not-allowed"
          );

          if (item.href) {
            return (
              <Link key={item.key} href={item.href} className={sharedClasses} data-testid={`organiser-sidebar-nav-${item.key}`}>
                {content}
              </Link>
            );
          }

          return (
            <div key={item.key} className={sharedClasses} data-testid={`organiser-sidebar-nav-${item.key}`} title="Coming soon">
              {content}
            </div>
          );
        })}

        <Separator className="my-3" />

        <Link
          href={profileHref}
          className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-accent/40 transition-colors"
          data-testid="organiser-sidebar-user"
        >
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={organiser.avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {organiser.name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{organiser.name} Coach</p>
            <p className="text-xs text-muted-foreground">{organiser.role}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
      </nav>
    </div>
  );
}
