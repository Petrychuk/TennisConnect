import { templateToDraft, type NewSessionDraft } from "@/lib/organiser-session-wizard-types";
import { toZonedDateTimeInputs } from "@/lib/timezone";
import type { SessionTemplate } from "@shared/schema";

const DEFAULT_DURATION_MINUTES = 90;

function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h, m + minutes));
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`, time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` };
}

/** The wizard draft for "template + a date and a start time". Every other setting comes from the template. */
export function buildDraftFromTemplate(template: SessionTemplate, date: string, startTime: string, now = new Date()): NewSessionDraft {
  const base = templateToDraft(template);
  const zone = base.timeZone;
  const end = addMinutes(date, startTime, template.durationMinutes || DEFAULT_DURATION_MINUTES);
  return {
    ...base,
    date,
    startTime,
    endTime: end.time,
    endDate: end.date !== date ? end.date : "",
    registrationOpens: toZonedDateTimeInputs(now, zone).date,
    registrationOpensTime: "00:00",
    registrationCloses: date,
    registrationClosesTime: startTime,
  };
}
