import test from "node:test";
import assert from "node:assert/strict";
import { buildDraftFromTemplate } from "./templateQuickCreate";
import type { SessionTemplate } from "@shared/schema";

const template = {
  id: "t1", name: "Monday Social", type: "social", location: "Cahill Tennis Park", timeZone: "Australia/Sydney",
  preferredStartTime: "18:30", durationMinutes: 120, courtsCount: 2, maxParticipants: 4, plannedRoundsCount: 5,
  waitingListEnabled: true, matchMode: "doubles",
} as unknown as SessionTemplate;

test("takes the date and start time from the dialog, everything else from the template", () => {
  const d = buildDraftFromTemplate(template, "2030-03-04", "19:00", new Date("2030-03-01T00:00:00Z"));
  assert.equal(d.name, "Monday Social");
  assert.equal(d.venue, "Cahill Tennis Park");
  assert.equal(d.courtCount, 2);
  assert.equal(d.maxPlayers, 4);
  assert.equal(d.date, "2030-03-04");
  assert.equal(d.startTime, "19:00");
  assert.equal(d.endTime, "21:00");
  assert.equal(d.endDate, "");
  assert.equal(d.registrationCloses, "2030-03-04");
  assert.equal(d.registrationClosesTime, "19:00");
});

test("a session running past midnight ends on the next day", () => {
  const d = buildDraftFromTemplate(template, "2030-12-31", "23:00", new Date("2030-12-01T00:00:00Z"));
  assert.equal(d.endTime, "01:00");
  assert.equal(d.endDate, "2031-01-01");
});

test("no duration on the template falls back to 90 minutes", () => {
  const d = buildDraftFromTemplate({ ...template, durationMinutes: null } as SessionTemplate, "2030-03-04", "18:30");
  assert.equal(d.endTime, "20:00");
});
