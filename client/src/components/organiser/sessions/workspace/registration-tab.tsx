import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockSessionPlayers, type SessionPlayer } from "@/lib/organiser-sessions-mock-data";

type Bucket = "registered" | "checked-in" | "waiting" | "cancelled" | "invited";

const GROUPS: { key: Bucket; label: string; match: (p: SessionPlayer) => boolean }[] = [
  { key: "registered", label: "Registered", match: (p) => p.status === "registered" },
  { key: "checked-in", label: "Checked In", match: (p) => p.status === "registered" && p.checkedIn },
  { key: "waiting", label: "Waiting List", match: (p) => p.status === "waiting" },
  { key: "cancelled", label: "Cancelled", match: (p) => p.status === "cancelled" },
  { key: "invited", label: "Invited", match: (p) => p.status === "invited" },
];

export function RegistrationTab() {
  const grouped = GROUPS.map((g) => ({
    ...g,
    players: mockSessionPlayers.filter(g.match),
  }));

  return (
    <div data-testid="organiser-session-registration-tab">
      <Tabs defaultValue="registered">
        <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap h-auto p-1 scrollbar-hide" data-testid="organiser-session-registration-tabs">
          {grouped.map((g) => (
            <TabsTrigger key={g.key} value={g.key} className="gap-1" data-testid={`organiser-session-registration-tab-${g.key}`}>
              {g.label}
              {g.players.length > 0 && <span className="text-[11px] text-muted-foreground">({g.players.length})</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        {grouped.map((g) => (
          <TabsContent key={g.key} value={g.key} className="mt-4 space-y-2">
            {g.players.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center" data-testid={`organiser-session-registration-empty-${g.key}`}>
                Nobody here.
              </p>
            ) : (
              g.players.map((player) => (
                <Card key={player.id} className="shadow-sm" data-testid={`organiser-session-registration-player-${player.id}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {player.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium">{player.name}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
