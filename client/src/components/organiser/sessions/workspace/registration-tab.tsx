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
import { type SessionListItem, type SessionPlayer } from "@/lib/organiser-sessions-mock-data";

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

  const registrationsQuery = useQuery({
    queryKey: ["/api/organizer/sessions", session.id, "registrations"],
    queryFn: () => getSessionRegistrations(session.id),
  });

  // Real registrations only - this used to pad the list with the same
  // fixed mock "crowd" players-tab.tsx did, which is exactly why a
  // session capped at 4 players showed way more than 4 registered here
  // too.
  const allPlayers: SessionPlayer[] = useMemo(
    () => toSessionPlayers(registrationsQuery.data ?? []),
    [registrationsQuery.data]
  );
  const waitingPlayers = useMemo(() => allPlayers.filter((p) => p.status === "waiting"), [allPlayers]);

  // Same real readiness computation as overview-tab.tsx's
  // SessionReadinessCard (registration/check-in state + courts) - this
  // bar previously used a completely separate, always-the-same mock
  // percentage regardless of the session's actual state.
  const notCheckedIn = Math.max(0, session.registeredCount - session.checkedInCount);
  const readinessItems = [
    {
      id: "registration",
      label: session.registrationOpen ? "Registration Open" : "Registration Closed",
      status: "ready" as const,
    },
    {
      id: "checkin",
      label: notCheckedIn > 0 ? `${notCheckedIn} Player${notCheckedIn === 1 ? "" : "s"} Not Checked In` : "All Players Checked In",
      status: notCheckedIn > 0 ? ("warning" as const) : ("ready" as const),
    },
    {
      id: "courts",
      label: session.courtsCount != null ? `Courts Ready (${session.courtsCount}/${session.courtsCount})` : "Courts — not set",
      status: session.courtsCount != null ? ("ready" as const) : ("warning" as const),
    },
  ];
  const readyCount = readinessItems.filter((i) => i.status === "ready").length;
  const readiness = {
    percent: Math.round((readyCount / readinessItems.length) * 100),
    items: readinessItems,
  };

  return (
    <div className="space-y-4" data-testid="organiser-session-registration-tab">
      <ReadyForLiveBar readiness={readiness} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RegistrationPlayersPanel
            players={allPlayers}
            onOpenPlayerActions={setSheetPlayer}
            showDetailColumns
          />
        </div>
        <div className="space-y-4">
          <RegistrationWaitingListCard players={waitingPlayers} defaultOpen={false} />
          <RegistrationQuickActionsCard />
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <EnterLiveButton readinessPercent={readiness.percent} onClick={onEnterLive} className="w-full sm:w-auto" />
      </div>

      <PlayerActionsSheet player={sheetPlayer} onOpenChange={(open) => !open && setSheetPlayer(null)} />
    </div>
  );
}
