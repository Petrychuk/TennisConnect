import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Plus, Users2, Settings, ExternalLink, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsCardProps {
  organizationSlug: string;
  onCreateSession?: () => void;
  className?: string;
}

export function QuickActionsCard({ organizationSlug, onCreateSession, className }: QuickActionsCardProps) {
  const actions = [
    {
      key: "create-session",
      label: "Create Session",
      icon: Plus,
      onClick: onCreateSession,
      testId: "organiser-hub-action-create-session",
    },
    {
      key: "view-org",
      label: "View Public Page",
      icon: ExternalLink,
      href: `/organizations/${organizationSlug}`,
      testId: "organiser-hub-action-view-org",
    },
    {
      key: "members",
      label: "Organisation Members",
      icon: Users2,
      disabled: true,
      testId: "organiser-hub-action-members",
    },
    {
      key: "settings",
      label: "Organisation Settings",
      icon: Settings,
      disabled: true,
      testId: "organiser-hub-action-settings",
    },
  ] as const;

  return (
    <Card className={cn(className)} data-testid="organiser-hub-quick-actions-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-4 h-4 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            const content = (
              <>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium leading-tight">{action.label}</span>
              </>
            );
            const sharedClasses =
              "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/5";

            if ("href" in action) {
              return (
                <Link key={action.key} href={action.href} className={sharedClasses} data-testid={action.testId}>
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={"disabled" in action ? action.disabled : false}
                className={cn(sharedClasses, "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border/60 disabled:hover:bg-transparent")}
                data-testid={action.testId}
                title={"disabled" in action && action.disabled ? "Coming soon" : undefined}
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
