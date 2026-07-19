import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SessionReadinessCard } from "./session-readiness-card";
import { RegistrationSummaryCard } from "./registration/registration-summary-card";
import { RegistrationStatusList } from "./registration/registration-status-list";
import { RegistrationPlayersPanel } from "./registration/registration-players-panel";
import { RegistrationWaitingListCard } from "./registration/registration-waiting-list-card";
import { RegistrationQuickActionsCard } from "./registration/registration-quick-actions-card";
import { PlayerActionsSheet } from "./registration/player-actions-sheet";
import { EnterLiveButton } from "./registration/enter-live-button";
import type { Bucket } from "./registration/types";
import {
  mockSessionPlayers,
  mockWaitingList,
  mockSessionReadiness,
  type SessionListItem,
  type SessionPlayer,
} from "@/lib/organiser-sessions-mock-data";

interface RegistrationTabProps {
  session: SessionListItem;
  onEnterLive?: () => void;
}

// The Registration tab is meant to be the last "calm" screen before Live -
// it only has to answer four questions: who's registered, who's checked
// in, who's waiting, and what to do next. Live Readiness sits right above
// the player list for that reason, and Enter Live only turns fully green
// once it hits 100%.
export function RegistrationTab({ session, onEnterLive }: RegistrationTabProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<Bucket>("registered");
  const [sheetPlayer, setSheetPlayer] = useState<SessionPlayer | null>(null);

  const buckets: Record<Bucket, SessionPlayer[]> = useMemo(
    () => ({
      registered: mockSessionPlayers.filter((p) => p.status === "registered"),
      waiting: mockSessionPlayers.filter((p) => p.status === "waiting"),
      invited: mockSessionPlayers.filter((p) => p.status === "invited"),
      cancelled: mockSessionPlayers.filter((p) => p.status === "cancelled"),
      "no-response": mockSessionPlayers.filter((p) => p.status === "no-response"),
    }),
    []
  );

  const counts: Record<Bucket, number> = {
    registered: buckets.registered.length,
    waiting: buckets.waiting.length,
    invited: buckets.invited.length,
    cancelled: buckets.cancelled.length,
    "no-response": buckets["no-response"].length,
  };

  const readiness = mockSessionReadiness;
  const readyPercent = readiness.percent;

  const quickCheckIn = () => toast({ title: "Quick check-in isn't wired up yet", description: "Search, QR scan, and self check-in are all coming soon." });

  return (
    <div className="space-y-6" data-testid="organiser-session-registration-tab">
      <SessionReadinessCard readiness={readiness} onViewDetails={() => toast({ title: "Readiness details isn't wired up yet" })} />
      <RegistrationSummaryCard session={session} players={mockSessionPlayers} />

      {/* Desktop (xl+): status list + players panel side by side, then
          waiting list + quick actions side by side. */}
      <div className="hidden xl:block space-y-6">
        <div className="grid grid-cols-3 gap-6">
          <RegistrationStatusList active={statusFilter} onSelect={setStatusFilter} counts={counts} />
          <div className="col-span-2">
            <RegistrationPlayersPanel players={buckets[statusFilter]} onOpenPlayerActions={setSheetPlayer} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <RegistrationWaitingListCard players={mockWaitingList} />
          <RegistrationQuickActionsCard />
        </div>
        <div className="flex justify-center">
          <EnterLiveButton readinessPercent={readyPercent} onClick={onEnterLive} />
        </div>
      </div>

      {/* Tablet (md-xl): filter pills instead of the status sidebar list,
          players panel, quick actions, Enter Live full width. */}
      <div className="hidden md:block xl:hidden space-y-6">
        <div className="flex items-center gap-2 flex-wrap" data-testid="organiser-registration-status-pills-tablet">
          {(Object.keys(counts) as Bucket[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={
                statusFilter === key
                  ? "px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
                  : "px-4 py-1.5 rounded-xl border border-border text-sm font-medium text-muted-foreground"
              }
              data-testid={`organiser-registration-status-pill-${key}`}
            >
              {key === "no-response" ? "No Response" : key[0].toUpperCase() + key.slice(1)} ({counts[key]})
            </button>
          ))}
        </div>
        <RegistrationPlayersPanel players={buckets[statusFilter]} onOpenPlayerActions={setSheetPlayer} />
        <RegistrationQuickActionsCard />
        <EnterLiveButton readinessPercent={readyPercent} onClick={onEnterLive} className="w-full" />
      </div>

      {/* Mobile (<md): compact status pills, players panel, floating
          quick-check-in button, Enter Live full width. */}
      <div className="md:hidden space-y-6 relative">
        <div className="flex items-center gap-2" data-testid="organiser-registration-status-pills-mobile">
          {(["registered", "waiting"] as Bucket[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={
                statusFilter === key
                  ? "px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
                  : "px-4 py-1.5 rounded-xl border border-border text-sm font-medium text-muted-foreground"
              }
              data-testid={`organiser-registration-status-pill-mobile-${key}`}
            >
              {key === "registered" ? "Registered" : "Waiting"} ({counts[key]})
            </button>
          ))}
          <button
            type="button"
            onClick={() => setStatusFilter("invited")}
            className="px-4 py-1.5 rounded-xl border border-border text-sm font-medium text-muted-foreground"
            data-testid="organiser-registration-status-pill-mobile-more"
          >
            More
          </button>
        </div>

        <RegistrationPlayersPanel players={buckets[statusFilter]} onOpenPlayerActions={setSheetPlayer} />

        {/* Floating quick check-in — Smart Check-in entry point (search
            already covers "by name"; QR scan and player self check-in are
            future surfaces, this button is where they'll live). */}
        <button
          type="button"
          onClick={quickCheckIn}
          className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-sm flex items-center justify-center"
          data-testid="organiser-registration-quick-checkin-fab"
        >
          <Plus className="w-6 h-6" />
        </button>

        <EnterLiveButton readinessPercent={readyPercent} onClick={onEnterLive} className="w-full" />
      </div>

      <PlayerActionsSheet player={sheetPlayer} onOpenChange={(open) => !open && setSheetPlayer(null)} />
    </div>
  );
}
