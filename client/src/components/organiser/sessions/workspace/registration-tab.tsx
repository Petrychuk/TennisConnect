import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockSessionPlayers, type SessionPlayer } from "@/lib/organiser-sessions-mock-data";

const GROUPS: { key: SessionPlayer["status"]; label: string }[] = [
  { key: "registered", label: "Registered" },
  { key: "waiting", label: "Waiting List" },
  { key: "cancelled", label: "Cancelled" },
  { key: "invited", label: "Invited" },
  { key: "checked-in", label: "Checked In" },
];

export function RegistrationTab() {
  const grouped = GROUPS.map((g) => ({
    ...g,
    players: mockSessionPlayers.filter((p) => p.status === g.key),
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
