import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Check, X, Copy, Pencil, Play } from "lucide-react";

// [PLAY][AI] TC Discovery Agent, sections 16-17 - the Admin Discovery
// Queue. Deliberately simple (spec's own words: "keep this operational
// UI simple... do not turn it into a complex crawler-management
// dashboard") - a tab per queue state, one card per item, five actions.
// Talks directly to the /api/admin/discovery/* routes already built.

const TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
] as const;

interface ExternalActivityRow {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  suburb: string | null;
  city: string | null;
  state: string | null;
  startDate: string | null;
  startTime: string | null;
  activityType: string | null;
  normalisedLevel: string | null;
  originalLevelText: string | null;
  price: number | null;
  currency: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reviewStatus: string;
  discoveryStatus: string;
  duplicateConfidence: number | null;
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

export default function AdminDiscoveryPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isAdmin = !!user?.isAdmin;

  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("PENDING");
  const [items, setItems] = useState<ExternalActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExternalActivityRow | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ExternalActivityRow>>({});
  const [runOpen, setRunOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<Record<string, number> | null>(null);
  const [runIsDryRun, setRunIsDryRun] = useState(true);
  const [runState, setRunState] = useState("");

  const load = () => {
    if (!isAdmin) return;
    setLoading(true);
    api(`/activities?status=${tab}`)
      .then(setItems)
      .catch(() => toast({ variant: "destructive", title: "Couldn't load the queue" }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab, isAdmin]);

  const act = async (id: string, action: "approve" | "reject" | "mark-duplicate") => {
    try {
      await api(`/activities/${id}/${action}`, { method: "POST", body: "{}" });
      setItems((prev) => prev.filter((i) => i.id !== id));
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
      if (!runIsDryRun) load();
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
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title="Discovery Queue | Admin" description="Review externally discovered tennis activities." noIndex canonical="/admin/discovery" />
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold">Discovery</h1>
            <p className="text-sm text-muted-foreground">External tennis activities found across Australia, awaiting review.</p>
          </div>
          <Button onClick={() => setRunOpen(true)} data-testid="discovery-run-button">
            <Play className="w-4 h-4 mr-1.5" /> Run Discovery
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
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">Nothing here right now.</p>
        ) : (
          <div className="space-y-3" data-testid="discovery-queue-list">
            {items.map((item) => (
              <Card key={item.id} className="border-0 shadow-sm" data-testid={`discovery-item-${item.id}`}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.sourceName} · {[item.suburb, item.state].filter(Boolean).join(", ") || "Location unknown"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{item.confidence}</Badge>
                  </div>

                  <p className="text-sm">
                    {item.startDate ? `${item.startDate}${item.startTime ? " · " + item.startTime : ""}` : "No date extracted"}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {item.activityType && <Badge variant="secondary">{item.activityType}</Badge>}
                    {(item.normalisedLevel || item.originalLevelText) && (
                      <Badge variant="secondary">{item.normalisedLevel ?? item.originalLevelText}</Badge>
                    )}
                    {item.price != null && <Badge variant="secondary">${item.price} {item.currency}</Badge>}
                    {item.duplicateConfidence != null && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        {item.duplicateConfidence}% possible duplicate
                      </Badge>
                    )}
                  </div>

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
                    {item.reviewStatus !== "APPROVED" && (
                      <Button size="sm" onClick={() => act(item.id, "approve")} data-testid={`discovery-item-${item.id}-approve`}>
                        <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
                      </Button>
                    )}
                    {item.reviewStatus !== "REJECTED" && (
                      <Button variant="outline" size="sm" onClick={() => act(item.id, "reject")} data-testid={`discovery-item-${item.id}-reject`}>
                        <X className="w-3.5 h-3.5 mr-1.5" /> Reject
                      </Button>
                    )}
                    {item.reviewStatus !== "DUPLICATE" && (
                      <Button variant="ghost" size="sm" onClick={() => act(item.id, "mark-duplicate")} data-testid={`discovery-item-${item.id}-duplicate`}>
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Duplicate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />

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
            <div>
              <Label>Start time (HH:MM)</Label>
              <Input value={editDraft.startTime ?? ""} onChange={(e) => setEditDraft((d) => ({ ...d, startTime: e.target.value }))} />
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
            <Button onClick={saveEdit} data-testid="discovery-edit-save">Save</Button>
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
    </div>
  );
}
