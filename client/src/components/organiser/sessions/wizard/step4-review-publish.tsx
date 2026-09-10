import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users, LayoutGrid, Repeat, ClipboardCheck, Hourglass, QrCode } from "lucide-react";
import { SESSION_TYPE_OPTIONS, type NewSessionDraft } from "@/lib/organiser-session-wizard-types";
import { zonedTimeToUtc, formatInTimeZone } from "@/lib/timezone";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.webp";

interface Step4ReviewPublishProps {
  draft: NewSessionDraft;
}

export function Step4ReviewPublish({ draft }: Step4ReviewPublishProps) {
  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === draft.type)?.label ?? "Session";
  // Weekday needs the venue's own timezone, not the organizer's browser -
  // near a day boundary, a date built from the browser's ambient zone
  // can land on the wrong calendar day for the venue. draft.startTime is
  // shown as-is below since it's already exactly the wall-clock string
  // the organizer typed for that city.
  const dateObj = draft.date
    ? zonedTimeToUtc(draft.date, draft.startTime || "00:00", draft.timeZone)
    : null;

  const stats = [
    { icon: Users, label: "Players", value: `${draft.maxPlayers} Players` },
    { icon: LayoutGrid, label: "Courts", value: `${draft.courtCount} Courts` },
    { icon: Repeat, label: "Rounds", value: `${draft.roundsCount} Rounds` },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="organiser-wizard-step4">
      <Card className="shadow-sm lg:col-span-2 overflow-hidden" data-testid="organiser-wizard-review-summary">
        <div className="relative h-40">
          <img src={draft.coverImage || courtImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-foreground/40" />
          <div className="absolute inset-0 p-5 flex flex-col justify-end text-primary-foreground">
            <Badge className="bg-primary text-primary-foreground w-fit mb-2">{typeLabel}</Badge>
            <h2 className="text-2xl font-display font-bold">{draft.name || "Untitled Session"}</h2>
          </div>
        </div>

        <CardContent className="p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {dateObj && (
              <>
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="w-4 h-4 text-primary" />
                  {formatInTimeZone(dateObj, draft.timeZone, { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-primary" />
                  {draft.startTime}
                </span>
              </>
            )}
            <span className="flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4 text-primary" />
              {draft.venue}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} data-testid={`organiser-wizard-review-${stat.label.toLowerCase()}`}>
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold">{stat.value}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-sm" data-testid="organiser-wizard-review-registration">
              <ClipboardCheck className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Registration</p>
                <p className="font-medium">
                  {draft.registrationOpens === new Date().toISOString().slice(0, 10) ? "Open Now" : `Opens ${new Date(draft.registrationOpens).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm" data-testid="organiser-wizard-review-waiting-list">
              <Hourglass className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Waiting List</p>
                <p className="font-medium">{draft.waitingListEnabled ? "Enabled" : "Disabled"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm" data-testid="organiser-wizard-review-qr">
              <QrCode className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">QR Check-in</p>
                <p className="font-medium">{draft.qrCheckIn ? "Enabled" : "Disabled"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm" data-testid="organiser-wizard-review-status">
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Current</span>
            <Badge className="bg-muted text-muted-foreground">Draft</Badge>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Visibility</span>
            <span className="font-medium capitalize">{draft.visibility === "members" ? "Members Only" : draft.visibility === "invite" ? "Invite Only" : "Public"}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Publishing sends this session for moderator approval before it goes live on your hub and player profiles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
