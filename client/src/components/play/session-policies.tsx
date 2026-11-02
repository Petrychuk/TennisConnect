import { POLICY_LABELS, hasAnyPolicy, type SessionPolicies } from "@shared/sessionPolicies";

/*
  The organiser's rules and policies (Rules, Refund policy, Late arrivals,
  Cancellations) for players - Play session page and Quick View. Only the
  ones the organiser filled in; nothing at all when there are none.
  Source: GET /api/play/sessions/:id `policies` (shared/sessionPolicies.ts).
*/
export function SessionPoliciesList({ policies, compact = false, testId = "session-policies" }: { policies: SessionPolicies | null | undefined; compact?: boolean; testId?: string }) {
  if (!policies || !hasAnyPolicy(policies)) return null;
  const entries = (Object.keys(POLICY_LABELS) as (keyof SessionPolicies)[]).filter((key) => policies[key]);
  return (
    <dl className={compact ? "space-y-2" : "space-y-3"} data-testid={testId}>
      {entries.map((key) => (
        <div key={key} data-testid={`${testId}-${key}`}>
          <dt className="text-xs font-semibold text-foreground">{POLICY_LABELS[key]}</dt>
          <dd className="text-sm text-muted-foreground whitespace-pre-line wrap-break-word">{policies[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
