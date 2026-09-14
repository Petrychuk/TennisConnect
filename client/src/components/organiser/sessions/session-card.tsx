import { useState } from "react";
import { useLocation } from "wouter";
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
import { useToast } from "@/hooks/use-toast";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { bucketFor, STATUS_BADGE_LABEL, STATUS_BADGE_STYLE, getPrimaryActionMeta } from "./session-utils";
import { SaveAsTemplateDialog } from "./save-as-template-dialog";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.webp";

interface SessionCardProps {
  session: SessionListItem;
  onDuplicate?: (session: SessionListItem) => void;
  onDelete?: (session: SessionListItem) => void;
  onArchive?: (session: SessionListItem) => void;
}

// Small icon+value+label chip, reused for every status's own metric
// row - each status shows a genuinely different set (see the metric
// blocks below), but always in this same compact shape.
export function Metric({ icon: Icon, value, label, testId }: { icon: typeof Users; value: string | number; label: string; testId?: string }) {
  return (
    <span className="flex items-center gap-1.5" data-testid={testId}>
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="font-bold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function SessionCard({ session, onDuplicate, onDelete, onArchive }: SessionCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const bucket = bucketFor(session);
  const spots = session.maxParticipants !== null ? session.maxParticipants - session.registeredCount : null;
  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === session.type)?.label ?? "Session";
  const attendancePercent =
    (bucket === "completed" || bucket === "archived") && session.registeredCount > 0
      ? Math.round((session.checkedInCount / session.registeredCount) * 100)
      : null;

  const openWorkspace = () => setLocation(`/organiser/sessions/${session.id}`);
  const openLive = () => setLocation(`/organiser/sessions/${session.id}/live`);
  const openEdit = () => setLocation(`/organiser/sessions/${session.id}/edit`);
  const openResults = () => setLocation(`/organiser/sessions/${session.id}?tab=results`);
  const openHistory = () => setLocation(`/organiser/sessions/${session.id}?tab=history`);

  const handleDuplicate = () => {
    onDuplicate?.(session);
    toast({ title: "Session duplicated", description: `"${session.title}" was copied as a new draft.` });
  };

  // One primary action per status - everything else (Duplicate, Edit,
  // Save as Template, Archive) lives behind the overflow menu instead
  // of sitting on the row as its own full-size button. Shared with
  // session-card-grid.tsx via getPrimaryActionMeta so both layouts
  // agree on which action is primary and how urgent it looks.
  const primaryAction = getPrimaryActionMeta(bucket, Play);
  const primaryOnClick =
    bucket === "draft" || bucket === "registration-open" || bucket === "upcoming"
      ? openWorkspace
      : bucket === "live"
      ? openLive
      : bucket === "completed"
      ? openResults
      : openHistory; // archived

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow overflow-hidden" data-testid={`organiser-session-card-${session.id}`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Cover — no status badge overlaid on it anymore (moved next
              to the title below - a badge sitting on a photo read like
              a stock-photo watermark, not session status). Still the
              real uploaded photo whenever one exists, falling back to
              the same default stock court photo when it doesn't.
              Shorter than before (h-24 vs h-32) to match the overall
              more compact row height. */}
          <div className="relative w-full sm:w-32 h-24 sm:h-auto shrink-0 overflow-hidden">
            <img src={session.coverImage || courtImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
            {bucket === "live" && <div className="absolute inset-0 bg-foreground/40" />}
          </div>

          <div className="flex-1 min-w-0 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-display font-bold truncate">{session.title}</h3>
                <Badge variant="outline" className="text-[11px] font-medium shrink-0" data-testid={`organiser-session-card-${session.id}-type`}>
                  {typeLabel}
                </Badge>
                <Badge
                  className={cn("gap-1 shrink-0", STATUS_BADGE_STYLE[bucket])}
                  data-testid={`organiser-session-card-${session.id}-badge`}
                >
                  {bucket === "live" && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
                    </span>
                  )}
                  {STATUS_BADGE_LABEL[bucket]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatInTimeZone(session.startAt, session.timeZone, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {session.location}
                </span>
              </div>

              {/* What this row shows genuinely changes by status - the
                  spec's own table: Live gets round/players/courts,
                  Registration Open/Upcoming get registered/waiting/
                  courts, Completed/Archived get a plain outcome
                  summary (players/attended/attendance%), Draft gets a
                  single "not published yet" line instead of metrics
                  that don't exist yet for a session with no
                  registrations. */}
              {bucket === "draft" ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mt-2" data-testid={`organiser-session-card-${session.id}-draft-warning`}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Complete session setup
                </p>
              ) : bucket === "completed" || bucket === "archived" ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-2">
                  <Metric icon={Users} value={session.registeredCount} label="Players" testId={`organiser-session-card-${session.id}-registered`} />
                  <Metric icon={CheckCircle2} value={session.checkedInCount} label="Attended" testId={`organiser-session-card-${session.id}-checkedin`} />
                  {attendancePercent !== null && (
                    <span className="font-semibold text-primary" data-testid={`organiser-session-card-${session.id}-attendance`}>
                      {attendancePercent}% Attendance
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-2">
                  {bucket === "live" && session.roundCurrent && session.roundTotal && (
                    <span className="font-semibold text-primary" data-testid={`organiser-session-card-${session.id}-round`}>
                      Round {session.roundCurrent} / {session.roundTotal}
                    </span>
                  )}
                  <Metric
                    icon={Users}
                    value={`${session.registeredCount}${session.maxParticipants !== null ? `/${session.maxParticipants}` : ""}`}
                    label={bucket === "live" ? "Players" : "Registered"}
                    testId={`organiser-session-card-${session.id}-registered`}
                  />
                  {bucket === "live" ? (
                    <Metric icon={CheckCircle2} value={session.checkedInCount} label="Checked In" testId={`organiser-session-card-${session.id}-checkedin`} />
                  ) : (
                    session.waitingCount > 0 && (
                      <Metric icon={Hourglass} value={session.waitingCount} label="Waiting" testId={`organiser-session-card-${session.id}-waiting`} />
                    )
                  )}
                  {session.courtsCount !== null && (
                    <Metric icon={Square} value={session.courtsCount} label="Courts" testId={`organiser-session-card-${session.id}-courts`} />
                  )}
                </div>
              )}
            </div>

            {/* Action + overflow menu sit side by side, not stacked -
                and this group no longer stretches to fill the row's
                remaining width, so it sits right next to the content
                instead of pinned to the far edge of a very wide
                screen with a wall of empty space in between. */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Button
                variant={primaryAction.urgent ? "default" : "outline"}
                onClick={primaryOnClick}
                className="flex-1 sm:flex-none"
                data-testid={`organiser-session-card-${session.id}-primary`}
              >
                {primaryAction.icon && <primaryAction.icon className="w-4 h-4 mr-2" />}
                {primaryAction.label}
              </Button>

              {bucket === "draft" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      data-testid={`organiser-session-card-${session.id}-delete`}
                    >
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
                      <AlertDialogCancel data-testid={`organiser-session-card-${session.id}-delete-cancel`}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete?.(session)}
                        data-testid={`organiser-session-card-${session.id}-delete-confirm`}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : bucket === "live" ? (
                // Live deliberately gets no overflow menu at all - the
                // only thing that matters while it's running is getting
                // back into it, nothing secondary is worth surfacing.
                <Button
                  variant="outline"
                  onClick={openWorkspace}
                  className="flex-1 sm:flex-none"
                  data-testid={`organiser-session-card-${session.id}-secondary`}
                >
                  Manage Session
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      data-testid={`organiser-session-card-${session.id}-menu`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                      <span className="sr-only">More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDuplicate} data-testid={`organiser-session-card-${session.id}-duplicate`}>
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSaveTemplateOpen(true)} data-testid={`organiser-session-card-${session.id}-save-template`}>
                      <LayoutTemplate className="w-4 h-4 mr-2" />
                      Save as Template
                    </DropdownMenuItem>
                    {(bucket === "registration-open" || bucket === "upcoming") && (
                      <DropdownMenuItem onClick={openEdit} data-testid={`organiser-session-card-${session.id}-edit`}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {bucket === "completed" && onArchive && (
                      <DropdownMenuItem onClick={() => onArchive(session)} data-testid={`organiser-session-card-${session.id}-archive`}>
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
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
