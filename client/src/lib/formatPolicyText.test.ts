import test from "node:test";
import assert from "node:assert/strict";
import { parsePolicyText, splitBold } from "./formatPolicyText";

test("a capitals title, numbered rules and paragraphs become separate blocks", () => {
  const blocks = parsePolicyText("SESSION RULES AND PLAYER GUIDELINES\n\n1. Arrive early.\n2. Wear court shoes.\n\nThank you for helping us!");
  assert.deepEqual(blocks, [
    { type: "heading", text: "SESSION RULES AND PLAYER GUIDELINES" },
    { type: "ordered", start: 1, items: ["Arrive early.", "Wear court shoes."] },
    { type: "paragraph", text: "Thank you for helping us!" },
  ]);
});

test("a whole-line **bold** is a subheading, bullets are grouped", () => {
  const blocks = parsePolicyText("**Cancellation more than 48 hours before the session:**\nPlayers may request a full refund.\n- one\n- two");
  assert.deepEqual(blocks, [
    { type: "subheading", text: "Cancellation more than 48 hours before the session:" },
    { type: "paragraph", text: "Players may request a full refund." },
    { type: "bullets", items: ["one", "two"] },
  ]);
});

test("a sentence in capitals that ends with a full stop is not a title", () => {
  assert.equal(parsePolicyText("NO REFUNDS WITHIN 24 HOURS.")[0].type, "paragraph");
});

test("inline bold is split out", () => {
  assert.deepEqual(splitBold("a **b** c"), [
    { text: "a ", bold: false },
    { text: "b", bold: true },
    { text: " c", bold: false },
  ]);
});

test("empty text gives no blocks", () => {
  assert.deepEqual(parsePolicyText(null), []);
});
