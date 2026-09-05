import { Router } from "express";
import type Stripe from "stripe";
import { z } from "zod";
import { stripe, isStripeConfigured } from "../lib/stripe";
import { storage } from "../storage";

const router = Router();

// The server decides the real AUD amount from the tier the client
// picked - the client never sends a dollar amount for the three
// preset tiers, only which one was chosen (frontend is never trusted
// to determine the final payment amount).
const SUPPORT_TIERS: Record<string, { amountCents: number; label: string }> = {
  first_serve: { amountCents: 500, label: "First Serve" },
  keep_the_rally_going: { amountCents: 1000, label: "Keep the Rally Going" },
  game_point: { amountCents: 2000, label: "Game Point" },
};

// A custom amount is still fully server-validated - these bounds are
// a sensible sanity range for an unverified one-off "support" payment,
// not a business rule handed down from anywhere else.
const MIN_CUSTOM_CENTS = 300; // $3
const MAX_CUSTOM_CENTS = 100_000; // $1,000

const createCheckoutSchema = z.object({
  tier: z.enum(["first_serve", "keep_the_rally_going", "game_point", "custom"]),
  customAmountCents: z.number().int().positive().optional(),
  email: z.string().email().optional(),
});

router.post("/create-checkout-session", async (req, res, next) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({
        message: "Support payments aren't set up yet - check back soon.",
      });
    }

    const result = createCheckoutSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid request",
        errors: result.error.flatten(),
      });
    }

    const { tier, customAmountCents, email } = result.data;

    let amountCents: number;
    let tierLabel: string;

    if (tier === "custom") {
      if (
        !customAmountCents ||
        customAmountCents < MIN_CUSTOM_CENTS ||
        customAmountCents > MAX_CUSTOM_CENTS
      ) {
        return res.status(400).json({
          message: `Custom amount must be between $${MIN_CUSTOM_CENTS / 100} and $${MAX_CUSTOM_CENTS / 100}.`,
        });
      }
      amountCents = customAmountCents;
      tierLabel = "Your Shot";
    } else {
      amountCents = SUPPORT_TIERS[tier].amountCents;
      tierLabel = SUPPORT_TIERS[tier].label;
    }

    // Optional - a guest can support TennisConnect without an account.
    const isLoggedIn = req.isAuthenticated?.();
    const userId = isLoggedIn ? (req.user as any)?.id ?? null : null;

    const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Apple Pay / Google Pay surface on their own inside Stripe
      // Checkout, on supported devices/browsers, once enabled in the
      // Stripe Dashboard - nothing extra to wire up here, and nothing
      // in TennisConnect's own UI claims they're available ahead of
      // what Stripe actually offers the visitor.
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: amountCents,
            product_data: {
              name: `Back the Rally - ${tierLabel}`,
              description:
                "Supporting TennisConnect's development and the tennis community.",
            },
          },
        },
      ],
      customer_email: email,
      success_url: `${origin}/?support=success`,
      cancel_url: `${origin}/?support=cancelled`,
      metadata: {
        tier,
        userId: userId || "",
      },
    });

    // Recorded as 'pending' here so an abandoned checkout still leaves
    // a trace - only the webhook (below) ever moves it to 'paid'.
    await storage.createPayment({
      userId,
      guestEmail: userId ? null : email ?? null,
      paymentType: "support",
      supportTier: tier,
      relatedEntityId: null,
      amountCents,
      currency: "AUD",
      gstAmountCents: null,
      isGstInclusive: null,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: null,
      receiptUrl: null,
      status: "pending",
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Stripe webhook - needs the raw request body to verify the
// signature. server/index.ts's global express.json() already captures
// the raw bytes into req.rawBody (via its own `verify` callback)
// before parsing, so no separate raw-body middleware is needed here.
//
// This is the ONLY place a payment is ever marked 'paid' - the
// client-facing success-page redirect (success_url above) is purely
// cosmetic and never confirms payment on its own.
router.post("/webhook", async (req, res) => {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send("Webhook not configured");
  }

  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody as Buffer,
      signature as string,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("[stripe webhook] signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    // Stripe's hosted receipt lives on the PaymentIntent's charge, not
    // the session itself - leaving this null for the MVP rather than
    // an extra API round-trip to fetch it. Stripe already emails the
    // payer a receipt automatically either way.
    await storage.markPaymentPaid(session.id, {
      stripePaymentIntentId: paymentIntentId,
      receiptUrl: null,
    });
  }

  res.json({ received: true });
});

export default router;
