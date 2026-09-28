import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, ShieldCheck, ExternalLink, Check, X, Copy, Pencil, Play } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

// [PLAY][AI] TC Discovery Agent, sections 16-17 - the Admin Discovery
// Queue, living inside the Admin hub shell (same sidebar/header/mobile
// nav as /admin) rather than as a standalone site page.
//
// What this screen is for: an admin decides "can this externally
// discovered event be TRUSTED enough to enter the TennisConnect data
// pool?" - not "what should this player see on Play" (that's the
// Recommendation Engine's job, afterwards). Approve makes an event
// ELIGIBLE for Play; it doesn't guarantee anyone is shown it.

type Tab = "PENDING" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";

const TABS: { value: Tab; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "REJECTED", label: "Rejected" },
];

const EMPTY_STATES: Record<Tab, { title: string; hint: string }> = {
  PENDING: {
    title: "No activities awaiting review.",
    hint: "New activities discovered by TennisConnect will appear here.",
  },
  APPROVED: {
    title: "No approved activities yet.",
    hint: "Activities you approve become eligible to appear in Play.",
  },
  NEEDS_REVIEW: {
    title: "Nothing needs a closer look right now.",
    hint: "Activities the Agent isn't sure about, or that need re-checking, will appear here.",
  },
  REJECTED: {
    title: "No rejected activities.",
    hint: "Rejected activities and duplicates are kept here for reference.",
  },
};

interface ExternalActivityRow {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  venueName: string | null;
  suburb: string | null;
  city: string | null;
  state: string | null;
  startDate: string | null; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  recurrenceFrequency: string | null;
  recurrenceDayOfWeek: string | null;
  activityType: string | null;
  gameFormat: string | null;
  normalisedLevel: string | null;
  originalLevelText: string | null;
  price: number | null;
  currency: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reviewStatus: string;
  discoveryStatus: string;
  duplicateConfidence: number | null;
  lastCheckedAt: string;
}

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`/api/admin/discovery${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? "Request failed");
  return res.json();
}

const humanise = (s: string) => s.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function formatWhen(item: ExternalActivityRow): string {
  const time = item.startTime ? (item.endTime ? `${item.startTime}–${item.endTime}` : item.startTime) : null;
  let day: string | null = null;
  if (item.recurrenceDayOfWeek) {
    day = `Every ${humanise(item.recurrenceDayOfWeek.toLowerCase())}`;
  } else if (item.startDate) {
    // A date-only string, parsed as a local calendar date so it can't
    // slip a day across time zones.
    const [y, m, d] = item.startDate.split("-").map(Number);
    day = new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  } else if (item.recurrenceFrequency) {
    day = "Recurring";
  }
  if (!day && !time) return "No date extracted";
  return [day, time].filter(Boolean).join(" ");
}

function formatLastChecked(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return then.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function AdminDiscoveryPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isAdmin = !!user?.isAdmin;

  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  const organiser = user
    ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null, isAdmin: user.isAdmin ?? false }
    : mockOrganiser;

  const [tab, setTab] = useState<Tab>("PENDING");
  const [counts, setCounts] = useState<Record<Tab, number> | null>(null);
  const [items, setItems] = useState<ExternalActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExternalActivityRow | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ExternalActivityRow>>({});
  const [runOpen, setRunOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<Record<string, number> | null>(null);
  const [runIsDryRun, setRunIsDryRun] = useState(true);
  const [runState, setRunState] = useState("");

  const loadCounts = () => {
    if (!isAdmin) return;
    api("/counts").then(setCounts).catch(() => {});
  };

  const load = () => {
    if (!isAdmin) return;
    setLoading(true);
    api(`/activities?status=${tab}`)
      .then(setItems)
      .catch(() => toast({ variant: "destructive", title: "Couldn't load the queue" }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab, isAdmin]);
  useEffect(loadCounts, [isAdmin]);

  const act = async (id: string, action: "approve" | "reject" | "mark-duplicate") => {
    try {
      await api(`/activities/${id}/${action}`, { method: "POST", body: "{}" });
      setItems((prev) => prev.filter((i) => i.id !== id));
      loadCounts();
      toast({ title: action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Marked as duplicate" });
    } catch {
      toast({ variant: "destructive", title: "Action failed" });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const updated = await api(`/activities/${editing.id}`, { method: "PUT", body: JSON.stringify(editDraft) });
      setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, ...updated } : i)));
      setEditing(null);
      toast({ title: "Saved" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't save" });
    }
  };

  const runDiscovery = async () => {
    setRunning(true);
    setRunSummary(null);
    try {
      const result = await api("/run", {
        method: "POST",
        body: JSON.stringify({ isDryRun: runIsDryRun, targetState: runState || undefined }),
      });
      setRunSummary(result);
      if (!runIsDryRun) {
        load();
        loadCounts();
      }
    } catch {
      toast({ variant: "destructive", title: "Run failed" });
    } finally {
      setRunning(false);
    }
  };

  if (authLoading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-16 text-center text-muted-foreground">
          You don't have access to this page.
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Discovery | Admin | TennisConnect"
        description="Review and manage tennis activities discovered across Australia."
        canonical="/admin/discovery"
        noIndex
      />
      <div className="min-h-screen flex bg-background" data-testid="admin-discovery-page">
        <aside
          className={cn(
            "hidden xl:flex shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto transition-[width] duration-200",
            sidebarCollapsed ? "xl:w-20" : "xl:w-64"
          )}
        >
          <OrganiserSidebarNav
            organiser={organiser}
            profileHref={profileHref}
            className="w-full"
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          />
        </aside>

        <main id="main-content" className="flex-1 min-w-0 pb-16 md:pb-0">
          {/* Compact bar - tablet & mobile, same pattern as the rest of the hub */}
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
            <div className="flex items-center gap-1.5 font-display font-bold">Admin</div>
            <div className="flex items-center gap-1">
              <NotificationBell testId="organiser-header-bell-mobile" />
            </div>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1500px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl md:text-3xl font-display font-bold">Australian Tennis Discovery</h1>
                  <Badge className="bg-primary text-foreground">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Review and manage tennis activities discovered across Australia.
                </p>
              </div>
              <Button
                onClick={() => setRunOpen(true)}
                className="bg-primary text-foreground border-primary hover:bg-primary/90 font-bold rounded-full px-6 cursor-pointer"
                data-testid="discovery-run-button"
              >
                <Play className="w-4 h-4 mr-2" /> Run Discovery
              </Button>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-1" data-testid="discovery-tabs">
              {TABS.map((t) => (
                <Button
                  key={t.value}
                  variant={tab === t.value ? "default" : "outline"}
                  size="sm"
                  className="rounded-full shrink-0"
                  onClick={() => setTab(t.value)}
                  data-testid={`discovery-tab-${t.value.toLowerCase()}`}
                >
                  {t.label}
                  {counts && <span className="ml-1.5 opacity-70">{counts[t.value]}</span>}
                </Button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3 max-w-4xl">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-xl" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-20 text-center max-w-md mx-auto" data-testid="discovery-empty">
                <p className="font-medium">{EMPTY_STATES[tab].title}</p>
                <p className="text-sm text-muted-foreground mt-1">{EMPTY_STATES[tab].hint}</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-4xl" data-testid="discovery-queue-list">
                {items.map((item) => {
                  const where = [item.venueName ?? item.suburb, item.state].filter(Boolean).join(" · ");
                  const detected = [
                    item.activityType && humanise(item.activityType),
                    item.gameFormat && humanise(item.gameFormat),
                    item.normalisedLevel ?? item.originalLevelText,
                    item.price != null && `$${item.price}`,
                  ].filter(Boolean);
                  return (
                    <Card key={item.id} className="border-0 shadow-sm bg-muted/40" data-testid={`discovery-item-${item.id}`}>
                      <CardContent className="py-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold">{item.title}</p>
                            <p className="text-sm text-muted-foreground">{where || "Location unknown"}</p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                            {item.reviewStatus === "DUPLICATE" && <Badge variant="outline">Duplicate</Badge>}
                            {item.duplicateConfidence != null && item.reviewStatus !== "DUPLICATE" && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                {item.duplicateConfidence}% possible duplicate
                              </Badge>
                            )}
                            <Badge variant="outline">{item.confidence}</Badge>
                          </div>
                        </div>

                        <p className="text-sm">{formatWhen(item)}</p>
                        {detected.length > 0 && <p className="text-sm text-muted-foreground">{detected.join(" · ")}</p>}

                        <p className="text-xs text-muted-foreground">
                          Source: <span className="text-foreground">{item.sourceName}</span> · Last checked:{" "}
                          {formatLastChecked(item.lastCheckedAt)}
                        </p>

                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> View Source
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing(item);
                              setEditDraft(item);
                            }}
                            data-testid={`discovery-item-${item.id}-edit`}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                          </Button>
                          {(item.reviewStatus !== "APPROVED" || item.discoveryStatus === "NEEDS_REVIEW") && (
                            <Button size="sm" onClick={() => act(item.id, "approve")} data-testid={`discovery-item-${item.id}-approve`}>
                              <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
                            </Button>
                          )}
                          {item.reviewStatus !== "REJECTED" && item.reviewStatus !== "DUPLICATE" && (
                            <Button variant="outline" size="sm" onClick={() => act(item.id, "reject")} data-testid={`discovery-item-${item.id}-reject`}>
                              <X className="w-3.5 h-3.5 mr-1.5" /> Reject
                            </Button>
                          )}
                          {item.reviewStatus !== "DUPLICATE" && item.reviewStatus !== "REJECTED" && (
                            <Button variant="ghost" size="sm" onClick={() => act(item.id, "mark-duplicate")} data-testid={`discovery-item-${item.id}-duplicate`}>
                              <Copy className="w-3.5 h-3.5 mr-1.5" /> Duplicate
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <OrganiserMobileNav />
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent data-testid="discovery-edit-modal">
          <DialogHeader>
            <DialogTitle>Edit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={editDraft.title ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            <div>
              <Label>Start date (YYYY-MM-DD)</Label>
              <Input value={editDraft.startDate ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, startDate: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start time (HH:MM)</Label>
                <Input value={editDraft.startTime ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>End time (HH:MM)</Label>
                <Input value={editDraft.endTime ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Suburb</Label>
              <Input value={editDraft.suburb ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, suburb: e.target.value }))} />
            </div>
            <div>
              <Label>Price ($ AUD)</Label>
              <Input
                type="number"
                value={editDraft.price ?? ""}
                onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value ? Number(e.target.value) : null }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveEdit} data-testid="discovery-edit-save">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent data-testid="discovery-run-modal">
          <DialogHeader>
            <DialogTitle>Run Discovery</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={runIsDryRun} onChange={(e) => setRunIsDryRun(e.target.checked)} />
              Dry run (discover and extract, but don't publish anything)
            </label>
            <div>
              <Label>Limit to state (optional)</Label>
              <Input placeholder="e.g. NSW" value={runState} onChange={(e) => setRunState(e.target.value.toUpperCase())} />
            </div>
            {runSummary && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1" data-testid="discovery-run-summary">
                <p>Sources scanned: {runSummary.sourcesScanned}</p>
                <p>Pages checked: {runSummary.pagesChecked}</p>
                <p>Events discovered: {runSummary.eventsDiscovered}</p>
                <p>Events created: {runSummary.eventsCreated}</p>
                <p>Duplicates detected: {runSummary.duplicatesDetected}</p>
                <p>Validation failures: {runSummary.validationFailures}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={runDiscovery} disabled={running} data-testid="discovery-run-confirm">
              {running ? "Running..." : "Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
