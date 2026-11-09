import { Checkbox } from "@/components/ui/checkbox";

/*
  "I agree to the session's rules and policies" - asked before Join / Join
  Waiting List whenever the organiser set any. The API refuses the join
  without it (shared/sessionJoinRules.ts), so this is not only a UI nicety.
*/
export function PoliciesAgreement({
  checked,
  onCheckedChange,
  policiesHref = "#session-policies",
  testId,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  policiesHref?: string;
  testId: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-sm" data-testid={testId}>
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} className="mt-0.5" data-testid={`${testId}-checkbox`} />
      <span className="leading-snug">
        I agree to the session{" "}
        <a href={policiesHref} className="font-medium text-primary-text underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
          rules &amp; policies
        </a>
      </span>
    </label>
  );
}
