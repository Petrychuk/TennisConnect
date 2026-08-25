import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { bucketFor } from "./session-utils";
import { toZonedDateTimeInputs } from "@/lib/timezone";

// Plain "YYYY-MM-DD" for a calendar grid cell (no timezone conversion -
// `day` here is already just a calendar-day marker for navigating
// months, not tied to any instant) - kept separate from
// toZonedDateTimeInputs's date output only so the two call sites read
// clearly for what they each are, even though the format matches.
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const BUCKET_DOT: Record<string, string> = {
  live: "bg-primary",
  "registration-open": "bg-primary/70",
  upcoming: "bg-muted-foreground/50",
  draft: "bg-muted-foreground/30",
  completed: "bg-muted-foreground/30",
  archived: "bg-muted-foreground/20",
};

interface SessionsCalendarViewProps {
  sessions: SessionListItem[];
}

export function SessionsCalendarView({ sessions }: SessionsCalendarViewProps) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, SessionListItem[]>();
    for (const s of sessions) {
      // The venue's own calendar day, not the viewer's - a Sydney 11pm
      // session shouldn't land on the wrong grid cell just because
      // whoever's looking at this calendar is in a different timezone.
      const key = toZonedDateTimeInputs(s.startAt, s.timeZone).date;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [sessions]);

  const weeks = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sunday
    const gridStart = new Date(year, month, 1 - startOffset);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
    }
    const rows: Date[][] = [];
    for (let i = 0; i < 6; i++) rows.push(days.slice(i * 7, i * 7 + 7));
    return rows;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = dayKey(new Date());

  return (
    <div className="space-y-3" data-testid="organiser-sessions-calendar">
      <div className="flex items-center justify-between">
        <p className="font-display font-bold text-lg">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth(), 1))}
            data-testid="organiser-sessions-calendar-today"
          >
            Today
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            data-testid="organiser-sessions-calendar-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            data-testid="organiser-sessions-calendar-next"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/40 text-xs font-medium text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((day, i) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const daySessions = byDay.get(dayKey(day)) ?? [];
            const isToday = dayKey(day) === today;
            return (
              <div
                key={i}
                className={`min-h-[92px] border-t border-l border-border p-1.5 ${i % 7 === 6 ? "" : ""} ${
                  inMonth ? "" : "bg-muted/20"
                }`}
                data-testid={`organiser-sessions-calendar-day-${day.toISOString().split("T")[0]}`}
              >
                <span
                  className={`text-xs inline-flex items-center justify-center w-5 h-5 rounded-full ${
                    isToday ? "bg-primary text-primary-foreground font-semibold" : inMonth ? "text-foreground" : "text-muted-foreground/50"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {daySessions.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      href={`/organiser/sessions/${s.id}`}
                      className="flex items-center gap-1 text-[11px] leading-tight rounded px-1 py-0.5 hover:bg-accent/60 truncate"
                      data-testid={`organiser-sessions-calendar-item-${s.id}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${BUCKET_DOT[bucketFor(s)]}`} />
                      <span className="truncate">{s.title}</span>
                    </Link>
                  ))}
                  {daySessions.length > 3 && (
                    <p className="text-[10px] text-muted-foreground px-1">+{daySessions.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
