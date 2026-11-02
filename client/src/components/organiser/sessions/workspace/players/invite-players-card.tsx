import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { publicSessionPath } from "@shared/sessionActions";

interface InvitePlayersCardProps {
  session: { id: string; status?: string | null; visibility?: string | null };
  className?: string;
}

/*
  The session's shareable link. It used to copy /sessions/:id - a page
  that doesn't exist (players landed on a 404) - and had a "QR Code"
  button that only said "isn't wired up yet" (removed: there's no QR
  feature). The link is now the real public page, /play/:id, and only
  while that page exists (published or live, and public).
*/
export function InvitePlayersCard({ session, className }: InvitePlayersCardProps) {
  const { toast } = useToast();
  const path = publicSessionPath(session);
  const link = path ? `${window.location.origin}${path}` : null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copied", description: "Anyone with the link can see the session and register." });
    } catch {
      toast({ title: "Couldn't copy the link", description: link, variant: "destructive" });
    }
  };

  return (
    <Card className={className} data-testid="organiser-invite-players-card">
      <CardHeader>
        <CardTitle asChild className="text-base"><h2>Share Session</h2></CardTitle>
        <p className="text-sm text-muted-foreground">
          {link
            ? "Send players the session's public page - they can register there."
            : session.visibility && session.visibility !== "public"
            ? "This session isn't public, so it has no shareable page. Use Invite Players instead."
            : "The shareable page appears once the session is published."}
        </p>
      </CardHeader>
      {link && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 min-w-0">
            <span className="text-sm text-muted-foreground truncate flex-1" data-testid="organiser-invite-players-link">{link}</span>
            <Button variant="ghost" size="icon" aria-label="Copy session link" className="h-9 w-9 shrink-0" onClick={copyLink} data-testid="organiser-invite-players-copy">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" className="w-full" onClick={copyLink} data-testid="organiser-invite-players-share">
            <Share2 className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
