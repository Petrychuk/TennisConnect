import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, ExternalLink, Send, Ban } from "lucide-react";
import SEO from "@/components/seo";
import { TennisLoader } from "@/components/ui/tennisLoader";

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface SessionRow {
  id: string;
  title: string;
  type: string;
  status: "draft" | "pending_review" | "published" | "rejected" | "cancelled" | "live" | "completed";
  location: string | null;
  startAt: string;
  maxParticipants: number | null;
  reviewNote: string | null;
}

const SESSION_TYPE_OPTIONS = [
  { value: "social", label: "Social Hit" },
  { value: "round-robin", label: "Round Robin" },
  { value: "clinic", label: "Clinic" },
  { value: "tournament", label: "Tournament" },
];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-orange-100 text-orange-700",
  published: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  live: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const STATUS_LABEL: Record<string, string> = {
    draft: "Draft",
    pending_review: "Pending Review",
    published: "Published",
    rejected: "Rejected",
    cancelled: "Cancelled",
    live: "Live",
    completed: "Completed",
  };

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default function OrganizerDashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionDraft, setSessionDraft] = useState({
    title: "",
    type: "social",
    description: "",
    location: "",
    startAt: toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    price: "",
    maxParticipants: "",
    waitingListEnabled: true,
  });
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLocation("/auth");
      return;
    }
    // Load regardless of current isOrganizer — a revoked organizer
    // should still be able to see their past organization/sessions as
    // history. Whether they can manage anything is decided at render
    // time by isReadOnly, further down.
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  async function loadAll() {
    setLoading(true);
    try {
      const orgRes = await fetch("/api/organizer/organizations/me", { credentials: "include" });
      const org = orgRes.ok ? await orgRes.json() : null;
      setOrganization(org);

      if (org) {
        const sessionsRes = await fetch("/api/organizer/sessions/mine", { credentials: "include" });
        if (sessionsRes.ok) setSessions(await sessionsRes.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrganization(e: React.FormEvent) {
    e.preventDefault();
    setCreatingOrg(true);
    try {
      const res = await fetch("/api/organizer/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: orgName, description: orgDescription || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not create organization");
      setOrganization(json);
      toast({ title: "Organization created", description: `${json.name} is ready.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreatingOrg(false);
    }
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setSavingSession(true);
    try {
      const res = await fetch("/api/organizer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: sessionDraft.title,
          type: sessionDraft.type,
          description: sessionDraft.description || undefined,
          location: sessionDraft.location || undefined,
          startAt: new Date(sessionDraft.startAt).toISOString(),
          price: sessionDraft.price ? Number(sessionDraft.price) : undefined,
          maxParticipants: sessionDraft.maxParticipants
            ? Number(sessionDraft.maxParticipants)
            : undefined,
          waitingListEnabled: sessionDraft.waitingListEnabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not create session");
      toast({ title: "Session created", description: "It's saved as a draft — publish it when ready." });
      setSessionDialogOpen(false);
      setSessionDraft({
        title: "",
        type: "social",
        description: "",
        location: "",
        startAt: toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        price: "",
        maxParticipants: "",
        waitingListEnabled: true,
      });
      loadAll();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingSession(false);
    }
  }

  async function handlePublish(id: string) {
    setActioningId(id);
    try {
      const res = await fetch(`/api/organizer/sessions/${id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast(
        user?.isAdmin
          ? { title: "Session published" }
          : {
              title: "Submitted for review",
              description: "An admin will approve it before it goes live.",
            }
      );
       loadAll();

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActioningId(null);
    }
  }

  async function handleCancel(id: string) {
    setActioningId(id);
    try {
      const res = await fetch(`/api/organizer/sessions/${id}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ title: "Session cancelled" });
      loadAll();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActioningId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <TennisLoader />
      </div>
    );
  }

  if (!user?.isOrganizer && !organization) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Organizer access required</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              You need to be an approved organizer to view this page. Head to your profile to
              request organizer access.
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Organizer access was revoked, but they have an Organization/Sessions
  // from when they were active — keep it visible as history, just not
  // editable. (Session/tournament creation itself is still a work in
  // progress regardless of this flag; this only governs who's allowed
  // to touch it once it's finished.)
  const isReadOnly = !user?.isOrganizer;

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Organizer Dashboard | TennisConnect"
        description="Manage your Organization and Sessions on TennisConnect."
        noIndex
      />
      <Navbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 space-y-8">
        <h1 className="font-display text-3xl font-bold">Organizer Dashboard</h1>

        {isReadOnly && (
          <Card className="border-orange-200 bg-orange-50" data-testid="organizer-readonly-banner">
            <CardContent className="py-4 text-sm text-orange-800">
              Your organizer access has been revoked. You can still see your past Organization
              and Sessions below, but you can't create or manage new ones. Contact an admin if
              you think this is a mistake.
            </CardContent>
          </Card>
        )}

        {!organization ? (
          <Card data-testid="create-organization-card">
            <CardHeader>
              <CardTitle>Create your Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrganization} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Name</Label>
                  <Input
                    id="org-name"
                    data-testid="organization-name-input"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Bondi Social Tennis"
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-description">Description (optional)</Label>
                  <Textarea
                    id="org-description"
                    data-testid="organization-description-input"
                    value={orgDescription}
                    onChange={(e) => setOrgDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button type="submit" disabled={creatingOrg} data-testid="create-organization-submit">
                  {creatingOrg && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Organization
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-display text-xl font-bold">{organization.name}</div>
                  {organization.description && (
                    <p className="text-sm text-muted-foreground mt-1">{organization.description}</p>
                  )}
                </div>
                <Button variant="outline" asChild data-testid="view-organization-page">
                  <a href={`/organizations/${organization.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View public page
                  </a>
                </Button>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Sessions</h2>
              {!isReadOnly && (
              <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="create-session-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Session
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Session</DialogTitle>
                  </DialogHeader>
                  {!user?.isAdmin && (
                    <p className="text-sm text-muted-foreground -mt-2">
                      Saved as a draft first — you'll submit it for admin review before it's visible to players.
                    </p>
                  )}
                  <form onSubmit={handleCreateSession} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="session-title">Title</Label>
                      <Input
                        id="session-title"
                        data-testid="session-title-input"
                        value={sessionDraft.title}
                        onChange={(e) => setSessionDraft({ ...sessionDraft, title: e.target.value })}
                        required
                        minLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={sessionDraft.type}
                        onValueChange={(value) => setSessionDraft({ ...sessionDraft, type: value })}
                      >
                        <SelectTrigger data-testid="session-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SESSION_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-description">Description</Label>
                      <Textarea
                        id="session-description"
                        data-testid="session-description-input"
                        value={sessionDraft.description}
                        onChange={(e) =>
                          setSessionDraft({ ...sessionDraft, description: e.target.value })
                        }
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-location">Location</Label>
                      <Input
                        id="session-location"
                        data-testid="session-location-input"
                        value={sessionDraft.location}
                        onChange={(e) => setSessionDraft({ ...sessionDraft, location: e.target.value })}
                        placeholder="e.g. Rushcutters Bay Tennis Courts"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-start">Start</Label>
                      <Input
                        id="session-start"
                        data-testid="session-start-input"
                        type="datetime-local"
                        value={sessionDraft.startAt}
                        onChange={(e) => setSessionDraft({ ...sessionDraft, startAt: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="session-price">Price (AUD)</Label>
                        <Input
                          id="session-price"
                          data-testid="session-price-input"
                          type="number"
                          min={0}
                          value={sessionDraft.price}
                          onChange={(e) => setSessionDraft({ ...sessionDraft, price: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="session-max">Max players</Label>
                        <Input
                          id="session-max"
                          data-testid="session-max-participants-input"
                          type="number"
                          min={1}
                          value={sessionDraft.maxParticipants}
                          onChange={(e) =>
                            setSessionDraft({ ...sessionDraft, maxParticipants: e.target.value })
                          }
                          placeholder="Unlimited"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="session-waitlist">Enable waiting list</Label>
                      <Switch
                        id="session-waitlist"
                        data-testid="session-waitlist-toggle"
                        checked={sessionDraft.waitingListEnabled}
                        onCheckedChange={(checked) =>
                          setSessionDraft({ ...sessionDraft, waitingListEnabled: checked })
                        }
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={savingSession} data-testid="create-session-submit">
                        {savingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save as Draft
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              )}
            </div>

            {sessions.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground" data-testid="sessions-empty">
                  {isReadOnly ? "No sessions in your history." : "No sessions yet. Create your first one above."}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <Card key={session.id} data-testid={`organizer-session-${session.id}`}>
                    <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{session.title}</span>
                          <Badge className={STATUS_BADGE[session.status]}>
                           {STATUS_LABEL[session.status]}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(session.startAt).toLocaleString(undefined, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {session.location ? ` · ${session.location}` : ""}
                        </div>
                        {session.status === "rejected" && session.reviewNote && (
                         <div className="text-sm text-destructive" data-testid={`session-review-note-${session.id}`}>
                            Admin note: {session.reviewNote}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                      {!isReadOnly && (session.status === "draft" || session.status === "rejected") && (
                          <Button
                            size="sm"
                            onClick={() => handlePublish(session.id)}
                            disabled={actioningId === session.id}
                            data-testid={`publish-session-${session.id}`}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            {user?.isAdmin ? "Publish" : "Submit for Review"}
                          </Button>
                        )}
                        {!isReadOnly && (session.status === "draft" ||
                          session.status === "pending_review" ||
                          session.status === "published") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(session.id)}
                            disabled={actioningId === session.id}
                            data-testid={`cancel-session-${session.id}`}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}