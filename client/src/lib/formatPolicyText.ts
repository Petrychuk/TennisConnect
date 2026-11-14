/*
  Organisers paste long policies (rules, refunds ...) with a title in capitals,
  numbered rules, "**bold**" lines and plain paragraphs. Shown as one block of
  text the titles were louder than the rules and nothing could be scanned.
  This turns that text into a few simple blocks. Pure - unit-tested in
  ./formatPolicyText.test.ts.
*/

export type PolicyBlock =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ordered"; start: number; items: string[] }
  | { type: "bullets"; items: string[] };

const ORDERED = /^\s*(\d{1,3})[.)]\s+(.*\S)\s*$/;
const BULLET = /^\s*[-*•]\s+(.*\S)\s*$/;
const WHOLE_BOLD = /^\s*\*\*(.+?)\*\*:?\s*$/;

/** A short line of capitals ("SESSION RULES AND PLAYER GUIDELINES") is a title. */
function isCapsTitle(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80 || !/[A-Z]/.test(t)) return false;
  return t === t.toUpperCase() && !/[.!?]$/.test(t);
}

export function parsePolicyText(text: string | null | undefined): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  const lines = (text ?? "").replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const ordered = ORDERED.exec(line);
    const bullet = BULLET.exec(line);
    const bold = WHOLE_BOLD.exec(line);
    if (ordered) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last?.type === "ordered") last.items.push(ordered[2]);
      else blocks.push({ type: "ordered", start: Number(ordered[1]), items: [ordered[2]] });
    } else if (bullet) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last?.type === "bullets") last.items.push(bullet[1]);
      else blocks.push({ type: "bullets", items: [bullet[1]] });
    } else if (bold) {
      flushParagraph();
      blocks.push({ type: "subheading", text: bold[1].trim() });
    } else if (isCapsTitle(line)) {
      flushParagraph();
      blocks.push({ type: "heading", text: line.trim() });
    } else {
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  return blocks;
}

/** Splits "a **b** c" into plain and bold runs. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts.length ? parts : [{ text, bold: false }];
}
