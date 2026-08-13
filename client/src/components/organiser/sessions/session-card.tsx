import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Calendar,
  MapPin,
  Users,
  Play,
  FileText,
  Trophy,
  Archive,
  Radio,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { bucketFor } from "./session-utils";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.webp";

interface SessionCardProps {
  session: SessionListItem;
  onDuplicate?: (session: SessionListItem) => void;
  onDelete?: (session: SessionListItem) => void;
}

const STATUS_BADGE_LABEL: Record<string, string> = {
  live: "LIVE",
  "registration-open": "Registration Open",
  upcoming: "Upcoming",
  draft: "Draft",
  completed: "Completed",
  archived: "Archived",
};

// Deliberately just background/primary/muted/destructive tints - no
// per-status hue palette (green/orange/blue/purple like the mockup),
// keeping to the project's existing tokens.
const STATUS_BADGE_STYLE: Record<string, string> = {
  live: "bg-primary text-primary-foreground",
  "registration-open": "bg-primary/10 text-primary",
  upcoming: "bg-secondary text-secondary-foreground",
  draft: "bg-muted text-muted-foreground",
  completed: "bg-accent text-accent-foreground",
  archived: "bg-muted text-muted-foreground",
};

const BUCKET_ICON: Record<string, typeof Users> = {
  live: Radio,
  "registration-open": Calendar,
  upcoming: UsersRound,
  draft: FileText,
  completed: Trophy,
  archived: Archive,
};

export function SessionCard({ session, onDuplicate, onDelete }: SessionCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const bucket = bucketFor(session);
  const Icon = BUCKET_ICON[bucket];
  const spots = session.maxParticipants !== null ? session.maxParticipants - session.registeredCount : null;
  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === session.type)?.label ?? "Session";

  const openWorkspace = () => setLocation(`/organiser/sessions/${session.id}`);
  const openLive = () => setLocation(`/organiser/sessions/${session.id}/live`);
  const openEdit = () => setLocation(`/organiser/sessions/${session.id}/edit`);
  const openResults = () => setLocation(`/organiser/sessions/${session.id}?tab=results`);
  const openHistory = () => setLocation(`/organiser/sessions/${session.id}?tab=history`);

  const handleDuplicate = () => {
    onDuplicate?.(session);
    toast({ title: "Session duplicated", description: `"${session.title}" was copied as a new draft.` });
  };

  // The whole point: the card decides which two buttons make sense, the
  // organiser never has to figure out which one applies.
  const primaryAction =
    bucket === "draft"
      ? { label: "Continue Setup", onClick: openWorkspace }
      : bucket === "live"
      ? { label: "Enter Live", onClick: openLive, icon: Play }
      : bucket === "completed"
      ? { label: "View Results", onClick: openResults }
      : bucket === "archived"
      ? { label: "View History", onClick: openHistory }
      : { label: "Manage Session", onClick: openWorkspace }; // registration-open, upcoming

  const secondaryAction =
    bucket === "draft"
      ? null // Delete is rendered separately below (needs the confirm dialog)
      : bucket === "live"
      ? { label: "Manage Session", onClick: openWorkspace }
      : bucket === "completed" || bucket === "archived"
      ? { label: "Duplicate", onClick: handleDuplicate }
      : { label: "Edit", onClick: openEdit }; // registration-open, upcoming

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow overflow-hidden" data-testid={`organiser-session-card-${session.id}`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Cover — live gets the photographic treatment, everything else
              is a quiet icon tile differentiated by icon, not colour. */}
          <div className="relative w-full sm:w-40 h-32 sm:h-auto shrink-0 overflow-hidden">
            {bucket === "live" ? (
              <>
                <img src={session.coverImage || courtImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-foreground/40" />
              </>
            ) : (
              <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                <Icon className="w-10 h-10 text-primary/40" />
              </div>
            )}
            <Badge
              className={cn("absolute top-2 left-2 gap-1", STATUS_BADGE_STYLE[bucket])}
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

          <div className="flex-1 min-w-0 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-bold truncate">{session.title}</h3>
                <Badge variant="outline" className="text-[11px] font-medium shrink-0" data-testid={`organiser-session-card-${session.id}-type`}>
                  {typeLabel}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(session.startAt).toLocaleString(undefined, {
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

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs mt-2">
                <span data-testid={`organiser-session-card-${session.id}-registered`}>
                  <span className="font-bold">{session.registeredCount}</span>{" "}
                  <span className="text-muted-foreground">Registered</span>
                </span>
                {bucket === "live" || bucket === "completed" || bucket === "archived" ? (
                  <span data-testid={`organiser-session-card-${session.id}-checkedin`}>
                    <span className="font-bold">{session.checkedInCount}</span>{" "}
                    <span className="text-muted-foreground">Checked In</span>
                  </span>
                ) : (
                  <>
                    <span data-testid={`organiser-session-card-${session.id}-waiting`}>
                      <span className="font-bold">{session.waitingCount}</span>{" "}
                      <span className="text-muted-foreground">Waiting</span>
                    </span>
                    {spots !== null && (
                      <span data-testid={`organiser-session-card-${session.id}-spots`}>
                        <span className="font-bold">{spots}</span>{" "}
                        <span className="text-muted-foreground">Spots</span>
                      </span>
                    )}
                  </>
                )}
              </div>

              {bucket === "live" && session.roundCurrent && session.roundTotal && (
                <p className="text-xs font-medium text-primary mt-1" data-testid={`organiser-session-card-${session.id}-round`}>
                  Round {session.roundCurrent} / {session.roundTotal}
                </p>
              )}

              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">{session.progressLabel}</p>
                {session.progressPercent > 0 && (
                  <div className="h-1.5 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${session.progressPercent}%` }}
                      data-testid={`organiser-session-card-${session.id}-progress`}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-40">
              <Button
                onClick={primaryAction.onClick}
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
                      className="flex-1 sm:flex-none"
                      data-testid={`organiser-session-card-${session.id}-delete`}
                    >
                      Delete
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
              ) : (
                secondaryAction && (
                  <Button
                    variant="outline"
                    onClick={secondaryAction.onClick}
                    className="flex-1 sm:flex-none"
                    data-testid={`organiser-session-card-${session.id}-secondary`}
                  >
                    {secondaryAction.label}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
