import { useState } from "react";
import { CalendarX2, ChevronDown, Clock, RefreshCw, ShieldCheck, type LucideIcon } from "lucide-react";
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

const POLICY_ICONS: Record<keyof SessionPolicies, LucideIcon> = {
  rules: ShieldCheck,
  refund: RefreshCw,
  lateArrival: Clock,
  cancellation: CalendarX2,
};

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
    <div className="space-y-2.5 text-sm leading-relaxed text-foreground/80 wrap-break-word">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return <p key={i} className="pt-1 text-sm font-bold text-foreground">{block.text}</p>;
          case "subheading":
            return <p key={i} className="pt-1 text-sm font-bold text-foreground">{block.text}</p>;
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
          <details key={key} className="group rounded-2xl border border-border bg-card" data-testid={`${testId}-${key}`}>
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              {(() => {
                const Icon = POLICY_ICONS[key];
                return <Icon className="h-5 w-5 shrink-0 text-primary-text" aria-hidden />;
              })()}
              <span className="flex-1">{POLICY_LABELS[key]}</span>
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
    <div className={cn("divide-y divide-border", compact ? "[&>section]:py-3" : "[&>section]:py-4")} data-testid={testId}>
      {entries.map((key) => (
        <section key={key} className="first:pt-0 last:pb-0" data-testid={`${testId}-${key}`}>
          <h3 className={cn("mb-2 flex items-center gap-2 font-bold text-foreground", compact ? "text-sm" : "text-base")}>
            {(() => {
              const Icon = POLICY_ICONS[key];
              return <Icon className="h-4 w-4 shrink-0 text-primary-text" aria-hidden />;
            })()}
            {POLICY_LABELS[key]}
          </h3>
          <PolicyBody text={policies[key] as string} testId={`${testId}-${key}`} />
        </section>
      ))}
    </div>
  );
}
