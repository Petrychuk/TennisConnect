import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";
import { TennisLoader } from "@/components/ui/tennisLoader";

interface SessionWithDetails {
  id: string;
  title: string;
  description: string | null;
  type: string;
  location: string | null;
  startAt: string;
  price: string | null;
  currency: string;
  maxParticipants: number | null;
  spotsLeft: number | null;
  registeredCount: number;
  waitlistedCount: number;
  viewerRegistrationStatus: "registered" | "waitlisted" | "cancelled" | null;
}

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  cover: string | null;
  upcomingSessions: SessionWithDetails[];
}

export default function OrganizationDetailPage() {
  const [, params] = useRoute("/organizations/:slug");
  const slug = params?.slug;
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function load() {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizer/organizations/${slug}`, { credentials: "include" });
      if (res.ok) {
        setOrganization(await res.json());
      } else {
        setOrganization(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function handleJoin(sessionId: string) {
    if (!isAuthenticated) {
      setLocation("/auth");
      return;
    }
    setJoiningId(sessionId);
    try {
      const res = await fetch(`/api/organizer/sessions/${sessionId}/join`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not join session");
      toast({
        title: json.waitlisted ? "Added to waiting list" : "You're in!",
        description: json.waitlisted
          ? "We'll bump you up automatically if a spot opens."
          : "See you on court.",
      });
      load();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setJoiningId(null);
    }
  }

  async function handleLeave(sessionId: string) {
    setJoiningId(sessionId);
    try {
      const res = await fetch(`/api/organizer/sessions/${sessionId}/join`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ title: "Registration cancelled" });
      load();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setJoiningId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <TennisLoader />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Organization not found.
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title={`${organization.name} | TennisConnect`}
        description={organization.description || `Play with ${organization.name} on TennisConnect.`}
      />
      <Navbar />

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-10 space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold" data-testid="organization-name">
            {organization.name}
          </h1>
          {organization.description && (
            <p className="text-muted-foreground mt-2 max-w-2xl">{organization.description}</p>
          )}
        </div>

        <div>
          <h2 className="font-display text-2xl font-bold mb-4">Upcoming Sessions</h2>

          {organization.upcomingSessions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground" data-testid="upcoming-sessions-empty">
                No upcoming sessions right now — check back soon.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {organization.upcomingSessions.map((session) => {
                const isFull = session.spotsLeft !== null && session.spotsLeft <= 0;
                const isRegistered = session.viewerRegistrationStatus === "registered";
                const isWaitlisted = session.viewerRegistrationStatus === "waitlisted";

                return (
                  <Card key={session.id} data-testid={`session-card-${session.id}`}>
                    <CardContent className="py-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold">{session.title}</h3>
                        <Badge variant="secondary" className="capitalize shrink-0">
                          {session.type.replace("-", " ")}
                        </Badge>
                      </div>

                      {session.description && (
                        <p className="text-sm text-muted-foreground">{session.description}</p>
                      )}

                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(session.startAt).toLocaleString(undefined, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {session.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {session.location}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {session.maxParticipants
                            ? `${session.registeredCount}/${session.maxParticipants} joined${
                                session.waitlistedCount > 0
                                  ? ` · ${session.waitlistedCount} waiting`
                                  : ""
                              }`
                            : `${session.registeredCount} joined`}
                        </div>
                      </div>

                      {session.price && Number(session.price) > 0 && (
                        <div className="font-semibold">
                          {session.currency} {session.price}
                        </div>
                      )}

                      {isRegistered || isWaitlisted ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleLeave(session.id)}
                          disabled={joiningId === session.id}
                          data-testid={`leave-session-${session.id}`}
                        >
                          {joiningId === session.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isWaitlisted ? "Leave Waiting List" : "Cancel"}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => handleJoin(session.id)}
                          disabled={joiningId === session.id}
                          data-testid={`join-session-${session.id}`}
                        >
                          {joiningId === session.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isFull ? "Join Waiting List" : "Join Session"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}