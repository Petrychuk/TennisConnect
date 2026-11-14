import { useState } from "react";
import { useLocation } from "wouter";
import { useLiveAvailable } from "@/lib/use-live-available";
import { sessionCategoryOf } from "@shared/sessionCategories";
import { isReadyToStart } from "@shared/sessionLifecycle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatInTimeZone } from "@/lib/timezone";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  MapPin,
  Play,
  MoreHorizontal,
  Copy,
  Pencil,
  LayoutTemplate,
  Archive,
  Users,
  CheckCircle2,
  Hourglass,
  Square,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { bucketFor, sessionStatusLabel, STATUS_BADGE_STYLE, getPrimaryActionMeta, sessionEditPath } from "./session-utils";
import { SaveAsTemplateDialog } from "./save-as-template-dialog";
import { Metric } from "./session-card";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.webp";

interface SessionCardGridProps {
  session: SessionListItem;
  onDuplicate?: (session: SessionListItem) => void;
  onDelete?: (session: SessionListItem) => void;
  onArchive?: (session: SessionListItem) => void;
}

// The Grid view's own card - same status logic as session-card.tsx's
// row (shared via session-utils.ts's STATUS_BADGE_LABEL/STYLE and
// getPrimaryActionMeta, plus the same Metric chip), just arranged
// vertically (photo on top, content below) to actually suit a
// multi-column grid instead of a full-width row. Status badge still
// sits next to the title, not overlaid on the photo - kept consistent
// with the row layout's own explicit fix for the same reason (a badge
// on the photo read like a stock-photo watermark, not session status).
export function SessionCardGrid({ session, onDuplicate, onDelete, onArchive }: SessionCardGridProps) {
  const [, setLocation] = useLocation();
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const bucket = bucketFor(session);
  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === session.type)?.label ?? "Session";
  const attendancePercent =
    (bucket === "completed" || bucket === "archived") && session.registeredCount > 0
      ? Math.round((session.checkedInCount / session.registeredCount) * 100)
      : null;

  // Live only where TC Live runs and for sessions that have rounds
  // (not Coaching & Fitness - shared/sessionCategories.ts).
  const hasRounds = sessionCategoryOf(session.type).usesLiveRounds;
  const liveAvailable = useLiveAvailable(session) && hasRounds;
  const openWorkspace = () => setLocation(`/organiser/sessions/${session.id}`);
  // Where Live isn't enabled for this session (TC_LIVE_ENABLED), a live session opens its workspace.
  const openLive = () => setLocation(liveAvailable ? `/organiser/sessions/${session.id}/live` : `/organiser/sessions/${session.id}`);
  const openEdit = () => setLocation(sessionEditPath(session));
  const openResults = () => setLocation(`/organiser/sessions/${session.id}?tab=${hasRounds ? "results" : "players"}`);

  const handleDuplicate = () => {
    // Opens the Create Session wizard pre-filled (sessions.tsx) - nothing
    // is saved until the organiser goes through it, so no "duplicated" toast.
    onDuplicate?.(session);
  };

  const readyToStart = isReadyToStart(session);
  const primaryAction = getPrimaryActionMeta(bucket, Play, liveAvailable, hasRounds, readyToStart);
  const primaryOnClick =
    bucket === "draft"
      ? openEdit // Continue Setup: back into the wizard, with everything that was saved
      : (bucket === "registration-open" || bucket === "upcoming") && primaryAction.label === "Start Live"
      ? openLive
      : bucket === "registration-open" || bucket === "upcoming"
      ? openWorkspace
      : bucket === "live"
      ? openLive
      : openResults; // completed, archived (there is no History tab)

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col" data-testid={`organiser-session-card-grid-${session.id}`}>
      <div className="relative w-full h-36 shrink-0 overflow-hidden">
        <img src={session.coverImage || courtImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
        {bucket === "live" && <div className="absolute inset-0 bg-foreground/40" />}
      </div>

      <CardContent className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-display font-bold truncate" data-testid={`organiser-session-card-grid-${session.id}-title`}>{session.title}</h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <Badge variant="outline" className="text-[11px] font-medium shrink-0">{typeLabel}</Badge>
            <Badge className={cn("gap-1 shrink-0", STATUS_BADGE_STYLE[bucket])} data-testid={`organiser-session-card-grid-${session.id}-badge`}>
              {bucket === "live" && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
                </span>
              )}
              {sessionStatusLabel(session, bucket)}
            </Badge>
          </div>
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatInTimeZone(session.startAt, session.timeZone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {session.location}
            </span>
          </div>
        </div>

        {bucket === "draft" ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700" data-testid={`organiser-session-card-grid-${session.id}-draft-warning`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Complete session setup
          </p>
        ) : bucket === "completed" || bucket === "archived" ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Metric icon={Users} value={session.registeredCount} label="Players" />
            <Metric icon={CheckCircle2} value={session.checkedInCount} label="Attended" />
            {attendancePercent !== null && (
              <span className="font-semibold text-primary-text" data-testid={`organiser-session-card-grid-${session.id}-attendance`}>
                {attendancePercent}% Attendance
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {bucket === "live" && session.roundCurrent && session.roundTotal && (
              <span className="font-semibold text-primary-text" data-testid={`organiser-session-card-grid-${session.id}-round`}>
                Round {session.roundCurrent} / {session.roundTotal}
              </span>
            )}
            <Metric
              icon={Users}
              value={`${session.registeredCount}${session.maxParticipants !== null ? `/${session.maxParticipants}` : ""}`}
              label={bucket === "live" ? "Players" : "Registered"}
            />
            {bucket === "live" ? (
              <Metric icon={CheckCircle2} value={session.checkedInCount} label="Checked In" />
            ) : (
              session.waitingCount > 0 && <Metric icon={Hourglass} value={session.waitingCount} label="Waiting" />
            )}
            {session.courtsCount !== null && <Metric icon={Square} value={session.courtsCount} label="Courts" />}
          </div>
        )}

        <div className="flex items-center gap-2 mt-auto pt-1">
          <Button
            variant={primaryAction.urgent ? "default" : "outline"}
            onClick={primaryOnClick}
            className="flex-1"
            data-testid={`organiser-session-card-grid-${session.id}-primary`}
          >
            {primaryAction.icon && <primaryAction.icon className="w-4 h-4 mr-2" />}
            {primaryAction.label}
          </Button>

          {bucket === "draft" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0" data-testid={`organiser-session-card-grid-${session.id}-delete`}>
                  <Trash2 className="w-4 h-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{session.title}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This draft hasn't been published, so nobody's registered. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid={`organiser-session-card-grid-${session.id}-delete-cancel`}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete?.(session)} data-testid={`organiser-session-card-grid-${session.id}-delete-confirm`}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : bucket === "live" ? (
            <Button variant="outline" size="icon" onClick={openWorkspace} className="shrink-0" data-testid={`organiser-session-card-grid-${session.id}-secondary`} title="Manage Session">
              <MoreHorizontal className="w-4 h-4" />
              <span className="sr-only">Manage Session</span>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0" data-testid={`organiser-session-card-grid-${session.id}-menu`}>
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDuplicate} data-testid={`organiser-session-card-grid-${session.id}-duplicate`}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSaveTemplateOpen(true)} data-testid={`organiser-session-card-grid-${session.id}-save-template`}>
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  Save as Template
                </DropdownMenuItem>
                {(bucket === "registration-open" || bucket === "upcoming") && (
                  <DropdownMenuItem onClick={openEdit} data-testid={`organiser-session-card-grid-${session.id}-edit`}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {bucket === "completed" && onArchive && (
                  <DropdownMenuItem onClick={() => onArchive(session)} data-testid={`organiser-session-card-grid-${session.id}-archive`}>
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>

      <SaveAsTemplateDialog
        sessionId={session.id}
        sessionTitle={session.title}
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
      />
    </Card>
  );
}
