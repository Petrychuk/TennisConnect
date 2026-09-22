import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Menu, Plus, LayoutTemplate, MapPin, Users, Square, Repeat, Clock, Hourglass, MoreHorizontal, Pencil, Copy, Trash2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { getSessionTemplates, duplicateSessionTemplate, deleteSessionTemplate } from "@/lib/api/organizer-sessions";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import type { SessionTemplate } from "@shared/schema";

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function TemplateCard({ template, onDuplicate, onDelete }: { template: SessionTemplate; onDuplicate: (t: SessionTemplate) => void; onDelete: (t: SessionTemplate) => void }) {
  const [, setLocation] = useLocation();
  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === template.type)?.label ?? "Session";
  const duration = formatDuration(template.durationMinutes);

  const parts: string[] = [];
  if (template.courtsCount) parts.push(`${template.courtsCount} courts`);
  if (template.maxParticipants) parts.push(`${template.maxParticipants} players`);
  if (template.plannedRoundsCount) parts.push(`${template.plannedRoundsCount} rounds`);

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow" data-testid={`organiser-template-card-${template.id}`}>
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display font-bold truncate">{template.name}</h3>
            <Badge variant="outline" className="text-[11px] font-medium mt-1">{typeLabel}</Badge>
          </div>
        </div>

        {template.location && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {template.location}
          </p>
        )}

        {parts.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {template.courtsCount != null && (
              <span className="flex items-center gap-1"><Square className="w-3.5 h-3.5" />{template.courtsCount} courts</span>
            )}
            {template.maxParticipants != null && (
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{template.maxParticipants} players</span>
            )}
            {template.plannedRoundsCount != null && (
              <span className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5" />{template.plannedRoundsCount} rounds</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {duration && (
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{duration}</span>
          )}
          {template.waitingListEnabled && (
            <span className="flex items-center gap-1"><Hourglass className="w-3.5 h-3.5" />Waiting list ON</span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => setLocation(`/organiser/sessions/new?templateId=${template.id}`)}
            data-testid={`organiser-template-card-${template.id}-use`}
          >
            Use Template
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation(`/organiser/sessions/templates/${template.id}/edit`)}
            data-testid={`organiser-template-card-${template.id}-edit`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" data-testid={`organiser-template-card-${template.id}-menu`}>
                <MoreHorizontal className="w-4 h-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDuplicate(template)} data-testid={`organiser-template-card-${template.id}-duplicate`}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate Template
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(template)}
                className="text-destructive focus:text-destructive"
                data-testid={`organiser-template-card-${template.id}-delete`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrganiserSessionTemplatesPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null, isAdmin: user.isAdmin ?? false } : mockOrganiser;
  const [deleteTarget, setDeleteTarget] = useState<SessionTemplate | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["/api/organizer/session-templates"],
    queryFn: getSessionTemplates,
    enabled: isAuthenticated,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/organizer/session-templates"] });

  const handleDuplicate = async (template: SessionTemplate) => {
    try {
      await duplicateSessionTemplate(template.id);
      invalidate();
      toast({ title: "Template duplicated" });
    } catch (error: any) {
      toast({ title: "Couldn't duplicate template", description: error?.message ?? "Please try again.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSessionTemplate(deleteTarget.id);
      invalidate();
      toast({ title: "Template deleted" });
    } catch (error: any) {
      toast({ title: "Couldn't delete template", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardContent className="p-6 text-muted-foreground">
            You need to be an approved organiser to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  const templates = templatesQuery.data ?? [];

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-templates-page">
      <SEO
        title="Session Templates | Organiser Hub | TennisConnect"
        description="Save your frequently used session setups and create new sessions faster."
        noIndex
      />

      <aside className={cn("hidden xl:flex shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto transition-[width] duration-200", sidebarCollapsed ? "xl:w-20" : "xl:w-64")}>
        <OrganiserSidebarNav
          organiser={organiser}
          profileHref={profileHref}
          className="w-full"
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
      </aside>

      <main id="main-content" className="flex-1 min-w-0 pb-16 md:pb-0">
        <div className="flex xl:hidden items-center justify-between px-4 h-14 border-b border-border bg-card">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden md:inline-flex" data-testid="organiser-sidebar-trigger">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Organiser Hub navigation</SheetTitle>
              <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} />
            </SheetContent>
          </Sheet>
          <div className="w-9 h-9 md:hidden" aria-hidden="true" />
          <div className="flex items-center gap-1.5 font-display font-bold">Templates</div>
          <div className="flex items-center gap-1">
            <NotificationBell testId="organiser-header-bell-mobile" />
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <Link
            href="/organiser/sessions"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="organiser-templates-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sessions
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Session Templates</h1>
              <p className="text-muted-foreground mt-1">Save your frequently used session setups and create new sessions faster.</p>
            </div>
            <Button className="gap-2 shrink-0" onClick={() => setLocation("/organiser/sessions/new")} data-testid="organiser-templates-create-session">
              <Plus className="w-4 h-4" />
              Create Session
            </Button>
          </div>

          {templatesQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="organiser-templates-loading">
              <Skeleton className="h-52 w-full rounded-2xl" />
              <Skeleton className="h-52 w-full rounded-2xl" />
              <Skeleton className="h-52 w-full rounded-2xl" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl border border-dashed border-border" data-testid="organiser-templates-empty">
              <LayoutTemplate className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">No templates yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Save a frequently used session setup and create future sessions faster.
                </p>
              </div>
              <Button onClick={() => setLocation("/organiser/sessions/new")} data-testid="organiser-templates-empty-create">
                <Plus className="w-4 h-4 mr-2" />
                Create New Session
              </Button>
              <p className="text-xs text-muted-foreground max-w-sm">
                After creating a session, use ⋯ → Save as Template to reuse its setup.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} onDuplicate={handleDuplicate} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </div>
      </main>

      <OrganiserMobileNav />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}". Sessions previously created from this
              template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="organiser-templates-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="organiser-templates-delete-confirm">
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
