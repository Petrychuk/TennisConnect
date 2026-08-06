import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users2, Heart, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Club } from "@shared/schema";

interface MyClubsSectionProps {
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  mode: "communities" | "courts";
}

const COPY = {
  communities: {
    endpoint: "/api/me/followed-clubs",
    relationEndpoint: (id: string) => `/api/clubs/${id}/follow`,
    emptyOwn: "You haven't followed any club communities yet. Find one on Club Communities and hit Follow.",
    emptyGuest: "Not following any club communities yet.",
    removeLabel: "Unfollow",
    removedToast: (name: string) => `You're no longer following ${name}.`,
    icon: Users2,
    testPrefix: "my-communities",
  },
  courts: {
    endpoint: "/api/me/favorited-clubs",
    relationEndpoint: (id: string) => `/api/clubs/${id}/favorite`,
    emptyOwn: "No favorite courts yet. Tap the heart on a club card to save it here.",
    emptyGuest: "No favorite courts yet.",
    removeLabel: "Remove",
    removedToast: (name: string) => `${name} removed from your courts.`,
    icon: Heart,
    testPrefix: "my-courts",
  },
} as const;

export function MyClubsSection({ isOwnProfile, isAuthenticated, mode }: MyClubsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const copy = COPY[mode];
  const Icon = copy.icon;

  const clubsQuery = useQuery({
    queryKey: [copy.endpoint],
    queryFn: async () => {
      const res = await fetch(copy.endpoint, { credentials: "include" });
      if (!res.ok) return [];
      return (await res.json()) as Club[];
    },
    enabled: isOwnProfile && isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <Card data-testid={`${copy.testPrefix}-signed-out`}>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-muted-foreground">
            {mode === "communities" ? "Sign in to see the communities you follow." : "Sign in to see your favorite courts."}
          </p>
          <Button asChild size="sm" data-testid={`${copy.testPrefix}-sign-in`}>
            <Link href="/auth">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isOwnProfile) {
    return (
      <Card data-testid={`${copy.testPrefix}-not-own-profile`}>
        <CardContent className="py-10 text-center text-muted-foreground">
          {mode === "communities"
            ? "This shows communities you follow, not this profile's - visit your own profile to see yours."
            : "This shows courts you've favorited, not this profile's - visit your own profile to see yours."}
        </CardContent>
      </Card>
    );
  }

  if (clubsQuery.isLoading) {
    return (
      <Card data-testid={`${copy.testPrefix}-loading`}>
        <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const clubs = clubsQuery.data ?? [];

  const handleRemove = async (club: Club) => {
    setRemovingId(club.id);
    try {
      const res = await fetch(copy.relationEndpoint(club.id), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Request failed");
      queryClient.invalidateQueries({ queryKey: [copy.endpoint] });
      toast({ title: copy.removedToast(club.name) });
    } catch (error: any) {
      toast({ title: "Couldn't update", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  if (clubs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed" data-testid={`${copy.testPrefix}-empty`}>
        <Icon className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>{copy.emptyOwn}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid={`${copy.testPrefix}-list`}>
      {clubs.map((club) => {
        const location = [club.suburb, club.state].filter(Boolean).join(", ");
        const detailHref = club.slug && club.listingType === "premium" ? `/clubs/${club.slug}` : "/clubs";
        return (
          <Card key={club.id} className="overflow-hidden" data-testid={`${copy.testPrefix}-item-${club.id}`}>
            <Link href={detailHref} className="block h-32 bg-muted overflow-hidden" data-testid={`${copy.testPrefix}-item-${club.id}-image-link`}>
              {club.image && <img src={club.image} alt="" className="w-full h-full object-cover" />}
            </Link>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={detailHref} className="font-semibold hover:underline min-w-0 truncate" data-testid={`${copy.testPrefix}-item-${club.id}-name`}>
                  {club.name}
                </Link>
                {club.listingType === "premium" && (
                  <Badge variant="secondary" className="shrink-0">
                    Premium
                  </Badge>
                )}
              </div>
              {location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {location}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleRemove(club)}
                disabled={removingId === club.id}
                data-testid={`${copy.testPrefix}-item-${club.id}-remove`}
              >
                {removingId === club.id ? "Removing..." : copy.removeLabel}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
