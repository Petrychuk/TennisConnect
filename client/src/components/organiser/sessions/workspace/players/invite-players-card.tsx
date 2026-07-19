import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, QrCode, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvitePlayersCardProps {
  sessionId: string;
  className?: string;
}

export function InvitePlayersCard({ sessionId, className }: InvitePlayersCardProps) {
  const { toast } = useToast();
  const link = `https://tennisconnect.com/sessions/${sessionId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
    }
  };

  return (
    <Card className={className} data-testid="organiser-invite-players-card">
      <CardHeader>
        <CardTitle className="text-base">Invite Players</CardTitle>
        <p className="text-sm text-muted-foreground">Share the session with players to invite them.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
          <span className="text-sm text-muted-foreground truncate flex-1">{link}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyLink} data-testid="organiser-invite-players-copy">
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={copyLink} data-testid="organiser-invite-players-share">
            <Share2 className="w-4 h-4 mr-2" />
            Share Link
          </Button>
          <Button variant="outline" onClick={() => toast({ title: "QR Code isn't wired up yet" })} data-testid="organiser-invite-players-qr">
            <QrCode className="w-4 h-4 mr-2" />
            QR Code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
