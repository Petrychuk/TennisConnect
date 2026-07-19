import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ExternalLink, Users2, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsCardProps {
  organizationSlug: string;
  onCreateSession?: () => void;
  className?: string;
}

type ActionItem =
  | { key: string; label: string; icon: LucideIcon; kind: "link"; href: string }
  | { key: string; label: string; icon: LucideIcon; kind: "button"; onClick?: () => void; disabled?: boolean };

export function QuickActionsCard({ organizationSlug, onCreateSession, className }: QuickActionsCardProps) {
  const actions: ActionItem[] = [
    { key: "create-session", label: "Create Session", icon: Plus, kind: "button", onClick: onCreateSession },
    { key: "view-org", label: "View Public Page", icon: ExternalLink, kind: "link", href: `/organisations/${organizationSlug}` },
    { key: "members", label: "Members", icon: Users2, kind: "button", disabled: true },
    { key: "settings", label: "Settings", icon: Settings, kind: "button", disabled: true },
  ];

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-quick-actions-card">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2.5">
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
