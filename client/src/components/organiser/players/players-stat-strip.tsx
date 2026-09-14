import { Users, UserCheck, RefreshCcw } from "lucide-react";

interface PlayersSummary {
  totalPlayers: number;
  activeThisSeason: number;
  returningPlayers: number;
}

interface PlayersStatStripProps {
  summary: PlayersSummary;
}

// Deliberately just 3 real metrics - was 5, two of which
// (Avg. Rating, New this month) were either entirely fake (no rating
// system exists) or never had real data behind them, and every card
// carried a fabricated "+X%" delta with no real historical comparison
// backing it. A "Groups" KPI isn't added here either - that's Phase 2
// (a real Player Group object doesn't exist yet), and showing a fake
// count would be the same mistake as the ones just removed.
export function PlayersStatStrip({ summary }: PlayersStatStripProps) {
  const items = [
    { key: "total", icon: Users, value: String(summary.totalPlayers), label: "Total Players" },
    { key: "active", icon: UserCheck, value: String(summary.activeThisSeason), label: "Active Players", sublabel: "This season" },
    { key: "returning", icon: RefreshCcw, value: `${summary.totalPlayers > 0 ? Math.round((summary.returningPlayers / summary.totalPlayers) * 100) : 0}%`, label: "Returning Players", sublabel: "This season" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="organiser-players-page-stat-strip">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="rounded-2xl border border-border p-4" data-testid={`organiser-players-page-stat-${item.key}`}>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold leading-tight">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            {item.sublabel && <p className="text-[11px] text-muted-foreground/70">{item.sublabel}</p>}
          </div>
        );
      })}
    </div>
  );
}
