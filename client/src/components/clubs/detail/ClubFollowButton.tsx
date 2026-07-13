import { useState } from "react";
import { useLocation } from "wouter";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

interface ClubFollowButtonProps {
  clubId: string;
  initialFollowing: boolean;
  className?: string;
}

export function ClubFollowButton({
  clubId,
  initialFollowing,
  className,
}: ClubFollowButtonProps) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const toggleFollow = async () => {
    if (!isAuthenticated) {
      setLocation("/auth");
      return;
    }

    const nextState = !following;
    setFollowing(nextState);
    setLoading(true);

    try {
      const res = await fetch(`/api/clubs/${clubId}/follow`, {
        method: nextState ? "POST" : "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Request failed");
    } catch (err) {
      console.error(err);
      setFollowing(!nextState);
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
    <Button
      type="button"
      variant={following ? "secondary" : "outline"}
      onClick={toggleFollow}
      disabled={loading}
      className={className}
      data-testid="club-follow-btn"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Heart
          className={`w-4 h-4 mr-2 ${following ? "fill-primary text-primary" : ""}`}
        />
      )}
      {following ? "Following Community" : "Add Community"}
    </Button>
  );
}
