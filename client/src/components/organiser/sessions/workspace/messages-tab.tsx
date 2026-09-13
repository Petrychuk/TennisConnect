import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { broadcastToSession, getSessionUpdates } from "@/lib/api/organizer-sessions";
import { formatInTimeZone } from "@/lib/timezone";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";

interface MessagesTabProps {
  session: SessionListItem;
}

// This is the session's own update feed - posting here sends a real
// message (via the same messaging system every other real
// notification in this app already uses) to everyone currently
// registered for the session. The history below reads from a real
// session_updates table (one row per broadcast, written alongside the
// per-recipient messages themselves) - it survives a page refresh or
// a fresh deploy now, unlike the local-only list this used to keep.
export function MessagesTab({ session }: MessagesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const updatesQuery = useQuery({
    queryKey: ["/api/organizer/sessions", session.id, "updates"],
    queryFn: () => getSessionUpdates(session.id),
  });
  const updates = updatesQuery.data ?? [];

  const handlePost = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const { sentTo } = await broadcastToSession(session.id, draft.trim());
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id, "updates"] });
      toast({
        title: sentTo > 0 ? "Update sent" : "Nothing to send yet",
        description:
          sentTo > 0
            ? `Delivered to ${sentTo} registered player${sentTo === 1 ? "" : "s"}.`
            : "No one is registered for this session yet.",
      });
      setDraft("");
    } catch (error: any) {
      toast({ title: "Couldn't send update", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="organiser-session-messages-tab">
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Post an update to everyone registered for this session..."
            className="min-h-20"
            data-testid="organiser-session-messages-draft"
          />
          <Button onClick={handlePost} disabled={!draft.trim() || sending} className="ml-auto flex" data-testid="organiser-session-messages-post">
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Sending..." : "Post Update"}
          </Button>
        </CardContent>
      </Card>

      {!updatesQuery.isLoading && updates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8" data-testid="organiser-session-messages-empty">
          Updates you post here go straight to every registered player's inbox.
        </p>
      ) : (
        <div className="space-y-3">
          {updates.map((update) => (
            <Card key={update.id} className="shadow-sm" data-testid={`organiser-session-message-${update.id}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm">{update.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatInTimeZone(update.createdAt, session.timeZone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" · "}Sent to {update.sentTo} player{update.sentTo === 1 ? "" : "s"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
