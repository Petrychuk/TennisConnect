import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarDays, ExternalLink, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";

import { getMyPlayers } from "@/lib/api/organizer-sessions";
import { toOrgPlayers } from "@/lib/api/session-adapter";

const LEVEL_BADGE_STYLE: Record<string, string> = {
  Advanced: "bg-primary/10 text-primary",
  Intermediate: "bg-secondary text-secondary-foreground",
  Social: "bg-muted text-muted-foreground",
  Beginner: "bg-accent text-accent-foreground",
};

// Deliberately only shows what's actually real for an org-wide player
// today: level, sessions played, last played, status - see
// OrgPlayerRow's own comment in shared/schema.ts on why win/loss and a
// numeric rating aren't derivable from registration data alone at
// this scope. No Participation %/Results/Season Points/Recent Sessions
// sections here - those would need real per-player-across-the-org
// attendance and match-result aggregation that doesn't exist yet, and
// showing invented numbers would be worse than not showing a section
// at all. Groups isn't shown either - that's a real object to build
// (Phase 2), not something to fake with a placeholder here.
//
// No dedicated GET-by-slug route exists - list + find is the simplest
// correct option (an organiser's player list is rarely huge) rather
// than adding a new endpoint just for this one page, same reasoning
// already used for the session-template edit page.
export default function OrganiserPlayerDetailsPage() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/players/:slug");
  const slug = params?.slug;

  const myPlayersQuery = useQuery({
    queryKey: ["/api/organizer/players/mine"],
    queryFn: getMyPlayers,
    enabled: isAuthenticated,
  });
  const allPlayers = toOrgPlayers(myPlayersQuery.data ?? []);
  const player = allPlayers.find((p) => p.slug === slug);

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardHeader>
            <CardTitle asChild><h1>Organiser access required</h1></CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            You need to be an approved organiser to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (myPlayersQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <TennisBallSpinner />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4">
        <p className="text-muted-foreground">Player not found.</p>
        <Button asChild variant="outline">
          <Link href="/organiser/players">Back to Players</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="organiser-player-details-page">
      <SEO title={`${player.name} | Players | TennisConnect`} description={`Player details for ${player.name}.`} noIndex />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link
          href="/organiser/players"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="organiser-player-details-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Players
        </Link>

        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border">
            <AvatarImage src={player.avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {player.name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-2xl font-bold">{player.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{player.level.toFixed(1)}</span>
              <Badge className={LEVEL_BADGE_STYLE[player.levelLabel]}>{player.levelLabel}</Badge>
              <Badge className={player.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                {player.status === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild data-testid="organiser-player-details-message">
            <Link href="/organiser/messages">
              <MessageSquare className="w-4 h-4 mr-2" />
              Message
            </Link>
          </Button>
          <Button variant="outline" asChild data-testid="organiser-player-details-public-profile">
            <Link href={`/player/${player.slug}`}>
              <ExternalLink className="w-4 h-4 mr-2" />
              View Public Profile
            </Link>
          </Button>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Participation</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold" data-testid="organiser-player-details-sessions">{player.sessionsPlayed}</p>
              <p className="text-xs text-muted-foreground">Sessions Played</p>
            </div>
            <div>
              <p className="text-2xl font-bold flex items-center gap-1.5" data-testid="organiser-player-details-lastplayed">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                {new Date(player.lastPlayed).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </p>
              <p className="text-xs text-muted-foreground">Last Played</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
