import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WaitingPlayer } from "@/lib/organiser-sessions-mock-data";

interface RegistrationWaitingListCardProps {
  players: WaitingPlayer[];
}

export function RegistrationWaitingListCard({ players }: RegistrationWaitingListCardProps) {
  return (
    <Card className="shadow-sm" data-testid="organiser-registration-waiting-list-card">
      <CardHeader>
        <CardTitle className="text-base">Waiting List</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center" data-testid="organiser-registration-waiting-list-empty">
            Nobody's waiting.
          </p>
        ) : (
          players.map((player, i) => (
            <div key={player.id} className="flex items-center gap-3 text-sm" data-testid={`organiser-registration-waiting-${player.id}`}>
              <span className="w-5 text-xs font-bold text-muted-foreground text-center shrink-0">{i + 1}.</span>
              <span className="flex-1">{player.name}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
