import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Calendar, MapPin } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminSessions, approveSession as approveSessionApi, rejectSession as rejectSessionApi } from "@/lib/api/organizer-sessions";
import { toSessionListItems } from "@/lib/api/session-adapter";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";

interface OrganizerRequestRow {
  id: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  note: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  userRole: string;
}

const REQUEST_FILTERS = ["pending", "approved", "rejected", "revoked"] as const;
const SESSION_FILTERS = ["pending_review", "published", "rejected", "cancelled"] as const;

const SESSION_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  published: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  live: "Live",
  completed: "Completed",
};

// Top-level admin section for the whole Organizer/Play Hub feature:
// who's allowed to organize (Access Requests), and everything they've
// submitted (Sessions) — so nothing goes live unseen.
export default function AdminOrganizerTab() {
  return (
    <div className="bg-white rounded-3xl border border-border p-6" data-testid="admin-organizer-tab">
      <h2 className="font-display text-2xl font-bold mb-6">Organiser &amp; Sessions</h2>

      <Tabs defaultValue="sessions">
        <TabsList className="mb-6">
          <TabsTrigger value="sessions" data-testid="organizer-subtab-sessions">
            Sessions
          </TabsTrigger>
          <TabsTrigger value="access" data-testid="organizer-subtab-access">
            Access Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <SessionModerationPanel />
        </TabsContent>

        <TabsContent value="access">
          <AccessRequestsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SessionModerationPanel() {
  const queryClient = useQueryClient();
  const adminSessionsQuery = useQuery({
    queryKey: ["/api/organizer/admin/sessions"],
    queryFn: () => getAdminSessions(),
  });
  const allSessions = toSessionListItems(adminSessionsQuery.data ?? []);
  const [statusFilter, setStatusFilter] = useState<(typeof SESSION_FILTERS)[number]>("pending_review");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SessionListItem | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const { toast } = useToast();

  const sessions = allSessions.filter((s) => s.status === statusFilter);
  const countByStatus: Record<string, number> = {};
  SESSION_FILTERS.forEach((status) => {
    countByStatus[status] = allSessions.filter((s) => s.status === status).length;
  });

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      // Approval is what turns a session on for real: registration opens
      // and it becomes eligible for public display (profile "Sessions"
      // tab, and eventually the club's own premium page and the
      // homepage "What's On" block, once those pull from real
      // organiser data).
      await approveSessionApi(id);
      await queryClient.invalidateQueries({ queryKey: ["/api/organizer/admin/sessions"] });
      toast({ title: "Session approved", description: "It's now open for registration and visible on the organiser's profile." });
    } catch (error: any) {
      toast({ title: "Couldn't approve session", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setProcessingId(rejectTarget.id);
    try {
      await rejectSessionApi(rejectTarget.id, rejectNote || undefined);
      await queryClient.invalidateQueries({ queryKey: ["/api/organizer/admin/sessions"] });
      toast({ title: "Session rejected", description: "The organiser can edit and resubmit it." });
      setRejectTarget(null);
      setRejectNote("");
    } catch (error: any) {
      toast({ title: "Couldn't reject session", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-6">
        {SESSION_FILTERS.map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? "default" : "outline"}
            onClick={() => setStatusFilter(status)}
            data-testid={`session-moderation-filter-${status}`}
            className="gap-1.5"
          >
            {SESSION_STATUS_LABEL[status]}
            {countByStatus[status] > 0 && (
              <Badge
                className={
                  status === "pending_review"
                    ? "bg-destructive text-destructive-foreground"
                    : statusFilter === status
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }
                data-testid={`session-moderation-filter-${status}-count`}
              >
                {countByStatus[status]}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center" data-testid="session-moderation-empty">
          No sessions with status "{SESSION_STATUS_LABEL[statusFilter]}".
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              data-testid={`session-moderation-row-${session.id}`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{session.title}</span>
                  <Badge variant="secondary" className="capitalize">
                    {session.type.replace("-", " ")}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(session.startAt).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {session.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {session.location}
                    </span>
                  )}
                  {session.organizerName && <span>by {session.organizerName}</span>}
                </div>
                {session.status === "rejected" && session.reviewNote && (
                  <div className="text-sm text-destructive">Note: {session.reviewNote}</div>
                )}
              </div>

              {statusFilter === "pending_review" && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(session.id)}
                    disabled={processingId === session.id}
                    data-testid={`approve-session-${session.id}`}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectTarget(session)}
                    disabled={processingId === session.id}
                    data-testid={`reject-session-${session.id}`}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject "{rejectTarget?.title}"</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Optional note for the organiser (why it was rejected)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            data-testid="reject-session-note-input"
          />
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processingId === rejectTarget?.id}
              data-testid="confirm-reject-session"
            >
              Reject Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccessRequestsPanel() {
  const [requests, setRequests] = useState<OrganizerRequestRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof REQUEST_FILTERS)[number]>("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  async function loadRequests(status: string) {
    const res = await fetch(`/api/organizer/requests?status=${status}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    setRequests(await res.json());
  }

  useEffect(() => {
    loadRequests(statusFilter);
  }, [statusFilter]);

  async function handleDecision(id: string, decision: "approve" | "reject") {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/organizer/requests/${id}/${decision}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Something went wrong");
      }
      toast({
        title: decision === "approve" ? "Request approved" : "Request rejected",
        description:
          decision === "approve"
            ? "The user can now create an Organization and submit Sessions for review."
            : "The user has been notified they can request again.",
      });
      loadRequests(statusFilter);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div data-testid="admin-organizer-requests-tab">
      <div className="flex flex-wrap gap-2 mb-6">
        {REQUEST_FILTERS.map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? "default" : "outline"}
            onClick={() => setStatusFilter(status)}
            data-testid={`organizer-requests-filter-${status}`}
            className="capitalize"
          >
            {status}
          </Button>
        ))}
      </div>

      {requests.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center" data-testid="organizer-requests-empty">
          No {statusFilter} requests.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 min-w-[220px]">Name</th>
                <th className="text-left py-3 min-w-[260px]">Email</th>
                <th className="text-left py-3">Role</th>
                <th className="text-left py-3">Note</th>
                <th className="text-left py-3">Requested</th>
                {statusFilter === "pending" && <th className="text-center py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b" data-testid={`organizer-request-row-${request.id}`}>
                  <td className="py-4 font-medium">{request.userName}</td>
                  <td className="py-4 text-muted-foreground">{request.userEmail}</td>
                  <td className="py-4 capitalize">{request.userRole}</td>
                  <td className="py-4 text-sm text-muted-foreground max-w-[240px] truncate">
                    {request.note || "—"}
                  </td>
                  <td className="py-4 text-sm text-muted-foreground">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </td>
                  {statusFilter === "pending" && (
                    <td className="py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleDecision(request.id, "approve")}
                          disabled={processingId === request.id}
                          data-testid={`approve-organizer-request-${request.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecision(request.id, "reject")}
                          disabled={processingId === request.id}
                          data-testid={`reject-organizer-request-${request.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}