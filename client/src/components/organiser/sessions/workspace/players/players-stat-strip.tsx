import { Users, CheckCircle2, Hourglass, XCircle, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionListItem, SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface PlayersStatStripProps {
  session: SessionListItem;
  players: SessionPlayer[];
}

export function PlayersStatStrip({ session, players }: PlayersStatStripProps) {
  const registered = players.filter((p) => p.status === "registered").length;
  const checkedIn = players.filter((p) => p.status === "registered" && p.checkedIn).length;
  const waiting = players.filter((p) => p.status === "waiting").length;
  const cancelled = players.filter((p) => p.status === "cancelled").length;
  const spotsLeft = session.maxParticipants !== null ? Math.max(session.maxParticipants - registered, 0) : null;

  const items = [
    { key: "registered", icon: Users, value: String(registered), label: "Registered" },
    { key: "checkedin", icon: CheckCircle2, value: String(checkedIn), label: "Checked In" },
    { key: "waiting", icon: Hourglass, value: String(waiting), label: "Waiting List" },
    { key: "cancelled", icon: XCircle, value: String(cancelled), label: "Cancelled" },
    ...(spotsLeft !== null ? [{ key: "spots", icon: UserPlus, value: String(spotsLeft), label: "Spots Left" }] : []),
    // No separate "Registration Open/Closed" tile here anymore - the
    // session's status badge at the top of the page (next to the
    // title) already says this; repeating it as a 6th stat card was
    // redundant, not additional information.
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="organiser-players-stat-strip">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className={cn(
              "rounded-2xl border border-border p-3 flex items-center gap-3",
              item.value === null && "justify-center text-center"
            )}
            data-testid={`organiser-players-stat-${item.key}`}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              {item.value !== null && <p className="text-lg font-bold leading-tight">{item.value}</p>}
              <p className="text-xs text-muted-foreground truncate">{item.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
