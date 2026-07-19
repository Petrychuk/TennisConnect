import { SessionSummaryCard } from "./session-summary-card";
import { SessionDetailsCard } from "./session-details-card";
import { SessionQuickStatsCard } from "./session-quick-stats-card";
import { SessionStatusCard } from "./session-status-card";
import { SessionActivityCard } from "./session-activity-card";
import { SessionNotesCard } from "./session-notes-card";
import {
  mockSessionActivity,
  mockSessionQuickStats,
  mockSessionTopPlayers,
  mockSessionTopPlayersExtra,
  getSessionDetail,
  type SessionListItem,
} from "@/lib/organiser-sessions-mock-data";

interface OverviewTabProps {
  session: SessionListItem;
  onEdit?: () => void;
}

export function OverviewTab({ session, onEdit }: OverviewTabProps) {
  const detail = getSessionDetail(session);

  return (
    <div className="space-y-6" data-testid="organiser-session-overview-tab">
      <SessionSummaryCard session={session} />

      {/*
        md (tablet portrait+): pairs up as (Details, Status) / (Activity, Notes)
        lg (tablet landscape + desktop): all four flatten into one row -
        Details/Activity/Notes end up "on the same level" as requested,
        Status rides along in the same row rather than being split off.
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SessionDetailsCard session={session} />
        <SessionStatusCard session={session} onEdit={onEdit} />
        <SessionActivityCard items={mockSessionActivity} />
        <SessionNotesCard initialNote={detail.notes} />
      </div>

      {/* Always last, including on mobile. */}
      <SessionQuickStatsCard
        stats={mockSessionQuickStats}
        topPlayers={mockSessionTopPlayers}
        extraCount={mockSessionTopPlayersExtra}
      />
    </div>
  );
}
