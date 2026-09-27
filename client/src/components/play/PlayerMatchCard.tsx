import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import type { MatchedPlayer } from "@/lib/api/play";

const REASON_TEXT: Record<string, string> = {
  SIMILAR_LEVEL: "Similar level",
  CLOSE_LEVEL: "Close level",
  SAME_AVAILABILITY: "Same availability",
  NEARBY: "Nearby",
  SAME_FORMAT: "Both prefer the same format",
  SAME_INTENT: "Same play style",
};

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

// Spec [PLAY] Players Looking to Play, section 1's own example card
// shape. Shown with a real Match Score once there's real signal (spec
// section 7); otherwise "Potential match" with no invented percentage.
export function PlayerMatchCard({
  match,
  onInvite,
}: {
  match: MatchedPlayer;
  onInvite: () => void;
}) {
  const { player, score, reasons, hasEnoughSignal } = match;
  return (
    <div
      className="flex items-center gap-4 rounded-2xl border border-border p-4 bg-card"
      data-testid={`player-match-card-${player.id}`}
    >
      <Avatar className="h-14 w-14 shrink-0">
        {player.avatar && <AvatarImage src={player.avatar} alt="" />}
        <AvatarFallback className="bg-primary/10 text-primary">{initials(player.name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{player.name}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
          {player.skillLevel && <span>{player.skillLevel}</span>}
          {player.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {player.location}
            </span>
          )}
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            🟢 Looking to play
          </span>
        </div>

        {hasEnoughSignal ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-sm" data-testid={`player-match-card-${player.id}-score`}>
            <span className="font-bold text-primary">{score}% match</span>
            <span className="text-xs text-muted-foreground truncate">
              · {reasons.map((r) => REASON_TEXT[r] ?? r).join(" · ")}
            </span>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">Potential match</p>
        )}
      </div>

      <Button size="sm" className="shrink-0" onClick={onInvite} data-testid={`player-match-card-${player.id}-invite`}>
        Invite to Play
      </Button>
    </div>
  );
}
