interface FormattedTextProps {
  text?: string | null;
  testId?: string;
}

/**
 * Splits raw description text into paragraphs so the About block reads
 * like formatted copy instead of one dense wall of text. Splits on blank
 * lines first (real paragraph breaks); falls back to single line breaks
 * if the text has no blank lines at all.
 */
export function FormattedText({ text, testId }: FormattedTextProps) {
  if (!text) return null;

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks = paragraphs.length > 0 ? paragraphs : [text.trim()];

  return (
    <div
      className="space-y-3 text-muted-foreground leading-relaxed"
      data-testid={testId}
    >
      {blocks.map((paragraph, i) => (
        <p key={i} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
