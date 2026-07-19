import { useEffect, useState } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, MapPin, Users, Play, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";
import { mockSessionsList, type SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { bucketFor } from "@/components/organiser/sessions/session-utils";

const WORKSPACE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "registration", label: "Registration" },
  { key: "players", label: "Players" },
  { key: "draws", label: "Draws" },
  { key: "results", label: "Results" },
  { key: "messages", label: "Messages" },
  { key: "settings", label: "Settings" },
  { key: "history", label: "History" },
] as const;

type WorkspaceTabKey = (typeof WORKSPACE_TABS)[number]["key"];

// Foundation only — every tab past Overview is a placeholder marking where
// that piece of session management will live once it's built. The point
// of this pass is the workspace shell + navigation existing at all, not
// every tab being finished.
function TabPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground" data-testid={`organiser-session-workspace-placeholder-${label.toLowerCase()}`}>
      {label} isn't built yet — this tab is here so the navigation is real
      when it is.
    </div>
  );
}

export default function OrganiserSessionWorkspacePage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/:id");
  const search = useSearch();
  const [tab, setTab] = useState<WorkspaceTabKey>("overview");

  useEffect(() => {
    const requested = new URLSearchParams(search).get("tab");
    if (requested && WORKSPACE_TABS.some((t) => t.key === requested)) {
      setTab(requested as WorkspaceTabKey);
    }
  }, [search]);

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  const session: SessionListItem | undefined = mockSessionsList.find((s) => s.id === params?.id);

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4">
        <p className="text-muted-foreground">Session not found.</p>
        <Button asChild variant="outline">
          <Link href="/organiser/sessions">Back to Sessions</Link>
        </Button>
      </div>
    );
  }

  const bucket = bucketFor(session);

  return (
    <div className="min-h-screen bg-background" data-testid="organiser-session-workspace">
      <SEO title={`${session.title} | Organiser Hub | TennisConnect`} description={`Manage ${session.title} — registration, players, and results.`} noIndex />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link
          href="/organiser/sessions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="organiser-session-workspace-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sessions
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold">{session.title}</h1>
              <Badge className="capitalize">{bucket.replace("-", " ")}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(session.startAt).toLocaleString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {session.location}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {bucket === "live" && (
              <Button asChild data-testid="organiser-session-workspace-enter-live">
                <Link href={`/organiser/sessions/${session.id}/live`}>
                  <Play className="w-4 h-4 mr-2" />
                  Enter Live
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild data-testid="organiser-session-workspace-edit">
              <Link href={`/organiser/sessions/${session.id}/edit`}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Link>
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as WorkspaceTabKey)}>
          <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap h-auto p-1 scrollbar-hide" data-testid="organiser-session-workspace-tabs">
            {WORKSPACE_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} data-testid={`organiser-session-workspace-tab-${t.key}`}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xl font-bold flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      {session.registeredCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Registered</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{session.checkedInCount}</p>
                    <p className="text-xs text-muted-foreground">Checked In</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{session.waitingCount}</p>
                    <p className="text-xs text-muted-foreground">Waiting List</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{session.maxParticipants ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Capacity</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">{session.progressLabel}</p>
              </CardContent>
            </Card>
          </TabsContent>

          {WORKSPACE_TABS.filter((t) => t.key !== "overview").map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              <TabPlaceholder label={t.label} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
