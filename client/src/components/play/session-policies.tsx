import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { POLICY_LABELS, hasAnyPolicy, type SessionPolicies } from "@shared/sessionPolicies";
import { parsePolicyText, splitBold } from "@/lib/formatPolicyText";
import { cn } from "@/lib/utils";

/*
  The organiser's rules and policies (Rules, Refund policy, Late arrivals,
  Cancellations) for players - Play session page and Quick View, and the
  organiser's own Format & Rules tab. Only the ones the organiser filled in;
  nothing at all when there are none.
  Source: GET /api/play/sessions/:id `policies` (shared/sessionPolicies.ts).

  Long texts are laid out as blocks (see lib/formatPolicyText.ts): a quiet
  title, numbered rules as a list, **bold** lines as sub-headings. Titles are
  never larger than the text itself. A long policy is shortened with
  "Show more" - the whole text stays in the page either way.
*/
const LONG_POLICY_CHARS = 700;

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, i) =>
        part.bold ? <strong key={i} className="font-semibold text-foreground">{part.text}</strong> : <span key={i}>{part.text}</span>,
      )}
    </>
  );
}

export function FormattedPolicyText({ text }: { text: string }) {
  const blocks = parsePolicyText(text);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground wrap-break-word">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return <p key={i} className="pt-1 text-xs font-semibold uppercase tracking-wide text-foreground">{block.text}</p>;
          case "subheading":
            return <p key={i} className="pt-1 text-sm font-semibold text-foreground">{block.text}</p>;
          case "ordered":
            return (
              <ol key={i} start={block.start} className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">
                {block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
              </ol>
            );
          case "bullets":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
                {block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
              </ul>
            );
          default:
            return <p key={i} className="whitespace-pre-line"><Inline text={block.text} /></p>;
        }
      })}
    </div>
  );
}

function PolicyBody({ text, testId }: { text: string; testId: string }) {
  const long = text.length > LONG_POLICY_CHARS;
  const [expanded, setExpanded] = useState(false);
  const clamped = long && !expanded;
  return (
    <div>
      <div className={cn("relative", clamped && "max-h-40 overflow-hidden")}>
        <FormattedPolicyText text={text} />
        {clamped && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent" aria-hidden />}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 text-xs font-medium text-primary-text hover:underline"
          data-testid={`${testId}-toggle`}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export function SessionPoliciesList({
  policies,
  compact = false,
  variant = "list",
  testId = "session-policies",
}: {
  policies: SessionPolicies | null | undefined;
  compact?: boolean;
  /** "accordion": each policy is a collapsible card (the public session page). */
  variant?: "list" | "accordion";
  testId?: string;
}) {
  if (!policies || !hasAnyPolicy(policies)) return null;
  const entries = (Object.keys(POLICY_LABELS) as (keyof SessionPolicies)[]).filter((key) => policies[key]);
  if (variant === "accordion") {
    return (
      <div className="space-y-2" data-testid={testId}>
        {entries.map((key) => (
          // Native <details>: collapsed, but the text stays in the page
          // (find-in-page, screen readers, tests reading its text).
          <details key={key} className="group rounded-2xl border border-border bg-card shadow-sm" data-testid={`${testId}-${key}`}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
              {POLICY_LABELS[key]}
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-border px-4 py-3">
              <FormattedPolicyText text={policies[key] as string} />
            </div>
          </details>
        ))}
      </div>
    );
  }
  return (
    <div className={compact ? "space-y-3" : "space-y-5"} data-testid={testId}>
      {entries.map((key) => (
        <section key={key} data-testid={`${testId}-${key}`}>
          <h3 className="mb-1 text-sm font-semibold text-foreground">{POLICY_LABELS[key]}</h3>
          <PolicyBody text={policies[key] as string} testId={`${testId}-${key}`} />
        </section>
      ))}
    </div>
  );
}
