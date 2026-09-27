import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { quickMessageSchema } from "@/lib/validations/messages";
import { Send } from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";

interface QuickMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: { id: string; name: string; type?: "player" | "coach" };
  /** Prefills the textarea - e.g. an "Invite to Play" template. */
  defaultMessage?: string;
  /** Overrides the dialog title/description for an "invite" framing vs a plain message. */
  title?: string;
  description?: string;
  /** Set to "play_invite" for an actual Invite to Play (spec [PLAY]
      Players Looking to Play, section 10) - tags the sent message so
      the recipient sees Accept/Decline actions on it, instead of it
      being an ordinary message. Omitted (the default) for a plain
      "Message" send. */
  messageType?: "play_invite";
}

// Same request shape and flow as the Players listing page's own message
// modal (client/src/pages/partners.tsx) - real POST /api/messages, not a
// mock. Extracted here so the player profile page (and anywhere else that
// needs a quick "message this person" action - the profile's "Invite to
// Play" button reuses this too, just with a prefilled template) doesn't
// need its own separate contact form/tab.
export function QuickMessageModal({
  open,
  onOpenChange,
  recipient,
  defaultMessage = "",
  title = "Send Message",
  description,
  messageType,
}: QuickMessageModalProps) {
  const [messageText, setMessageText] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setMessageText(defaultMessage);
    }
  };

  const handleSend = async () => {
    const validation = quickMessageSchema.safeParse({ content: messageText });
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipientId: recipient.id,
          recipientType: recipient.type ?? "player",
          content: messageText,
          ...(messageType ? { messageType } : {}),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to send message");
      }

      toast({
        title: messageType === "play_invite" ? "Invite sent!" : "Message sent!",
        description:
          messageType === "play_invite"
            ? `Your invite has been sent to ${recipient.name}.`
            : `Your message has been sent to ${recipient.name}.`,
      });
      (window as any).gtag?.("event", messageType === "play_invite" ? "play_player_invite_sent" : "send_message", { context: "quick_message_modal" });

      handleOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="quick-message-modal">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? `Send a message to ${recipient.name}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="quick-message-content">Your message *</Label>
            <Textarea
              id="quick-message-content"
              placeholder="Hi! I'd love to play a match together..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="min-h-[120px]"
              data-testid="input-quick-message"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSend}
            disabled={sending || !messageText.trim()}
            data-testid="button-send-quick-message"
          >
            {sending ? <TennisBallSpinner className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
