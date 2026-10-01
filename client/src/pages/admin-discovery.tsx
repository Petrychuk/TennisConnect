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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DiscoverySourcesPanel, type DiscoverySourceRow } from "@/components/admin/discovery-sources-panel";

// [PLAY][AI] TC Discovery Agent, sections 16-17 - the Admin Discovery
// Queue, living inside the Admin hub shell (same sidebar/header/mobile
// nav as /admin) rather than as a standalone site page.
//
// What this screen is for: an admin decides "can this externally
// discovered event be TRUSTED enough to enter the TennisConnect data
// pool?" - not "what should this player see on Play" (that's the
// Recommendation Engine's job, afterwards). Approve makes an event
// ELIGIBLE for Play; it doesn't guarantee anyone is shown it.

type Tab = "PENDING" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";

const TABS: { value: Tab; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
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
  ARCHIVED: {
    title: "Nothing archived yet.",
    hint: "Activities that have finished, or that the source says were cancelled, are kept here.",
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
  priceLabel: string | null;
  currency: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reviewStatus: string;
  discoveryStatus: string;
  duplicateConfidence: number | null;
  lastCheckedAt: string;
  registrationUrl: string | null;
  // [PLAY][AI] Partner Events
  sourceType: "EXTERNAL" | "PARTNER";
  registrationType: "INTERNAL" | "EXTERNAL" | null;
  partnerId: string | null;
  partnerName: string | null;
  // Internal notes from the Agent: why an item was flagged (_flag), what
  // changed since it was approved (_changes), plus source quotes.
  extractionEvidence: Record<string, string> | null;
}

interface RunSummary {
  id: string;
  isDryRun: boolean;
  completedAt: string | null;
  sourcesScanned: number;
  pagesChecked: number;
  eventsDiscovered: number;
  eventsValid: number;
  eventsNeedingReview: number;
  eventsCreated: number;
  eventsUpdated: number;
  duplicatesDetected: number;
  validationFailures: number;
  errors: { sourceId: string; sourceName: string; error: string }[];
}

const STATUS_BADGES: Record<string, string> = {
  CHANGED: "Changed at source",
  SOURCE_UNAVAILABLE: "Source unavailable",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const LEVELS = ["Beginner", "Intermediate", "Advanced", "Pro"];
const NONE = "__none__";

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

  const [view, setView] = useState<"queue" | "sources">("queue");
  const [tab, setTab] = useState<Tab>("PENDING");
  const [counts, setCounts] = useState<Record<Tab, number> | null>(null);
  const [items, setItems] = useState<ExternalActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExternalActivityRow | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ExternalActivityRow>>({});
  const [runOpen, setRunOpen] = useState(false);
  const [runTarget, setRunTarget] = useState<DiscoverySourceRow | null>(null);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [runIsDryRun, setRunIsDryRun] = useState(true);
  const [runState, setRunState] = useState("");
  const [runCity, setRunCity] = useState("");

  // [PLAY][AI] Partner Events - confirm-in-place (the primary path: an
  // existing Discovery find becomes an official partner) and the
  // fallback creation form (when there's no existing row to upgrade).
  const [confirming, setConfirming] = useState<ExternalActivityRow | null>(null);
  const [confirmPartnerId, setConfirmPartnerId] = useState("");
  const [confirmPartnerName, setConfirmPartnerName] = useState("");
  const [savingConfirm, setSavingConfirm] = useState(false);

  const [newPartnerOpen, setNewPartnerOpen] = useState(false);
  const [newPartnerDraft, setNewPartnerDraft] = useState<Record<string, string>>({});
  const [savingNewPartner, setSavingNewPartner] = useState(false);

  const loadCounts = () => {
    if (!isAdmin) return;
    api("/counts").then(setCounts).catch(() => {});
  };

  const load = () => {
    if (!isAdmin || view !== "queue") return;
    setLoading(true);
    api(`/activities?status=${tab}`)
      .then(setItems)
      .catch(() => toast({ variant: "destructive", title: "Couldn't load the queue" }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab, isAdmin, view]);
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

  const openEdit = (item: ExternalActivityRow) => {
    setEditing(item);
    setEditDraft({ ...item });
  };

  const saveEdit = async () => {
    if (!editing) return;
    // Only the fields this form edits - the server whitelists them too.
    const payload = {
      title: editDraft.title,
      startDate: editDraft.startDate ?? null,
      startTime: editDraft.startTime ?? null,
      endTime: editDraft.endTime ?? null,
      suburb: editDraft.suburb ?? null,
      state: editDraft.state ?? null,
      normalisedLevel: editDraft.normalisedLevel ?? null,
      price: editDraft.price ?? null,
      priceLabel: editDraft.priceLabel ?? null,
      registrationUrl: editDraft.registrationUrl ?? null,
    };
    try {
      const updated = await api(`/activities/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, ...updated } : i)));
      setEditing(null);
      toast({ title: "Saved" });
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't save",
        description: "Check the date (YYYY-MM-DD), times (HH:MM) and that the link starts with http(s)://",
      });
    }
  };

  const openConfirmPartner = (item: ExternalActivityRow) => {
    setConfirming(item);
    setConfirmPartnerId("");
    setConfirmPartnerName(item.partnerName ?? item.sourceName);
  };

  const saveConfirmPartner = async () => {
    if (!confirming) return;
    setSavingConfirm(true);
    try {
      const updated = await api(`/activities/${confirming.id}/confirm-partner`, {
        method: "POST",
        body: JSON.stringify({ partnerId: confirmPartnerId.trim() || null, partnerName: confirmPartnerName.trim() }),
      });
      setItems((prev) => prev.map((i) => (i.id === confirming.id ? { ...i, ...updated } : i)));
      setConfirming(null);
      toast({ title: "Confirmed as an official TennisConnect partner" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't confirm", description: "Check the partner name, and the partner ID if you entered one." });
    } finally {
      setSavingConfirm(false);
    }
  };

  const openNewPartnerEvent = () => {
    setNewPartnerDraft({});
    setNewPartnerOpen(true);
  };

  const saveNewPartnerEvent = async () => {
    const d = newPartnerDraft;
    setSavingNewPartner(true);
    try {
      const payload = {
        title: d.title?.trim(),
        description: null,
        activityType: d.activityType?.trim() || null,
        gameFormat: null,
        startDate: d.startDate?.trim() || null,
        endDate: null,
        startTime: d.startTime?.trim() || null,
        endTime: d.endTime?.trim() || null,
        recurrenceFrequency: d.recurrenceFrequency?.trim() || null,
        recurrenceDayOfWeek: d.recurrenceDayOfWeek?.trim() || null,
        venueName: d.venueName?.trim() || null,
        address: null,
        suburb: d.suburb?.trim() || null,
        city: d.city?.trim() || null,
        state: d.state?.trim() || null,
        postcode: null,
        normalisedLevel: d.normalisedLevel?.trim() || null,
        price: d.price?.trim() ? Number(d.price) : null,
        priceLabel: d.priceLabel?.trim() || null,
        registrationUrl: d.registrationUrl?.trim(),
        partnerId: d.partnerId?.trim() || null,
        partnerName: d.partnerName?.trim(),
      };
      const created = await api("/partner-events", { method: "POST", body: JSON.stringify(payload) });
      setNewPartnerOpen(false);
      loadCounts();
      if (tab === "PENDING") setItems((prev) => [created, ...prev]);
      toast({ title: "Partner Event created", description: "It's in Pending - approve it to make it eligible for Play." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Couldn't create the Partner Event",
        description: "Check the title, partner name, state, and that the registration link starts with http(s)://",
      });
    } finally {
      setSavingNewPartner(false);
    }
  };

  const openRun = (source: DiscoverySourceRow | null) => {
    setRunTarget(source);
    setRunSummary(null);
    setRunState("");
    setRunCity("");
    setRunOpen(true);
  };

  // A run is a background job (it can take minutes): start it, then
  // poll its row until it reports completion.
  const runDiscovery = async () => {
    setRunning(true);
    setRunSummary(null);
    try {
      const { id } = await api("/run", {
        method: "POST",
        body: JSON.stringify({
          isDryRun: runIsDryRun,
          targetSourceId: runTarget?.id,
          targetState: runTarget ? undefined : runState || undefined,
          targetCity: runTarget ? undefined : runCity.trim() || undefined,
        }),
      });
      const deadline = Date.now() + 15 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const run: RunSummary = await api(`/runs/${id}`);
        if (run.completedAt) {
          setRunSummary(run);
          if (!run.isDryRun) {
            load();
            loadCounts();
          }
          return;
        }
      }
      toast({ title: "Still running", description: "This is taking a while - check back on the Sources tab shortly." });
    } catch (err: any) {
      toast({ variant: "destructive", title: err?.message || "Run failed" });
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

  const isFinal = (i: ExternalActivityRow) => i.discoveryStatus === "EXPIRED" || i.discoveryStatus === "CANCELLED";

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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={openNewPartnerEvent}
                  className="rounded-full px-6 cursor-pointer"
                  data-testid="new-partner-event-button"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" /> New Partner Event
                </Button>
                <Button
                  onClick={() => openRun(null)}
                  className="bg-primary text-foreground border-primary hover:bg-primary/90 font-bold rounded-full px-6 cursor-pointer"
                  data-testid="discovery-run-button"
                >
                  <Play className="w-4 h-4 mr-2" /> Run Discovery
                </Button>
              </div>
            </div>

            <div className="flex gap-6 border-b border-border mb-5" data-testid="discovery-views">
              {(["queue", "sources"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "pb-2 -mb-px text-sm font-medium border-b-2 cursor-pointer",
                    view === v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`discovery-view-${v}`}
                >
                  {v === "queue" ? "Review queue" : "Sources"}
                </button>
              ))}
            </div>

            {view === "sources" ? (
              <DiscoverySourcesPanel onRunSource={openRun} />
            ) : (
              <>
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
                        item.priceLabel ?? (item.price != null ? (item.price === 0 ? "Free" : `$${item.price}`) : null),
                      ].filter(Boolean);
                      const flag = item.extractionEvidence?._flag;
                      const changed = item.extractionEvidence?._changes;
                      const statusBadge = STATUS_BADGES[item.discoveryStatus];
                      // The source's own wording behind each extracted field (price,
                      // recurrence, ...) - lets an admin check the Agent against the page.
                      const evidenceEntries = Object.entries(item.extractionEvidence ?? {}).filter(([k]) => !k.startsWith("_"));
                      return (
                        <Card key={item.id} className="border-0 shadow-sm bg-muted/40" data-testid={`discovery-item-${item.id}`}>
                          <CardContent className="py-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold">{item.title}</p>
                                <p className="text-sm text-muted-foreground">{where || "Location unknown"}</p>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                                {item.sourceType === "PARTNER" && (
                                  <Badge className="bg-primary text-black" data-testid={`discovery-item-${item.id}-partner-badge`}>
                                    <ShieldCheck className="w-3 h-3 mr-1" /> Partner
                                  </Badge>
                                )}
                                {statusBadge && <Badge variant="outline">{statusBadge}</Badge>}
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

                            {(evidenceEntries.length > 0 || item.originalLevelText) && (
                              <details className="text-xs text-muted-foreground" data-testid={`discovery-item-${item.id}-wording`}>
                                <summary className="cursor-pointer">Source wording</summary>
                                <ul className="mt-1 space-y-0.5">
                                  {evidenceEntries.map(([k, v]) => (
                                    <li key={k}>
                                      <span className="font-medium">{k}:</span> {v}
                                    </li>
                                  ))}
                                  {item.originalLevelText && (
                                    <li>
                                      <span className="font-medium">level:</span> {item.originalLevelText}
                                    </li>
                                  )}
                                </ul>
                              </details>
                            )}
                            {changed && (
                              <p className="text-xs text-amber-700 dark:text-amber-400" data-testid={`discovery-item-${item.id}-changes`}>
                                Changed since it was approved: {changed}
                              </p>
                            )}
                            {flag && (
                              <p className="text-xs text-amber-700 dark:text-amber-400" data-testid={`discovery-item-${item.id}-flag`}>
                                Why it's here: {flag}
                              </p>
                            )}

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
                              <Button variant="outline" size="sm" onClick={() => openEdit(item)} data-testid={`discovery-item-${item.id}-edit`}>
                                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                              </Button>
                              {!isFinal(item) && (item.reviewStatus !== "APPROVED" || item.discoveryStatus !== "ACTIVE") && (
                                <Button size="sm" onClick={() => act(item.id, "approve")} data-testid={`discovery-item-${item.id}-approve`}>
                                  <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
                                </Button>
                              )}
                              {!isFinal(item) && item.reviewStatus !== "REJECTED" && item.reviewStatus !== "DUPLICATE" && (
                                <Button variant="outline" size="sm" onClick={() => act(item.id, "reject")} data-testid={`discovery-item-${item.id}-reject`}>
                                  <X className="w-3.5 h-3.5 mr-1.5" /> Reject
                                </Button>
                              )}
                              {!isFinal(item) && item.reviewStatus !== "DUPLICATE" && item.reviewStatus !== "REJECTED" && (
                                <Button variant="ghost" size="sm" onClick={() => act(item.id, "mark-duplicate")} data-testid={`discovery-item-${item.id}-duplicate`}>
                                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Duplicate
                                </Button>
                              )}
                              {item.sourceType !== "PARTNER" && item.reviewStatus !== "DUPLICATE" && item.reviewStatus !== "REJECTED" && (
                                <Button variant="outline" size="sm" onClick={() => openConfirmPartner(item)} data-testid={`discovery-item-${item.id}-confirm-partner`}>
                                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Confirm as Partner
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Suburb</Label>
                <Input value={editDraft.suburb ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, suburb: e.target.value }))} />
              </div>
              <div>
                <Label>State</Label>
                <Select
                  value={editDraft.state ?? NONE}
                  onValueChange={(v) => setEditDraft((d) => ({ ...d, state: v === NONE ? null : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unknown</SelectItem>
                    {AU_STATES.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Level</Label>
                <Select
                  value={editDraft.normalisedLevel ?? NONE}
                  onValueChange={(v) => setEditDraft((d) => ({ ...d, normalisedLevel: v === NONE ? null : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not stated</SelectItem>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <div>
              <Label>Price label (shown to players)</Label>
              <Input
                value={editDraft.priceLabel ?? ""}
                onChange={(e) => setEditDraft((d) => ({ ...d, priceLabel: e.target.value }))}
                placeholder="e.g. Free for members · $20 for non-members"
              />
            </div>
            <div>
              <Label>Registration link</Label>
              <Input
                value={editDraft.registrationUrl ?? ""}
                onChange={(e) => setEditDraft((d) => ({ ...d, registrationUrl: e.target.value }))}
                placeholder="https://..."
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

      <Dialog open={!!confirming} onOpenChange={(open) => !savingConfirm && !open && setConfirming(null)}>
        <DialogContent data-testid="confirm-partner-modal">
          <DialogHeader>
            <DialogTitle>Confirm as official partner</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Upgrades <span className="font-medium text-foreground">{confirming?.title}</span> in place - it stays the
            same event (nothing is duplicated), it just now shows the Partner badge instead of "Found by TennisConnect".
          </p>
          <div className="space-y-3">
            <div>
              <Label>Partner name</Label>
              <Input value={confirmPartnerName} onChange={(e) => setConfirmPartnerName(e.target.value)} placeholder="e.g. Strathfield Sports Club" />
            </div>
            <div>
              <Label>Partner organisation ID (optional)</Label>
              <Input
                value={confirmPartnerId}
                onChange={(e) => setConfirmPartnerId(e.target.value)}
                placeholder="Leave blank if they're not a registered TennisConnect organisation yet"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveConfirmPartner} disabled={savingConfirm || !confirmPartnerName.trim()} data-testid="confirm-partner-save">
              {savingConfirm ? "Confirming..." : "Confirm Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newPartnerOpen} onOpenChange={(open) => !savingNewPartner && setNewPartnerOpen(open)}>
        <DialogContent data-testid="new-partner-event-modal" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Partner Event</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            For an official partner's event Discovery hasn't found on its own. If Discovery already found this event,
            use "Confirm as Partner" on that item instead - don't create a second one here.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={newPartnerDraft.title ?? ""} onChange={(e) => setNewPartnerDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Partner name</Label>
                <Input value={newPartnerDraft.partnerName ?? ""} onChange={(e) => setNewPartnerDraft((d) => ({ ...d, partnerName: e.target.value }))} />
              </div>
              <div>
                <Label>Partner organisation ID (optional)</Label>
                <Input
                  value={newPartnerDraft.partnerId ?? ""}
                  onChange={(e) => setNewPartnerDraft((d) => ({ ...d, partnerId: e.target.value }))}
                  placeholder="Leave blank if not yet registered"
                />
              </div>
            </div>
            <div>
              <Label>Registration link (required - where players register)</Label>
              <Input
                value={newPartnerDraft.registrationUrl ?? ""}
                onChange={(e) => setNewPartnerDraft((d) => ({ ...d, registrationUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start date (YYYY-MM-DD, optional for a recurring session)</Label>
                <Input value={newPartnerDraft.startDate ?? ""} onChange={(e) => setNewPartnerDraft((d) => ({ ...d, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>Venue</Label>
                <Input value={newPartnerDraft.venueName ?? ""} onChange={(e) => setNewPartnerDraft((d) => ({ ...d, venueName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start time (HH:MM)</Label>
                <Input value={newPartnerDraft.startTime ?? ""} onChange={(e) => setNewPartnerDraft((d) => ({ ...d, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>End time (HH:MM)</Label>
                <Input value={newPartnerDraft.endTime ?? ""} onChange={(e) => setNewPartnerDraft((d) => ({ ...d, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Repeats (optional)</Label>
                <Select
                  value={newPartnerDraft.recurrenceFrequency ?? "__none__"}
                  onValueChange={(v) => setNewPartnerDraft((d) => ({ ...d, recurrenceFrequency: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">One-off</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Day of week (if repeating)</Label>
                <Select
                  value={newPartnerDraft.recurrenceDayOfWeek ?? "__none__"}
                  onValueChange={(v) => setNewPartnerDraft((d) => ({ ...d, recurrenceDayOfWeek: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-</SelectItem>
                    {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((d) => (
                      <SelectItem key={d} value={d}>{humanise(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Suburb</Label>
                <Input value={newPartnerDraft.suburb ?? ""} onChange={(e) => setNewPartnerDraft((d) => ({ ...d, suburb: e.target.value }))} />
              </div>
              <div>
                <Label>City</Label>
                <Input value={newPartnerDraft.city ?? ""} onChange={(e) => setNewPartnerDraft((d) => ({ ...d, city: e.target.value }))} />
              </div>
              <div>
                <Label>State</Label>
                <Select value={newPartnerDraft.state ?? "__none__"} onValueChange={(v) => setNewPartnerDraft((d) => ({ ...d, state: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-</SelectItem>
                    {AU_STATES.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Level</Label>
                <Select
                  value={newPartnerDraft.normalisedLevel ?? "__none__"}
                  onValueChange={(v) => setNewPartnerDraft((d) => ({ ...d, normalisedLevel: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not stated</SelectItem>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price label (shown to players)</Label>
                <Input
                  value={newPartnerDraft.priceLabel ?? ""}
                  onChange={(e) => setNewPartnerDraft((d) => ({ ...d, priceLabel: e.target.value }))}
                  placeholder="e.g. $20 per session"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={saveNewPartnerEvent}
              disabled={savingNewPartner || !newPartnerDraft.title?.trim() || !newPartnerDraft.partnerName?.trim() || !newPartnerDraft.registrationUrl?.trim()}
              data-testid="new-partner-event-save"
            >
              {savingNewPartner ? "Creating..." : "Create Partner Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runOpen} onOpenChange={(open) => !running && setRunOpen(open)}>
        <DialogContent data-testid="discovery-run-modal">
          <DialogHeader>
            <DialogTitle>{runTarget ? `Run: ${runTarget.name}` : "Run Discovery"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={runIsDryRun} disabled={running} onChange={(e) => setRunIsDryRun(e.target.checked)} />
              Dry run (discover and extract, but don't publish anything)
            </label>
            {!runTarget && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>State (optional)</Label>
                  <Input placeholder="e.g. VIC" value={runState} onChange={(e) => setRunState(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <Label>City (optional)</Label>
                  <Input placeholder="e.g. Melbourne" value={runCity} onChange={(e) => setRunCity(e.target.value)} />
                </div>
              </div>
            )}
            {runSummary && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1" data-testid="discovery-run-summary">
                <p className="font-medium">{runSummary.isDryRun ? "Dry run - nothing was published" : "Run complete"}</p>
                <p>Sources scanned: {runSummary.sourcesScanned}</p>
                <p>Pages checked: {runSummary.pagesChecked}</p>
                <p>Potential events: {runSummary.eventsDiscovered}</p>
                <p>Valid: {runSummary.eventsValid}</p>
                <p>Potential duplicates: {runSummary.duplicatesDetected}</p>
                <p>Needs review: {runSummary.eventsNeedingReview}</p>
                <p>Rejected by validation: {runSummary.validationFailures}</p>
                <p>{runSummary.isDryRun ? "Would be created" : "Created"}: {runSummary.eventsCreated}</p>
                <p>{runSummary.isDryRun ? "Would be updated" : "Updated"}: {runSummary.eventsUpdated}</p>
                {runSummary.errors?.length > 0 && (
                  <div className="pt-1">
                    <p className="font-medium text-destructive">Problems ({runSummary.errors.length})</p>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      {runSummary.errors.map((e, i) => (
                        <li key={i}>
                          {e.sourceName}: {e.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
