import assert from "node:assert/strict";
import test from "node:test";
import { policyColumns, readSessionPolicies, splitLegacyDescription } from "./sessionPolicies";

// Exactly what the wizard used to write (formatSummary + policy paragraphs).
const LEGACY =
  "Format: Doubles · Games to 6 · 5 rounds\n\n" +
  "Rules: Bring your own racquet.\n\nArrive 10 minutes early.\n\n" +
  "Refund Policy: Full refund up to 48 hours before.\n\n" +
  "Cancellations: Cancel from My Sessions.";

test("legacy description: policy paragraphs are split out, multi-paragraph rules stay whole", () => {
  const { description, policies } = splitLegacyDescription(LEGACY);
  assert.equal(description, "Format: Doubles · Games to 6 · 5 rounds");
  assert.deepEqual(policies, {
    rules: "Bring your own racquet.\n\nArrive 10 minutes early.",
    refund: "Full refund up to 48 hours before.",
    lateArrival: null,
    cancellation: "Cancel from My Sessions.",
  });
});

test("columns win over the description; the description is then left as it is", () => {
  const read = readSessionPolicies({ description: LEGACY, rulesText: "New rules", refundPolicy: " ", latePolicy: null, cancellationPolicy: null });
  assert.equal(read.policies.rules, "New rules");
  assert.equal(read.policies.refund, null, "blank counts as empty");
  assert.equal(read.description, LEGACY.trim());
});

test("no policies anywhere: description unchanged, every policy null", () => {
  const read = readSessionPolicies({ description: "Social hit, all welcome.\n\nBYO balls." });
  assert.equal(read.description, "Social hit, all welcome.\n\nBYO balls.");
  assert.deepEqual(read.policies, { rules: null, refund: null, lateArrival: null, cancellation: null });
  assert.deepEqual(readSessionPolicies({}).policies, { rules: null, refund: null, lateArrival: null, cancellation: null });
});

test("a paragraph that merely mentions 'Rules:' mid-text is not a policy", () => {
  const read = readSessionPolicies({ description: "Fun night. House Rules: be kind." });
  assert.equal(read.policies.rules, null);
});

test("saving: trimmed text, empty -> null", () => {
  assert.deepEqual(policyColumns({ rules: "  A  ", refund: "", lateArrival: null, cancellation: "C" }), {
    rulesText: "A",
    refundPolicy: null,
    latePolicy: null,
    cancellationPolicy: "C",
  });
});
