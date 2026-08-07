import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

interface ClubSaveButtonProps {
  clubId: string;
  /** Premium clubs are communities (Follow -> "Communities" tab); everything else is a court venue (Favorite -> "My Courts" tab). The button itself decides which endpoint to use from this alone - the person doesn't need to know or care which relationship it is. */
  isPremium: boolean;
  initialSaved: boolean;
  initialFollowersCount?: number;
  variant?: "icon" | "button";
  /** "button" variant only - use on dark/photo backgrounds (overlay hero) vs default card backgrounds */
  light?: boolean;
  className?: string;
}

export function ClubSaveButton({
  clubId,
  isPremium,
  initialSaved,
  initialFollowersCount = 0,
  variant = "button",
  light = false,
  className,
}: ClubSaveButtonProps) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(initialFollowersCount);
  const [loading, setLoading] = useState(false);

  const endpoint = isPremium ? "follow" : "favorite";
  const invalidateKey = isPremium ? "/api/me/followed-clubs" : "/api/me/favorited-clubs";

  const toggleSaved = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!isAuthenticated) {
      const returnTo = window.location.pathname + window.location.search;
      setLocation(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (loading) return;

    const nextState = !saved;
    setSaved(nextState);
    setCount((c) => Math.max(0, c + (nextState ? 1 : -1)));
    setLoading(true);

    try {
      const res = await fetch(`/api/clubs/${clubId}/${endpoint}`, {
        method: nextState ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Request failed");

      // staleTime: Infinity means the profile's own list wouldn't
      // otherwise refetch on its own once fetched.
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
    } catch (err) {
      console.error(err);
      setSaved(!nextState);
      setCount((c) => Math.max(0, c - (nextState ? 1 : -1)));
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: isPremium ? "Couldn't update your follow status. Please try again." : "Couldn't update your favorite courts. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggleSaved}
        disabled={loading}
        aria-label={saved ? (isPremium ? "Unfollow this community" : "Remove from My Courts") : isPremium ? "Follow this community" : "Add to My Courts"}
        aria-pressed={saved}
        className={`w-9 h-9 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors ${className ?? ""}`}
        data-testid="club-save-btn"
      >
        <Heart className={`w-5 h-5 transition-colors ${saved ? "fill-primary text-primary" : "text-white"}`} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <Button
        type="button"
        onClick={() => toggleSaved()}
        disabled={loading}
        className={`rounded-full font-bold gap-1.5 cursor-pointer ${
          saved
            ? light
              ? "bg-white/15 text-white border border-white/30 hover:bg-white/25"
              : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        } ${className ?? ""}`}
        data-testid="club-save-btn"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : saved ? (
          <Check className="w-4 h-4" />
        ) : (
          <Heart className="w-4 h-4" />
        )}
        {isPremium ? (saved ? "Following" : "Follow Community") : saved ? "Saved" : "Save Court"}
      </Button>

      {isPremium && count > 0 && (
        <span className={`text-sm font-medium ${light ? "text-white/85" : "text-muted-foreground"}`} data-testid="club-followers-count">
          <strong className={light ? "text-white" : "text-foreground"}>{count}</strong> following
        </span>
      )}
    </div>
  );
}
