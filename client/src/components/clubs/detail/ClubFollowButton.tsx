import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

interface ClubFollowButtonProps {
  clubId: string;
  initialFollowing: boolean;
  initialFollowersCount?: number;
  /** Use on dark/photo backgrounds (overlay hero) vs default card backgrounds */
  light?: boolean;
  className?: string;
}

export function ClubFollowButton({
  clubId,
  initialFollowing,
  initialFollowersCount = 0,
  light = false,
  className,
}: ClubFollowButtonProps) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialFollowersCount);
  const [loading, setLoading] = useState(false);

  const toggleFollow = async () => {
    if (!isAuthenticated) {
      const returnTo = window.location.pathname + window.location.search;
      setLocation(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    const nextState = !following;
    setFollowing(nextState);
    setCount((c) => Math.max(0, c + (nextState ? 1 : -1)));
    setLoading(true);

    try {
      const res = await fetch(`/api/clubs/${clubId}/follow`, {
        method: nextState ? "POST" : "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Request failed");

      // staleTime: Infinity means the profile's own "Communities" list
      // (GET /api/me/followed-clubs) would otherwise never refetch on
      // its own - without this, a club followed here just wouldn't
      // show up there until something else happened to invalidate it.
      queryClient.invalidateQueries({ queryKey: ["/api/me/followed-clubs"] });
    } catch (err) {
      console.error(err);
      setFollowing(!nextState);
      setCount((c) => Math.max(0, c - (nextState ? 1 : -1)));
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: "Couldn't update your follow status. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      <Button
        type="button"
        onClick={toggleFollow}
        disabled={loading}
        className={`rounded-full font-bold gap-1.5 cursor-pointer ${
          following
            ? light
              ? "bg-white/15 text-white border border-white/30 hover:bg-white/25"
              : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        } ${className ?? ""}`}
        data-testid="club-follow-btn"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : following ? (
          <Check className="w-4 h-4" />
        ) : (
          <Heart className="w-4 h-4" />
        )}
        {following ? "Following" : "Follow Community"}
      </Button>

      {count > 0 && (
        <span
          className={`text-sm font-medium ${
            light ? "text-white/85" : "text-muted-foreground"
          }`}
          data-testid="club-followers-count"
        >
          <strong className={light ? "text-white" : "text-foreground"}>
            {count}
          </strong>{" "}
          following
        </span>
      )}
    </div>
  );
}
