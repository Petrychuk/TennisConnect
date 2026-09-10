import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Layers, Plus, Copy, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSessionDivisions, createSessionDivision } from "@/lib/api/organizer-sessions";
import { NumberField } from "@/components/organiser/sessions/wizard/number-field";
import type { SessionWithDetails } from "@shared/schema";
import { formatInTimeZone } from "@/lib/timezone";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-primary/10 text-primary",
  published: "bg-primary/10 text-primary",
  live: "bg-primary text-primary-foreground",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  rejected: "bg-destructive/10 text-destructive",
};

interface DivisionsCardProps {
  sessionId: string;
}

// Every division of this event - Men's Singles A, Mixed Doubles, etc.
// Quick-create only ever asks for a title; everything else (venue,
// pricing, visibility, registration window) is inherited from this
// container, or from an existing sibling division when duplicating
// one, so setting up a full multi-division event is fast rather than
// re-running the whole 4-step wizard per division.
export function DivisionsCard({ sessionId }: DivisionsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cloneFrom, setCloneFrom] = useState<SessionWithDetails | null>(null);
  const [title, setTitle] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const divisionsQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionId, "divisions"],
    queryFn: () => getSessionDivisions(sessionId),
  });

  const openCreate = () => {
    setCloneFrom(null);
    setTitle("");
    setMaxParticipants("");
    setDialogOpen(true);
  };

  const openDuplicate = (division: SessionWithDetails) => {
    setCloneFrom(division);
    setTitle(`${division.title} (copy)`);
    setMaxParticipants(division.maxParticipants != null ? String(division.maxParticipants) : "");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createSessionDivision(sessionId, {
        title: title.trim(),
        maxParticipants: maxParticipants.trim() ? Number(maxParticipants) : undefined,
        cloneFromDivisionId: cloneFrom?.id,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", sessionId, "divisions"] });
      toast({ title: "Division added", description: "It's saved as a draft — open it to fine-tune and publish." });
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Couldn't add division", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const divisions = (divisionsQuery.data ?? []).filter((d) => d.status !== "archived");

  return (
    <Card className="shadow-sm" data-testid="organiser-session-divisions-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <div>
            <CardTitle className="text-base">Divisions</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 font-normal">
              Men's Singles A, Mixed Doubles, day two — each is its own real session, players register per division.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} data-testid="organiser-session-divisions-add">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Division
        </Button>
      </CardHeader>
      <CardContent>
        {divisions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6" data-testid="organiser-session-divisions-empty">
            No divisions yet — add one for each format or group (Singles A, Doubles, etc.).
          </p>
        ) : (
          <div className="space-y-2">
            {divisions.map((division) => (
              <div
                key={division.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
                data-testid={`organiser-session-division-${division.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{division.title}</p>
                    <Badge className={STATUS_BADGE[division.status] ?? "bg-muted text-muted-foreground"}>
                      {division.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatInTimeZone(division.startAt, division.timeZone, { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    {division.registeredCount}
                    {division.maxParticipants != null ? ` / ${division.maxParticipants}` : ""} registered
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openDuplicate(division)}
                  data-testid={`organiser-session-division-duplicate-${division.id}`}
                >
                  <Copy className="w-4 h-4 mr-1.5" />
                  Duplicate
                </Button>
                <Link href={`/organiser/sessions/${division.id}`} data-testid={`organiser-session-division-open-${division.id}`}>
                  <Button size="sm" variant="outline">
                    Open
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="organiser-session-division-dialog">
          <DialogHeader>
            <DialogTitle>{cloneFrom ? `Duplicate "${cloneFrom.title}"` : "Add Division"}</DialogTitle>
            <DialogDescription>
              {cloneFrom
                ? "Everything else — venue, pricing, dates — is copied from this division. Just give the new one a name."
                : "Everything else — venue, pricing, dates — is inherited from this event. Just give the division a name; you can fine-tune it after."}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Men's Singles - Group A"
            autoFocus
            data-testid="organiser-session-division-title-input"
          />
          {!cloneFrom && (
            <div className="flex flex-wrap gap-1.5" data-testid="organiser-session-division-suggestions">
              {["Men's Singles", "Women's Singles", "Men's Doubles", "Women's Doubles", "Mixed Doubles"].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setTitle(suggestion)}
                  className="text-xs rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  data-testid={`organiser-session-division-suggestion-${suggestion.replace(/[^a-z]/gi, "-").toLowerCase()}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-sm">Max Players (optional)</Label>
            <NumberField
              min={1}
              value={maxParticipants === "" ? NaN : Number(maxParticipants)}
              onChange={(v) => setMaxParticipants(String(v))}
              placeholder="Same as the event, unless set here"
              data-testid="organiser-session-division-max-players"
            />
            <p className="text-xs text-muted-foreground">Leave blank to use the same capacity as the event or the division being duplicated.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim() || submitting} data-testid="organiser-session-division-submit">
              {submitting ? "Adding..." : "Add Division"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
