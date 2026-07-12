export type ArticleContentBlock =
  | { type: "heading2"; text: string }
  | { type: "heading3"; text: string }
  | { type: "quote"; text: string }
  | { type: "hr" }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "image"; src: string; alt: string }
  | { type: "paragraph"; text: string };

const BLOCK_START = /^(#{2,3}\s|>\s|[-*]\s|\d+\.\s|!\[|---$|\*\*\*$)/;

/**
 * Parses the article `content` field (a plain-text field filled in via the
 * admin's textarea) into a small set of structural blocks: headings,
 * quotes, dividers, lists, images and paragraphs. Supports lightweight
 * markdown-like syntax:
 *
 *   ## Heading            -> heading2
 *   ### Heading           -> heading3
 *   **Heading** (alone)   -> heading3 (kept for older articles)
 *   > Quote text          -> quote
 *   ---  or  ***          -> divider
 *   - item / * item       -> bullet list
 *   1. item                -> numbered list
 *   ![alt](url)           -> image
 *   anything else          -> paragraph
 *
 * Inline **bold**, *italic* and [text](url) links are supported within
 * paragraphs, headings, quotes and list items via `renderInline`.
 */
export function parseArticleContent(content: string): ArticleContentBlock[] {
  const lines = (content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ArticleContentBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i++;
      continue;
    }

    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      blocks.push({ type: "image", alt: imgMatch[1], src: imgMatch[2] });
      i++;
      continue;
    }

    if (line === "---" || line === "***") {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "heading3", text: line.slice(4) });
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "heading2", text: line.slice(3) });
      i++;
      continue;
    }

    // Legacy support: a line that is entirely **bold** used to render as
    // a sub-heading in older articles — keep that behaviour.
    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      blocks.push({ type: "heading3", text: line.slice(2, -2) });
      i++;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines = [line.slice(2)];
      i++;
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items = [line.replace(/^[-*]\s/, "")];
      i++;
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items = [line.replace(/^\d+\.\s/, "")];
      i++;
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Paragraph — accumulate consecutive non-blank lines that don't start
    // a new block type.
    const paraLines = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i].trim())) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

/**
 * Splits inline text into tokens supporting **bold**, *italic* and
 * [text](url) links, in that priority order.
 */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined) {
      tokens.push({ text: match[2], italic: true });
    } else if (match[3] !== undefined) {
      tokens.push({ text: match[3], href: match[4] });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex) });
  }

  return tokens;
}
