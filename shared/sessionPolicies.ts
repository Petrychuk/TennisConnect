/*
  Session rules and policies (Organiser Hub, Phase 2 Batch 2).

  The Create Session wizard has four optional texts: Rules, Refund Policy,
  Late Arrivals, Cancellations. They used to be folded into the session
  description as "Rules: ..." paragraphs, so Edit couldn't give them back as
  separate fields. They now have their own nullable columns (migration
  0034_sessions_policies.sql).

  Sessions saved before that still carry them inside the description. This
  module reads either: columns first; if every column is empty, the legacy
  paragraphs are recognised in the description and split out - so players
  see them in one place and an organiser's next save moves them into the
  columns. Nothing is rewritten in the database on read.

  Pure - unit-tested in ./sessionPolicies.test.ts.
*/

export interface SessionPolicies {
  rules: string | null;
  refund: string | null;
  lateArrival: string | null;
  cancellation: string | null;
}

export interface SessionPolicyColumns {
  description?: string | null;
  rulesText?: string | null;
  refundPolicy?: string | null;
  latePolicy?: string | null;
  cancellationPolicy?: string | null;
}

/** The paragraph prefixes the wizard wrote into descriptions before the columns existed. */
export const LEGACY_POLICY_PREFIXES: Record<keyof SessionPolicies, string> = {
  rules: "Rules: ",
  refund: "Refund Policy: ",
  lateArrival: "Late Arrivals: ",
  cancellation: "Cancellations: ",
};

export const POLICY_LABELS: Record<keyof SessionPolicies, string> = {
  rules: "Rules",
  refund: "Refund policy",
  lateArrival: "Late arrivals",
  cancellation: "Cancellations",
};

const EMPTY: SessionPolicies = { rules: null, refund: null, lateArrival: null, cancellation: null };

const clean = (value: string | null | undefined) => {
  const text = (value ?? "").trim();
  return text ? text : null;
};

export function hasAnyPolicy(policies: SessionPolicies): boolean {
  return Object.values(policies).some(Boolean);
}

/**
 * Splits a legacy description into its plain text and the policy paragraphs.
 * A policy paragraph starts with one of the prefixes at the start of a
 * paragraph and runs until the next prefixed paragraph (so a multi-paragraph
 * policy stays whole).
 */
export function splitLegacyDescription(description: string | null | undefined): { description: string | null; policies: SessionPolicies } {
  const paragraphs = (description ?? "").split(/\n{2,}/);
  const kept: string[] = [];
  const found: Record<keyof SessionPolicies, string[]> = { rules: [], refund: [], lateArrival: [], cancellation: [] };
  let current: keyof SessionPolicies | null = null;
  for (const paragraph of paragraphs) {
    const key = (Object.keys(LEGACY_POLICY_PREFIXES) as (keyof SessionPolicies)[]).find((k) =>
      paragraph.startsWith(LEGACY_POLICY_PREFIXES[k]),
    );
    if (key) {
      current = key;
      found[key].push(paragraph.slice(LEGACY_POLICY_PREFIXES[key].length));
    } else if (current) {
      found[current].push(paragraph);
    } else {
      kept.push(paragraph);
    }
  }
  return {
    description: clean(kept.join("\n\n")),
    policies: {
      rules: clean(found.rules.join("\n\n")),
      refund: clean(found.refund.join("\n\n")),
      lateArrival: clean(found.lateArrival.join("\n\n")),
      cancellation: clean(found.cancellation.join("\n\n")),
    },
  };
}

/** Description + policies of a stored session: columns first, legacy paragraphs otherwise. */
export function readSessionPolicies(session: SessionPolicyColumns): { description: string | null; policies: SessionPolicies } {
  const fromColumns: SessionPolicies = {
    rules: clean(session.rulesText),
    refund: clean(session.refundPolicy),
    lateArrival: clean(session.latePolicy),
    cancellation: clean(session.cancellationPolicy),
  };
  if (hasAnyPolicy(fromColumns)) return { description: clean(session.description), policies: fromColumns };
  const legacy = splitLegacyDescription(session.description);
  return hasAnyPolicy(legacy.policies) ? legacy : { description: clean(session.description), policies: { ...EMPTY } };
}

/** The column values to save (empty text -> null). */
export function policyColumns(policies: SessionPolicies) {
  return {
    rulesText: clean(policies.rules),
    refundPolicy: clean(policies.refund),
    latePolicy: clean(policies.lateArrival),
    cancellationPolicy: clean(policies.cancellation),
  };
}
