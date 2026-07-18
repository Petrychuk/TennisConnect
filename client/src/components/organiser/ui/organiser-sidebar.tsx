import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  CalendarDays,
  Users,
  CalendarRange,
  Trophy,
  MessageSquare,
  FileBarChart,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganiserUser } from "@/lib/organiser-hub-mock-data";

interface NavItem {
  key: string;
  label: string;
  icon: typeof Home;
  active?: boolean;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: Home, active: true },
  { key: "sessions", label: "Sessions", icon: CalendarDays },
  { key: "players", label: "Players", icon: Users },
  { key: "seasons", label: "Seasons", icon: CalendarRange },
  { key: "rankings", label: "Rankings", icon: Trophy },
  { key: "messages", label: "Messages", icon: MessageSquare, badge: 3 },
  { key: "reports", label: "Reports", icon: FileBarChart },
  { key: "settings", label: "Settings", icon: Settings },
];

interface OrganiserSidebarProps {
  organiser: OrganiserUser;
  className?: string;
}

// Only "Home" renders anything right now — this is the mock-data pass, the
// rest of the nav is visually complete but not wired to real pages yet.
export function OrganiserSidebarNav({ organiser, className }: OrganiserSidebarProps) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="text-xl font-display font-bold flex items-center gap-1">
          Tennis<span className="text-primary">Connect</span>
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
        </Link>
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground mt-4 px-1">
          ORGANISER HUB
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-1" data-testid="organiser-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                item.active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground opacity-60 cursor-not-allowed"
              )}
              data-testid={`organiser-sidebar-nav-${item.key}`}
              title={item.active ? undefined : "Coming soon"}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <Badge className="h-5 min-w-5 px-1.5 justify-center">{item.badge}</Badge>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 mt-auto">
        <div
          className="flex items-center gap-3 rounded-xl border border-border p-3"
          data-testid="organiser-sidebar-user"
        >
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={organiser.avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {organiser.name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{organiser.name} Coach</p>
            <p className="text-xs text-muted-foreground">{organiser.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
