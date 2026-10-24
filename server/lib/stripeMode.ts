// Stripe test-mode safeguards (server/routes/support.ts).
//
// Outside Production, payments must only ever run against Stripe TEST mode:
// - a live secret key (sk_live_ / rk_live_) on a non-production instance
//   blocks checkout creation entirely (fail closed), as does a key whose
//   mode can't be recognised;
// - a live-mode webhook event reaching a non-production instance is
//   rejected and never marks a payment as paid.
// Production behaviour is unchanged.
//
// Never returns or logs the key itself. Unit-tested in
// server/lib/stripeMode.test.ts.

export type StripeKeyMode = "test" | "live" | "unconfigured" | "unknown";

export function stripeKeyMode(key: string | undefined): StripeKeyMode {
  const value = (key ?? "").trim();
  if (value === "") return "unconfigured";
  if (/^(sk|rk)_test_/.test(value)) return "test";
  if (/^(sk|rk)_live_/.test(value)) return "live";
  return "unknown";
}

function isProduction(dbEnv: string | undefined): boolean {
  return (dbEnv ?? "").trim().toLowerCase() === "production";
}

/** A reason to refuse creating a checkout session, or null when allowed. */
export function stripeCheckoutBlockedReason(source: {
  dbEnv: string | undefined;
  secretKey: string | undefined;
}): string | null {
  if (isProduction(source.dbEnv)) return null;

  const mode = stripeKeyMode(source.secretKey);
  if (mode === "live") {
    return "a LIVE Stripe secret key is configured on a non-production instance";
  }
  if (mode === "unknown") {
    return "the Stripe secret key's mode can't be recognised on a non-production instance";
  }
  return null;
}

/** True when a webhook event must be rejected on this instance. */
export function isLiveEventOutsideProduction(source: {
  dbEnv: string | undefined;
  livemode: boolean | undefined;
}): boolean {
  return !isProduction(source.dbEnv) && source.livemode === true;
}
