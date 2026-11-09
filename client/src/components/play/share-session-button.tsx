import { Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

/*
  Share a session's permanent link (/play/:id). Phones get the system share
  sheet; elsewhere a small menu: copy the link, Facebook, WhatsApp. The page's
  own title/description/image make the preview (SEO component).
*/
export function ShareSessionButton({ url, title, className }: { url: string; title: string; className?: string }) {
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Paste it anywhere to share this session." });
    } catch {
      toast({ title: "Couldn't copy the link", description: url, variant: "destructive" });
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function" && window.matchMedia?.("(pointer: coarse)").matches;
  const label = (
    <>
      <Share2 className="h-4 w-4" aria-hidden />
      <span className="sr-only sm:not-sr-only sm:ml-1.5">Share</span>
    </>
  );

  if (canNativeShare) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={className}
        onClick={() => navigator.share({ title, url }).catch(() => {})}
        data-testid="play-session-share"
      >
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className={className} data-testid="play-session-share">
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={copy} data-testid="play-session-share-copy">
          <Link2 className="mr-2 h-4 w-4" /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-testid="play-session-share-facebook">
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
            Share on Facebook
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-testid="play-session-share-whatsapp">
          <a href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer">
            Share on WhatsApp
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
