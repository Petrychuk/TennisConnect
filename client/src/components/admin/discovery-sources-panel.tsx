import { useEffect, useState } from "react";
import { Plus, Pencil, Play, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// [PLAY][AI] TC Discovery Agent, spec sections 3-4 and 23 - the Source
// Registry, as a screen. The Agent only ever reads the pages listed
// here; it never follows links or crawls. Until now the registry could
// only be filled through the API, which made the "controlled pilot of
// 5-10 sources" impractical to actually run.

export interface DiscoverySourceRow {
  id: string;
  name: string;
  baseUrl: string;
  extraUrls: string[] | null;
  sourceType: string;
  state: string | null;
  city: string | null;
  enabled: boolean;
  lastScanAt: string | null;
  nextScanAt: string | null;
}

const SOURCE_TYPES: { value: string; label: string }[] = [
  { value: "CLUB", label: "Club" },
  { value: "COMMUNITY", label: "Community" },
  { value: "ORGANISER", label: "Organiser" },
  { value: "TOURNAMENT_PLATFORM", label: "Tournament platform" },
  { value: "TENNIS_ORGANISATION", label: "Tennis organisation" },
  { value: "PUBLIC_EVENT_PAGE", label: "Event page" },
  { value: "OTHER", label: "Other" },
];
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const NONE = "__none__"; // Radix Select can't hold an empty-string value

interface Draft {
  name: string;
  baseUrl: string;
  extraUrls: string; // one per line
  sourceType: string;
  state: string;
  city: string;
}
const EMPTY_DRAFT: Draft = { name: "", baseUrl: "", extraUrls: "", sourceType: "CLUB", state: NONE, city: "" };

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`/api/admin/discovery${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? "Request failed");
  return res.json();
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : null;

export function DiscoverySourcesPanel({ onRunSource }: { onRunSource: (source: DiscoverySourceRow) => void }) {
  const { toast } = useToast();
  const [sources, setSources] = useState<DiscoverySourceRow[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api("/sources")
      .then(setSources)
      .catch(() => toast({ variant: "destructive", title: "Couldn't load sources" }));

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  };

  const openEdit = (s: DiscoverySourceRow) => {
    setEditingId(s.id);
    setDraft({
      name: s.name,
      baseUrl: s.baseUrl,
      extraUrls: (s.extraUrls ?? []).join("\n"),
      sourceType: s.sourceType,
      state: s.state ?? NONE,
      city: s.city ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const extraUrls = draft.extraUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (!draft.name.trim() || !draft.baseUrl.trim()) {
      toast({ variant: "destructive", title: "A name and a main page are required" });
      return;
    }
    const body = {
      name: draft.name.trim(),
      baseUrl: draft.baseUrl.trim(),
      extraUrls,
      sourceType: draft.sourceType,
      state: draft.state === NONE ? null : draft.state,
      city: draft.city.trim() || null,
    };
    setSaving(true);
    try {
      await api(editingId ? `/sources/${editingId}` : "/sources", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setDialogOpen(false);
      await load();
      toast({ title: editingId ? "Source updated" : "Source added" });
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't save the source",
        description: "Check the links - only public http(s) pages are allowed (up to 5 extra pages).",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (s: DiscoverySourceRow, enabled: boolean) => {
    setSources((prev) => prev?.map((x) => (x.id === s.id ? { ...x, enabled } : x)) ?? prev);
    try {
      await api(`/sources/${s.id}`, { method: "PUT", body: JSON.stringify({ enabled }) });
    } catch {
      setSources((prev) => prev?.map((x) => (x.id === s.id ? { ...x, enabled: !enabled } : x)) ?? prev);
      toast({ variant: "destructive", title: "Couldn't update the source" });
    }
  };

  return (
    <div data-testid="discovery-sources-panel">
      <div className="flex items-center justify-between gap-4 mb-4 max-w-4xl">
        <p className="text-sm text-muted-foreground">
          The Agent only reads the pages listed here - it never follows links or searches the web on its own.
        </p>
        <Button size="sm" onClick={openAdd} className="shrink-0" data-testid="discovery-source-add">
          <Plus className="w-4 h-4 mr-1.5" /> Add source
        </Button>
      </div>

      {sources === null ? (
        <div className="space-y-3 max-w-4xl">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <div className="py-20 text-center max-w-md mx-auto" data-testid="discovery-sources-empty">
          <p className="font-medium">No sources yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add the first tennis club, community or event page you want the Agent to check.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-4xl">
          {sources.map((s) => {
            const type = SOURCE_TYPES.find((t) => t.value === s.sourceType)?.label ?? s.sourceType;
            const extra = s.extraUrls?.length ?? 0;
            return (
              <Card key={s.id} className="border-0 shadow-sm bg-muted/40" data-testid={`discovery-source-${s.id}`}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{s.name}</p>
                      <a
                        href={s.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1 max-w-full"
                      >
                        <span className="truncate">{s.baseUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{s.enabled ? "Enabled" : "Paused"}</span>
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={(v) => toggleEnabled(s, v)}
                        data-testid={`discovery-source-${s.id}-toggle`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{type}</Badge>
                    <Badge variant="secondary">{[s.city, s.state].filter(Boolean).join(", ") || "Multiple states"}</Badge>
                    {extra > 0 && <Badge variant="outline">+{extra} more {extra === 1 ? "page" : "pages"}</Badge>}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {s.lastScanAt ? `Last scanned ${formatDate(s.lastScanAt)}` : "Never scanned"}
                    {s.nextScanAt && ` · Next check ${formatDate(s.nextScanAt)}`}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => onRunSource(s)} data-testid={`discovery-source-${s.id}-run`}>
                      <Play className="w-3.5 h-3.5 mr-1.5" /> Run
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(s)} data-testid={`discovery-source-${s.id}-edit`}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="discovery-source-modal">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit source" : "Add source"}</DialogTitle>
            <DialogDescription>A club, community or event page the Agent is allowed to read.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Example Tennis Club" />
            </div>
            <div>
              <Label>Main page</Label>
              <Input value={draft.baseUrl} onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>Additional pages (optional, one per line)</Label>
              <Textarea
                rows={3}
                value={draft.extraUrls}
                onChange={(e) => setDraft((d) => ({ ...d, extraUrls: e.target.value }))}
                placeholder={"https://.../social-tennis\nhttps://.../competitions"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={draft.sourceType} onValueChange={(v) => setDraft((d) => ({ ...d, sourceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>State</Label>
                <Select value={draft.state} onValueChange={(v) => setDraft((d) => ({ ...d, state: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Multiple / national</SelectItem>
                    {STATES.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>City (optional)</Label>
              <Input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} placeholder="e.g. Melbourne" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving} data-testid="discovery-source-save">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
