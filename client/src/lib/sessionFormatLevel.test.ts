import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyDraft,
  draftToInsertSession,
  draftToTemplateConfig,
  isMixedSession,
  sessionFormatLabel,
  templateToDraft,
} from "./organiser-session-wizard-types";
import type { SessionTemplate } from "@shared/schema";

test("Mixed Doubles is saved as doubles + category mixed, and read back as Mixed", () => {
  const draft = { ...createEmptyDraft(), type: "social" as const, matchType: "mixed" as const, category: "mens" as const };
  const row = draftToInsertSession(draft) as Record<string, unknown>;
  assert.equal(row.matchMode, "doubles");
  assert.equal(row.category, "mixed");
  assert.equal(sessionFormatLabel({ matchMode: "doubles", category: "mixed" }), "Mixed Doubles");
  assert.equal(draftToTemplateConfig(draft, "T").category, "mixed");
});

test("older sessions marked only by the description prefix still count as Mixed", () => {
  assert.equal(isMixedSession({ category: "open", description: "Format: Mixed Doubles · Games to 4" }), true);
  assert.equal(isMixedSession({ category: "open", description: "Format: Doubles" }), false);
});

test("format labels", () => {
  assert.equal(sessionFormatLabel({ matchMode: "singles", category: "womens" }), "Women's Singles");
  assert.equal(sessionFormatLabel({ matchMode: "doubles", category: "open" }), "Doubles");
  assert.equal(sessionFormatLabel({ matchMode: null }), null);
});

test("player level: saved when chosen, omitted for all levels, carried by templates", () => {
  const base = { ...createEmptyDraft(), type: "social" as const };
  assert.equal((draftToInsertSession({ ...base, skillLevel: "Intermediate" }) as Record<string, unknown>).skillLevel, "Intermediate");
  assert.equal((draftToInsertSession(base) as Record<string, unknown>).skillLevel, undefined);
  assert.equal(draftToTemplateConfig({ ...base, skillLevel: "Advanced" }, "T").skillLevel, "Advanced");
  const fromTemplate = templateToDraft({ name: "T", type: "social", matchMode: "doubles", category: "mixed", skillLevel: "Beginner" } as unknown as SessionTemplate);
  assert.equal(fromTemplate.matchType, "mixed");
  assert.equal(fromTemplate.category, "open");
  assert.equal(fromTemplate.skillLevel, "Beginner");
});
