import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface MySession {
  id: string;
  title: string;
  location: string | null;
  startAt: string;
  organizationName: string;
  organizationSlug: string;
  viewerRegistrationStatus: "registered" | "waitlisted" | "cancelled" | null;
}

// "My Sessions" — sessions the current user has joined (Play Hub).
export function MySessionsSection() {
  const [sessions, setSessions] = useState<MySession[] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { toast } = useToast();

  async function load() {
    try {
      const res = await fetch("/api/organizer/sessions/mine/registered", {
        credentials: "include",
      });
      if (!res.ok) return;
      setSessions(await res.json());
    } catch {
      setSessions([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCancel(sessionId: string) {
    setCancellingId(sessionId);
    try {
      const res = await fetch(`/api/organizer/sessions/${sessionId}/join`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Could not cancel");
      }
      toast({ title: "Registration cancelled" });
      await load();
    } catch (error: any) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  }

  if (sessions === null) {
    return (
      <div className="flex justify-center py-8" data-testid="my-sessions-loading">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card data-testid="my-sessions-empty">
        <CardContent className="py-10 text-center text-muted-foreground">
          You haven't joined any sessions yet. Check "Play This Week" on the homepage to find one.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="my-sessions-list">
      {sessions.map((session) => (
        <Card key={session.id} data-testid={`my-session-${session.id}`}>
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link href={`/organisations/${session.organizationSlug}`} className="font-semibold hover:underline">
                  {session.title}
                </Link>
                {session.viewerRegistrationStatus === "waitlisted" && (
                  <Badge variant="secondary">Waitlisted</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(session.startAt).toLocaleString(undefined, {
                    weekday: "short",
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
                <span>by {session.organizationName}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancel(session.id)}
              disabled={cancellingId === session.id}
              data-testid={`cancel-session-${session.id}`}
            >
              {cancellingId === session.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}