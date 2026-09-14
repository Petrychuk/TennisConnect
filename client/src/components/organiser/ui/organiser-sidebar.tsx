import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { getAdminSessions } from "@/lib/api/organizer-sessions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Building2,
  Plane,
  FileText,
  Heart,
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
  { key: "seasons", label: "Seasons", icon: CalendarRange, href: "/organiser/seasons" },
  { key: "rankings", label: "Rankings", icon: Trophy },
  { key: "messages", label: "Messages", icon: MessageSquare, href: "/organiser/messages" },
  { key: "reports", label: "Reports", icon: FileBarChart },
  { key: "settings", label: "Settings", icon: Settings },
];

// Same six sections the old standalone /admin page's own horizontal
// tabs had (see VALID_TABS/AdminTab in lib/adminFields.ts) - now
// reachable from anywhere in the Organiser Hub instead of only from a
// separate top-nav page. Each still just navigates to /admin?tab=X;
// admin.tsx's own tab-content logic is completely unchanged, only how
// a tab gets selected changed (sidebar click instead of a horizontal
// Tabs click).
const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: "admin-users", label: "Users", icon: Users, href: "/admin?tab=users" },
  { key: "admin-organizer-requests", label: "Organiser & Sessions", icon: ShieldCheck, href: "/admin?tab=organizer-requests" },
  { key: "admin-clubs", label: "Club Communities", icon: Building2, href: "/admin?tab=clubs" },
  { key: "admin-travel", label: "Travel Packages", icon: Plane, href: "/admin?tab=travel" },
  { key: "admin-articles", label: "Articles", icon: FileText, href: "/admin?tab=articles" },
  { key: "admin-recreation", label: "Recreation Services", icon: Heart, href: "/admin?tab=recreation" },
];

interface OrganiserSidebarProps {
  organiser: OrganiserUser;
  profileHref: string;
  className?: string;
  // Icons-only rail instead of the full labelled nav - for a tablet
  // organiser who wants the width back while running a live session,
  // without losing navigation entirely (unlike the mobile Sheet, which
  // hides the whole thing until opened). Omit both props entirely for
  // a plain, always-expanded sidebar (e.g. inside the mobile Sheet
  // itself, which has no reason to collapse - it already closes).
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

function NavList({ items, collapsed, location, badgeCounts }: { items: NavItem[]; collapsed: boolean; location: string; badgeCounts: Record<string, number> }) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        // "/organiser" itself must match exactly (else it'd also light up
        // for every /organiser/* sub-route); everything else matches by
        // prefix - except the /admin?tab=X items, which all share the
        // same /admin path and only differ by query string, so those
        // compare the full href (path + query) instead.
        const isActive = item.href
          ? item.href.startsWith("/admin?tab=")
            ? location === item.href
            : item.href === "/organiser"
            ? location === "/organiser"
            : location.startsWith(item.href)
          : false;
        const badgeCount = badgeCounts[item.key] ?? 0;

        const content = collapsed ? (
          <Icon className="w-4 h-4 shrink-0" />
        ) : (
          <>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {badgeCount > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 justify-center" data-testid={`organiser-sidebar-nav-${item.key}-badge`}>
                {badgeCount > 9 ? "9+" : badgeCount}
              </Badge>
            )}
          </>
        );

        const sharedClasses = cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          collapsed && "justify-center relative",
          isActive
            ? "bg-primary/10 text-primary"
            : item.href
            ? "text-foreground/80 hover:bg-accent/10 hover:text-foreground"
            : "text-muted-foreground opacity-60 cursor-not-allowed"
        );

        const collapsedBadgeDot = collapsed && badgeCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" data-testid={`organiser-sidebar-nav-${item.key}-badge-dot`} />
        );

        if (item.href) {
          return (
            <Link key={item.key} href={item.href} className={sharedClasses} data-testid={`organiser-sidebar-nav-${item.key}`} title={collapsed ? item.label : undefined}>
              {content}
              {collapsedBadgeDot}
            </Link>
          );
        }

        return (
          <div key={item.key} className={sharedClasses} data-testid={`organiser-sidebar-nav-${item.key}`} title={collapsed ? item.label : "Coming soon"}>
            {content}
          </div>
        );
      })}
    </>
  );
}

// "Home" and "Sessions" are wired up to real pages now — the rest is
// visually complete but not built yet, so it stays a disabled-looking
// placeholder instead of a dead link.
//
// Wrapped in the project's own `.dark` scope (see index.css's
// @custom-variant dark rule) rather than hardcoded colours, so the
// permanently-dark sidebar still only ever uses the existing palette
// tokens — just their dark-theme values, scoped to this subtree.
export function OrganiserSidebarNav({ organiser, profileHref, className, collapsed = false, onToggleCollapsed }: OrganiserSidebarProps) {
  const [location] = useLocation();
  // Query string is part of matching for the /admin?tab=X items - plain
  // wouter useLocation() only gives the path, so this reads
  // window.location directly for that one comparison.
  const fullLocation = typeof window !== "undefined" ? `${location}${window.location.search}` : location;

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

  // A separate, lightweight query from AdminOrganizerRequestsTab's own
  // (that one fetches every admin session to show its full pending/
  // approved/rejected view; this just needs a count) - server-side
  // filtered to pending_review specifically rather than fetching
  // everything and filtering client-side. Only runs for an actual
  // admin - never fetched at all for a plain organiser.
  const pendingRequestsQuery = useQuery({
    queryKey: ["/api/organizer/admin/sessions", "pending_review"],
    queryFn: () => getAdminSessions("pending_review"),
    enabled: !!organiser.isAdmin,
  });
  const badgeCounts: Record<string, number> = {
    messages: unreadCount,
    "admin-organizer-requests": pendingRequestsQuery.data?.length ?? 0,
  };

  return (
    <div className={cn("dark flex flex-col h-full bg-background text-foreground", className)} data-testid="organiser-sidebar">
      <div className={cn("pt-6", collapsed ? "px-3" : "px-5")}>
        <div className="flex items-center justify-between gap-2">
          {!collapsed && (
            <Link href="/" className="text-xl font-display font-bold flex items-center gap-1" data-testid="organiser-sidebar-logo">
              Tennis<span className="text-primary">Connect</span>
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
            </Link>
          )}
          {onToggleCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 text-muted-foreground shrink-0", collapsed && "mx-auto")}
              onClick={onToggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              data-testid="organiser-sidebar-collapse-toggle"
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Avatar/profile block - moved up here right under the logo, per
          explicit request, instead of sitting at the bottom of the nav
          list below every section. */}
      <div className={cn("mt-4", collapsed ? "px-3" : "px-5")}>
        <Link
          href={profileHref}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-border hover:bg-accent/40 transition-colors",
            collapsed ? "justify-center p-2" : "p-3"
          )}
          data-testid="organiser-sidebar-user"
          title={collapsed ? organiser.name : undefined}
        >
          <Avatar className="h-9 w-9 border border-border shrink-0">
            <AvatarImage src={organiser.avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {organiser.name[0]}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{organiser.name} Coach</p>
                <p className="text-xs text-muted-foreground">{organiser.role}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </>
          )}
        </Link>
      </div>

      <nav className="px-3 pt-4 space-y-1 overflow-y-auto" data-testid="organiser-sidebar-nav">
        {!collapsed && (
          <p className="text-[11px] font-semibold tracking-widest text-muted-foreground px-2 pb-1">
            ORGANISER HUB
          </p>
        )}
        <NavList items={NAV_ITEMS} collapsed={collapsed} location={fullLocation} badgeCounts={badgeCounts} />

        {organiser.isAdmin && (
          <>
            <Separator className="my-3" />
            {!collapsed && (
              <p className="text-[11px] font-semibold tracking-widest text-muted-foreground px-2 pb-1" data-testid="organiser-sidebar-admin-label">
                ADMIN
              </p>
            )}
            <NavList items={ADMIN_NAV_ITEMS} collapsed={collapsed} location={fullLocation} badgeCounts={badgeCounts} />
          </>
        )}
      </nav>
    </div>
  );
}
