import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

interface ClubFavoriteButtonProps {
  clubId: string;
  initialFavoriting: boolean;
  className?: string;
}

// Heart toggle for "My Courts" - deliberately separate from
// ClubFollowButton's "Follow Community" action above. A user can like
// playing somewhere without following its community, or vice versa.
export function ClubFavoriteButton({ clubId, initialFavoriting, className }: ClubFavoriteButtonProps) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [favoriting, setFavoriting] = useState(initialFavoriting);
  const [loading, setLoading] = useState(false);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      const returnTo = window.location.pathname + window.location.search;
      setLocation(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (loading) return;

    const nextState = !favoriting;
    setFavoriting(nextState);
    setLoading(true);

    try {
      const res = await fetch(`/api/clubs/${clubId}/favorite`, {
        method: nextState ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Request failed");

      // staleTime: Infinity means the profile's own "My Courts" list
      // (GET /api/me/favorited-clubs) would otherwise never refetch on
      // its own - without this, a court favourited here just wouldn't
      // show up there until something else happened to invalidate it.
      queryClient.invalidateQueries({ queryKey: ["/api/me/favorited-clubs"] });
    } catch (err) {
      console.error(err);
      setFavoriting(!nextState);
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: "Couldn't update your favorite courts. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={loading}
      aria-label={favoriting ? "Remove from My Courts" : "Add to My Courts"}
      aria-pressed={favoriting}
      className={`w-9 h-9 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors ${className ?? ""}`}
      data-testid="club-favorite-btn"
    >
      <Heart
        className={`w-5 h-5 transition-colors ${favoriting ? "fill-primary text-primary" : "text-white"}`}
      />
    </button>
  );
}
