import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReadyForLiveBar } from "./registration/ready-for-live-bar";
import { RegistrationPlayersPanel } from "./registration/registration-players-panel";
import { RegistrationWaitingListCard } from "./registration/registration-waiting-list-card";
import { RegistrationQuickActionsCard } from "./registration/registration-quick-actions-card";
import { PlayerActionsSheet } from "./registration/player-actions-sheet";
import { EnterLiveButton } from "./registration/enter-live-button";
import { getSessionRegistrations } from "@/lib/api/organizer-sessions";
import { toSessionPlayers } from "@/lib/api/session-adapter";
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

// Simplified per feedback: no big KPI numbers, no status sidebar - the
// player list is almost the whole screen. Ready for Live is a compact
// single bar, Bulk Actions sit directly under the list, Waiting List
// collapses out of the way, Quick Actions stays minimal, and Enter Live
// always closes out the page at the bottom.
export function RegistrationTab({ session, onEnterLive }: RegistrationTabProps) {
  const [sheetPlayer, setSheetPlayer] = useState<SessionPlayer | null>(null);
  const readyPercent = mockSessionReadiness.percent;

  const registrationsQuery = useQuery({
    queryKey: ["/api/organizer/sessions", session.id, "registrations"],
    queryFn: () => getSessionRegistrations(session.id),
  });

  // Real registrations first, then the mock "crowd" - see players-tab.tsx
  // for the same reasoning.
  const allPlayers: SessionPlayer[] = useMemo(() => {
    const real = toSessionPlayers(registrationsQuery.data ?? []);
    return [...real, ...mockSessionPlayers];
  }, [registrationsQuery.data]);

  return (
    <div className="space-y-4" data-testid="organiser-session-registration-tab">
      <ReadyForLiveBar readiness={mockSessionReadiness} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RegistrationPlayersPanel
            players={allPlayers}
            onOpenPlayerActions={setSheetPlayer}
            showDetailColumns
          />
        </div>
        <div className="space-y-4">
          <RegistrationWaitingListCard players={mockWaitingList} defaultOpen={false} />
          <RegistrationQuickActionsCard />
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <EnterLiveButton readinessPercent={readyPercent} onClick={onEnterLive} className="w-full sm:w-auto" />
      </div>

      <PlayerActionsSheet player={sheetPlayer} onOpenChange={(open) => !open && setSheetPlayer(null)} />
    </div>
  );
}
