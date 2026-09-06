import Stripe from "stripe";

// The Stripe account is still being set up (see the Back the Rally
// brief) - STRIPE_SECRET_KEY genuinely won't exist yet in some
// environments for a while. Constructing the client must never throw
// at import time, or the whole server fails to boot over an
// unconfigured optional feature. Route handlers that actually need
// Stripe check isStripeConfigured() first and fail gracefully (503)
// instead - see server/routes/support.ts.
export const isStripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_not_configured",
  {
    // out from under this integration. Matches whatever version
   // ships with the installed `stripe` package's own types - bump
   // this together with the package, not independently of it.
   apiVersion: "2025-02-24.acacia",
  }
);
