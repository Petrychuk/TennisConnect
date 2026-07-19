import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WaitingPlayer } from "@/lib/organiser-sessions-mock-data";

interface RegistrationWaitingListCardProps {
  players: WaitingPlayer[];
  defaultOpen?: boolean;
}

export function RegistrationWaitingListCard({ players, defaultOpen = true }: RegistrationWaitingListCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="shadow-sm" data-testid="organiser-registration-waiting-list-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 cursor-pointer" data-testid="organiser-registration-waiting-list-toggle">
            <CardTitle className="text-base">Waiting List ({players.length})</CardTitle>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
