import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, CloudRain, MapPinned, Image as ImageIcon, Send } from "lucide-react";

interface SessionUpdate {
  id: string;
  kind: "general" | "rain" | "court-change" | "photos";
  message: string;
  timestamp: string;
}

const KIND_ICON: Record<SessionUpdate["kind"], typeof Megaphone> = {
  general: Megaphone,
  rain: CloudRain,
  "court-change": MapPinned,
  photos: ImageIcon,
};

const initialUpdates: SessionUpdate[] = [
  { id: "u-1", kind: "general", message: "Session Updates will show up here — registration reminders, changes, anything worth a heads-up.", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: "u-2", kind: "rain", message: "Light rain expected around 7pm — courts are covered, session is still on.", timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
  { id: "u-3", kind: "court-change", message: "Court 3 is closed for maintenance — moved to Court 7 for this session.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
];

// This is the session's own update feed, not a general inbox — every
// registered player sees these, per the brief. Posting is local-state
// only (no backend yet) but genuinely appends, rather than being a
// static mock.
export function MessagesTab() {
  const [updates, setUpdates] = useState(initialUpdates);
  const [draft, setDraft] = useState("");

  const handlePost = () => {
    if (!draft.trim()) return;
    setUpdates((prev) => [
      { id: `u-${Date.now()}`, kind: "general", message: draft.trim(), timestamp: new Date().toISOString() },
      ...prev,
    ]);
    setDraft("");
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
          <Button onClick={handlePost} disabled={!draft.trim()} className="ml-auto flex" data-testid="organiser-session-messages-post">
            <Send className="w-4 h-4 mr-2" />
            Post Update
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {updates.map((update) => {
          const Icon = KIND_ICON[update.kind];
          return (
            <Card key={update.id} className="shadow-sm" data-testid={`organiser-session-message-${update.id}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm">{update.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(update.timestamp).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
