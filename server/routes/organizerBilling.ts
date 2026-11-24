/*
  Organiser Hub subscription billing (A$40/month, 7-day free trial) - mounted at
  /api/organizer/billing. Everything is behind ORGANISER_SUBSCRIPTION_ENABLED
  (server/lib/organiserSubscription.ts): with the flag off, status says so and
  checkout / portal answer 404, so nothing here changes today's behaviour.

  - Approval and payment stay separate. Nothing in this file ever sets
    users.is_organizer; only an admin does. Access (requireOrganizer in
    organizer.ts) needs the approval AND an active/trialing subscription (or a
    grandfathered account).
  - The webhook is the only thing that moves a subscription to trialing/active.
    The checkout success redirect is cosmetic.
  - Stripe TEST mode only outside Production (server/lib/stripeMode.ts).
  - No secret, key or card detail is ever logged or returned.

  Webhook: point a Stripe endpoint at /api/organizer/billing/webhook with events
  checkout.session.completed, customer.subscription.created / updated / deleted,
  and set STRIPE_ORGANISER_WEBHOOK_SECRET (falls back to STRIPE_WEBHOOK_SECRET).
*/
import { Router } from "express";
import type Stripe from "stripe";
import { requireAuth } from "../requireAuth";
import { stripe as realStripe, isStripeConfigured } from "../lib/stripe";
import { isLiveEventOutsideProduction, stripeCheckoutBlockedReason } from "../lib/stripeMode";
import {
  ORGANISER_PRICE,
  checkoutBlockedReason,
  hasOrganiserEntitlement,
  normaliseStripeStatus,
  resolveBillingStage,
  subscriptionEnabled,
} from "../lib/organiserSubscription";
import { organiserSubscriptionStore, type SubscriptionPatch } from "../lib/organiserSubscriptionStore";

/** Replaceable in tests (same pattern as the `storage` fakes). */
export const billingDeps: {
  store: typeof organiserSubscriptionStore;
  stripe: Pick<Stripe, "customers" | "checkout" | "billingPortal" | "subscriptions" | "webhooks">;
} = { store: organiserSubscriptionStore, stripe: realStripe };

const router = Router();

function publicPrice() {
  return { ...ORGANISER_PRICE };
}

function originOf(req: any): string {
  return (req.headers.origin as string | undefined) || `${req.protocol}://${req.get("host")}`;
}

function stripeUnavailable(): string | null {
  if (!isStripeConfigured()) return "Subscriptions aren't set up yet - check back soon.";
  const blocked = stripeCheckoutBlockedReason({ dbEnv: process.env.DB_ENV, secretKey: process.env.STRIPE_SECRET_KEY });
  if (blocked) {
    console.error(`[organiser billing] checkout blocked: ${blocked}`);
    return "Subscriptions are unavailable in this environment.";
  }
  return null;
}

router.get("/status", requireAuth, async (req, res, next) => {
  try {
    const user = req.user as any;
    const enabled = subscriptionEnabled();
    if (!enabled) return res.json({ enabled: false, stage: "disabled", entitled: !!user.isOrganizer || !!user.isAdmin });

    const sub = await billingDeps.store.get(user.id);
    const input = { enabled, isAdmin: user.isAdmin, isOrganizer: user.isOrganizer, status: sub?.status ?? null };
    res.json({
      enabled: true,
      stage: resolveBillingStage(input),
      entitled: hasOrganiserEntitlement(input),
      status: sub?.status ?? "none",
      trialEnd: sub?.trialEnd ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      price: publicPrice(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/checkout", requireAuth, async (req, res, next) => {
  try {
    if (!subscriptionEnabled()) return res.status(404).json({ message: "Not found" });
    const user = req.user as any;
    const sub = await billingDeps.store.get(user.id);

    const blocked = checkoutBlockedReason({ enabled: true, isAdmin: user.isAdmin, isOrganizer: user.isOrganizer, status: sub?.status ?? null });
    if (blocked) return res.status(409).json({ message: blocked });

    const unavailable = stripeUnavailable();
    if (unavailable) return res.status(503).json({ message: unavailable });

    let customerId = sub?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await billingDeps.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await billingDeps.store.upsert(user.id, { stripeCustomerId: customerId });
    }

    const priceId = (process.env.STRIPE_ORGANISER_PRICE_ID ?? "").trim();
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: ORGANISER_PRICE.currency,
            unit_amount: ORGANISER_PRICE.amountCents,
            recurring: { interval: ORGANISER_PRICE.interval },
            product_data: { name: "TennisConnect Organiser Hub" },
          },
        };

    // The free trial is for a first subscription only: someone who already had
    // one (cancelled, lapsed) is not given another 7 days.
    const firstSubscription = !sub?.stripeSubscriptionId;
    const origin = originOf(req);

    const session = await billingDeps.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [lineItem],
      payment_method_collection: "always",
      subscription_data: {
        ...(firstSubscription ? { trial_period_days: ORGANISER_PRICE.trialDays } : {}),
        metadata: { userId: user.id, kind: "organiser_subscription" },
      },
      metadata: { userId: user.id, kind: "organiser_subscription" },
      success_url: `${origin}/organiser?subscription=success`,
      cancel_url: `${origin}/organiser?subscription=cancelled`,
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

router.post("/portal", requireAuth, async (req, res, next) => {
  try {
    if (!subscriptionEnabled()) return res.status(404).json({ message: "Not found" });
    const user = req.user as any;
    const sub = await billingDeps.store.get(user.id);
    if (!sub?.stripeCustomerId) return res.status(404).json({ message: "No subscription to manage" });

    const unavailable = stripeUnavailable();
    if (unavailable) return res.status(503).json({ message: unavailable });

    const session = await billingDeps.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${originOf(req)}/organiser`,
    });
    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

function toDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

function patchFromSubscription(subscription: Stripe.Subscription): SubscriptionPatch {
  return {
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    stripeSubscriptionId: subscription.id,
    status: normaliseStripeStatus(subscription.status),
    trialEnd: toDate(subscription.trial_end),
    currentPeriodEnd: toDate(subscription.current_period_end),
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
  };
}

/** Which user a subscription belongs to: our metadata first, then the Stripe customer. */
async function ownerOf(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.userId;
  if (fromMetadata) return fromMetadata;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;
  return (await billingDeps.store.getByCustomerId(customerId))?.userId ?? null;
}

// Needs the raw body: server/index.ts's express.json() keeps it on req.rawBody.
router.post("/webhook", async (req, res) => {
  const secret = process.env.STRIPE_ORGANISER_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!isStripeConfigured() || !secret) return res.status(503).send("Webhook not configured");

  let event: Stripe.Event;
  try {
    event = billingDeps.stripe.webhooks.constructEvent(req.rawBody as Buffer, req.headers["stripe-signature"] as string, secret);
  } catch (err: any) {
    console.error("[organiser billing webhook] signature verification failed:", err?.message);
    return res.status(400).send("Webhook Error: invalid signature");
  }

  if (isLiveEventOutsideProduction({ dbEnv: process.env.DB_ENV, livemode: event.livemode })) {
    console.error(`[organiser billing webhook] rejected live-mode event ${event.id} on a non-production instance`);
    return res.status(400).send("Live-mode events are not accepted in this environment");
  }

  try {
    let subscriptionId: string | null = null;
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.metadata?.kind === "organiser_subscription") {
        subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      subscriptionId = (event.data.object as Stripe.Subscription).id;
    }

    if (subscriptionId) {
      // The current state, not the (possibly out-of-order) event payload.
      const subscription = await billingDeps.stripe.subscriptions.retrieve(subscriptionId);
      const userId = await ownerOf(subscription);
      // Other products' subscriptions on the same Stripe account are not ours.
      if (userId) await billingDeps.store.upsert(userId, patchFromSubscription(subscription));
    }
  } catch (error) {
    console.error("[organiser billing webhook] handling failed:", error);
    return res.status(500).send("Webhook handler failed"); // Stripe retries
  }

  res.json({ received: true });
});

export default router;
