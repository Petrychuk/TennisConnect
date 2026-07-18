import { Plus, Trash2 } from "lucide-react";
import type { ClubFormData } from "../ClubForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClubSession } from "@shared/schema";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface ClubSessionsSectionProps {
  form: ClubFormData;
  updateField: <K extends keyof ClubFormData>(
    key: K,
    value: ClubFormData[K]
  ) => void;
}

function makeId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ClubSessionsSection({
  form,
  updateField,
}: ClubSessionsSectionProps) {
  const sessions = form.sessions || [];
  const canAddMore = sessions.length < 7;

  const updateSession = (
    id: string,
    patch: Partial<ClubSession>
  ) => {
    updateField(
      "sessions",
      sessions.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const addSession = () => {
    if (!canAddMore) return;
    const next: ClubSession = {
      id: makeId(),
      day: "Monday",
      name: "Social Tennis",
      startTime: "18:00",
      endTime: "19:30",
      price: undefined,
      level: "All Levels",
    };
    updateField("sessions", [...sessions, next]);
  };

  const removeSession = (id: string) => {
    updateField(
      "sessions",
      sessions.filter((s) => s.id !== id)
    );
  };

  return (
    <section className="space-y-6" data-testid="club-sessions-section">
      <div>
        <h2 className="text-2xl font-display font-semibold">
          Weekly Sessions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add up to 7 recurring sessions (one per day of the week). These
          power the "Upcoming Sessions" block on the community premium
          page. Leave empty to fall back to your weekly social tennis
          days instead.
        </p>
      </div>

      <div className="space-y-4">
        {sessions.map((session, i) => (
          <div
            key={session.id}
            className="rounded-2xl border p-4 space-y-4"
            data-testid={`club-session-row-${i}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Session {i + 1}</p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => removeSession(session.id)}
                data-testid={`club-session-remove-${i}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Session Name</Label>
                <Input
                  value={session.name}
                  placeholder="e.g. Thursday Social Hit"
                  onChange={(e) =>
                    updateSession(session.id, { name: e.target.value })
                  }
                  data-testid={`club-session-name-${i}`}
                />
              </div>

              <div className="space-y-2">
                <Label>Day</Label>
                <select
                  value={session.day}
                  onChange={(e) =>
                    updateSession(session.id, { day: e.target.value })
                  }
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  data-testid={`club-session-day-${i}`}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={session.startTime}
                  onChange={(e) =>
                    updateSession(session.id, { startTime: e.target.value })
                  }
                  data-testid={`club-session-start-${i}`}
                />
              </div>

              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={session.endTime}
                  onChange={(e) =>
                    updateSession(session.id, { endTime: e.target.value })
                  }
                  data-testid={`club-session-end-${i}`}
                />
              </div>

              <div className="space-y-2">
                <Label>Price (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="18"
                  value={session.price ?? ""}
                  onChange={(e) =>
                    updateSession(session.id, {
                      price: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  data-testid={`club-session-price-${i}`}
                />
              </div>

              <div className="space-y-2">
                <Label>Level (optional)</Label>
                <Input
                  placeholder="e.g. All Levels, Intermediate"
                  value={session.level ?? ""}
                  onChange={(e) =>
                    updateSession(session.id, { level: e.target.value })
                  }
                  data-testid={`club-session-level-${i}`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addSession}
        disabled={!canAddMore}
        data-testid="club-session-add-btn"
      >
        <Plus className="w-4 h-4 mr-2" />
        {canAddMore ? "Add Session" : "Maximum 7 sessions"}
      </Button>
    </section>
  );
}
