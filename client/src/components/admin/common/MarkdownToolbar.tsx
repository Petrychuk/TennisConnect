import { RefObject } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}

interface ToolAction {
  icon: React.ReactNode;
  label: string;
  apply: (selected: string) => { text: string; cursorOffset?: number };
  /** Insert on its own line (headings, lists, quotes, dividers) */
  block?: boolean;
}

const TOOLS: ToolAction[] = [
  {
    icon: <Bold className="w-4 h-4" />,
    label: "Bold",
    apply: (s) => ({ text: `**${s || "bold text"}**` }),
  },
  {
    icon: <Italic className="w-4 h-4" />,
    label: "Italic",
    apply: (s) => ({ text: `*${s || "italic text"}*` }),
  },
  {
    icon: <Heading2 className="w-4 h-4" />,
    label: "Heading",
    apply: (s) => ({ text: `## ${s || "Heading"}` }),
    block: true,
  },
  {
    icon: <Heading3 className="w-4 h-4" />,
    label: "Subheading",
    apply: (s) => ({ text: `### ${s || "Subheading"}` }),
    block: true,
  },
  {
    icon: <List className="w-4 h-4" />,
    label: "Bullet list",
    apply: (s) => ({
      text: s
        ? s
            .split("\n")
            .map((line) => `- ${line}`)
            .join("\n")
        : "- List item",
    }),
    block: true,
  },
  {
    icon: <ListOrdered className="w-4 h-4" />,
    label: "Numbered list",
    apply: (s) => ({
      text: s
        ? s
            .split("\n")
            .map((line, i) => `${i + 1}. ${line}`)
            .join("\n")
        : "1. List item",
    }),
    block: true,
  },
  {
    icon: <Quote className="w-4 h-4" />,
    label: "Quote",
    apply: (s) => ({ text: `> ${s || "Quote"}` }),
    block: true,
  },
  {
    icon: <Minus className="w-4 h-4" />,
    label: "Divider",
    apply: () => ({ text: "---" }),
    block: true,
  },
  {
    icon: <Link2 className="w-4 h-4" />,
    label: "Link",
    apply: (s) => ({ text: `[${s || "link text"}](https://)` }),
  },
];

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
}: MarkdownToolbarProps) {
  const runTool = (tool: ToolAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const selected = value.slice(start, end);

    const { text } = tool.apply(selected);

    const needsLeadingNewline =
      tool.block && start > 0 && value[start - 1] !== "\n";
    const needsTrailingNewline =
      tool.block && end < value.length && value[end] !== "\n";

    const insertion =
      (needsLeadingNewline ? "\n" : "") +
      text +
      (needsTrailingNewline ? "\n" : "");

    const nextValue = value.slice(0, start) + insertion + value.slice(end);
    onChange(nextValue);

    // Restore focus + a sensible cursor position after React re-renders
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + insertion.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-input bg-muted/40 p-1.5"
      data-testid="markdown-toolbar"
    >
      {TOOLS.map((tool) => (
        <Button
          key={tool.label}
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-pointer"
          title={tool.label}
          onClick={() => runTool(tool)}
          data-testid={`markdown-toolbar-${tool.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {tool.icon}
        </Button>
      ))}
    </div>
  );
}
