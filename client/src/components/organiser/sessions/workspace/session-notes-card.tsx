import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateSession } from "@/lib/api/organizer-sessions";

interface SessionNotesCardProps {
  sessionId: string;
  initialNote?: string | null;
}

// Persisted via sessions.notes (PUT /sessions/:id, the same generic
// update route session-edit.tsx already uses) - previously this only
// updated local component state, so "Save" looked like it worked but
// the note was gone on the next page load.
export function SessionNotesCard({ sessionId, initialNote = null }: SessionNotesCardProps) {
  const [note, setNote] = useState(initialNote ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSession(sessionId, { notes: note || undefined });
      setIsEditing(false);
    } catch {
      toast({ title: "Couldn't save the note", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shadow-sm" data-testid="organiser-session-notes-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Session Notes</CardTitle>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs font-medium text-primary flex items-center gap-0.5"
            data-testid="organiser-session-notes-add-button"
          >
            <Plus className="w-3 h-3" />
            {note ? "Edit note" : "Add note"}
          </button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add notes about this session for your reference..."
              className="min-h-24"
              data-testid="organiser-session-notes-textarea"
            />
            <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="organiser-session-notes-save">
              {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save
            </Button>
          </div>
        ) : note ? (
          <p className="text-sm whitespace-pre-wrap" data-testid="organiser-session-notes-text">
            {note}
          </p>
        ) : (
          <div className="text-center py-6" data-testid="organiser-session-notes-empty">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium">No notes yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add notes about this session for your reference.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
