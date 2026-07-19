import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus } from "lucide-react";

interface SessionNotesCardProps {
  initialNote?: string | null;
}

// Local-state only for now (no backend for notes yet) - but genuinely
// editable rather than a static mock, since a note only an organiser can
// see is cheap to make real even before the API exists.
export function SessionNotesCard({ initialNote = null }: SessionNotesCardProps) {
  const [note, setNote] = useState(initialNote ?? "");
  const [isEditing, setIsEditing] = useState(false);

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
            <Button size="sm" onClick={() => setIsEditing(false)} data-testid="organiser-session-notes-save">
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
