import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ExternalLink, UserPlus, MessageSquare, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockSession } from "@/lib/organiser-hub-mock-data";

interface QuickActionsCardProps {
  organizationSlug: string;
  // The soonest published session, if any - Check-in Players goes
  // straight there when there's exactly one obvious candidate.
  upcomingSessions?: MockSession[];
  onCreateSession?: () => void;
  onCheckIn?: (sessionId: string) => void;
  className?: string;
}

type ActionItem =
  | { key: string; label: string; icon: LucideIcon; kind: "link"; href: string }
  | { key: string; label: string; icon: LucideIcon; kind: "button"; onClick?: () => void; disabled?: boolean };

// Operational actions ("things I may need to DO now"), not a second
// copy of sidebar navigation - Settings was removed per explicit spec
// feedback ("Remove actions such as: Settings from Quick Actions").
// Check-in Players and Message Players both need a real session to
// act on - each disables itself with an honest tooltip when there
// isn't one, rather than silently doing nothing on click.
export function QuickActionsCard({ organizationSlug, upcomingSessions = [], onCreateSession, onCheckIn, className }: QuickActionsCardProps) {
  const nextSession = upcomingSessions[0];

  const actions: ActionItem[] = [
    { key: "create-session", label: "Create Session", icon: Plus, kind: "button", onClick: onCreateSession },
    {
      key: "checkin",
      label: "Check-in Players",
      icon: CheckCircle2,
      kind: "button",
      onClick: nextSession ? () => onCheckIn?.(nextSession.id) : undefined,
      disabled: !nextSession,
    },
    ...(nextSession
      ? ([{ key: "invite", label: "Invite Players", icon: UserPlus, kind: "link", href: `/organiser/sessions/${nextSession.id}?tab=players` }] as ActionItem[])
      : ([{ key: "invite", label: "Invite Players", icon: UserPlus, kind: "button", disabled: true }] as ActionItem[])),
    { key: "message", label: "Message Players", icon: MessageSquare, kind: "link", href: "/organiser/messages" },
    { key: "view-org", label: "View Public Page", icon: ExternalLink, kind: "link", href: `/organisations/${organizationSlug}` },
  ];

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-quick-actions-card">
      <CardHeader>
        <CardTitle asChild className="text-base"><h2>Quick Actions</h2></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {actions.map((action) => {
            const Icon = action.icon;
            const content = (
              <>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium leading-tight text-center">{action.label}</span>
              </>
            );
            const sharedClasses =
              "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border p-3 text-center transition-all hover:border-primary/40 hover:bg-accent/40 hover:scale-[1.01]";

            if (action.kind === "link") {
              return (
                <Link
                  key={action.key}
                  href={action.href}
                  className={sharedClasses}
                  data-testid={`organiser-quick-action-${action.key}`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  sharedClasses,
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:scale-100"
                )}
                data-testid={`organiser-quick-action-${action.key}`}
                title={action.disabled ? "Coming soon" : undefined}
              >
                {content}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
