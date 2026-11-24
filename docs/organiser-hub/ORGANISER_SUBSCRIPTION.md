# Organiser Hub paid subscription (A$40/month, 7-day free trial)

Branch: `feature/organiser-hub-v2`. Ticket context: TC-190 section F.

## The switch

One server environment variable, read on every request (a changed value applies on the next restart/redeploy, like `TC_LIVE_ENABLED`):

| `ORGANISER_SUBSCRIPTION_ENABLED` | Behaviour |
|---|---|
| unset / `false` (default) | Nothing changes. Organiser access = admin approval alone. No pricing or trial copy anywhere. `/api/organizer/billing/checkout` and `/portal` answer 404. |
| `true` / `1` / `on` | Organiser access = **admin approval AND** an active/trialing subscription (or a grandfathered account). Admins are exempt. Pricing + trial terms appear in the request-access modal. |

Approval and payment never grant each other: paying without approval does not open the Hub (403), and approval without a subscription answers **402 `SUBSCRIPTION_REQUIRED`** (the Hub shows the subscribe screen instead). Nothing in the billing code ever sets `users.is_organizer`.

## Other configuration

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Existing. Outside Production only a **test** key works (`server/lib/stripeMode.ts`); a live key on Staging blocks checkout (503). |
| `STRIPE_ORGANISER_PRICE_ID` | Optional pre-created recurring AUD price. Unset = an inline A$40/month price is used. The browser never sends a price. |
| `STRIPE_ORGANISER_WEBHOOK_SECRET` | Signing secret of the billing webhook endpoint (falls back to `STRIPE_WEBHOOK_SECRET`). |

Stripe Dashboard: add a webhook endpoint `https://<host>/api/organizer/billing/webhook` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Enable the Customer Portal (cancel + update card) for the account. The webhook is the only thing that activates a plan; the checkout success redirect is cosmetic, and the handler re-reads the subscription from Stripe rather than trusting the event body.

Free trial: first subscription only (a person who already had one gets no second trial). The card is collected up front, the subscription renews automatically after 7 days, and can be cancelled before then from "Manage subscription" (Stripe portal) on the person's profile.

## Rollout

1. Apply `migrations/0037_organiser_subscriptions.sql` (additive: new table + grandfather backfill). Safe before the code deploys.
2. Deploy with the flag **off** (no behaviour change). Run the Staging regression.
3. **Immediately before** turning the flag on in an environment, re-run the backfill `INSERT ... ON CONFLICT DO NOTHING` from the migration, so organisers approved since step 1 are grandfathered too. Existing organisers stay free; the subscription applies to people approved afterwards.
4. Set `ORGANISER_SUBSCRIPTION_ENABLED=true`, redeploy. Kill switch: set it back to `false` and redeploy (stored subscriptions are kept).
5. Before launch, align terms/checkout with Australian consumer requirements (cancellation, auto-renewal disclosure, GST/tax invoices) - a legal review, not covered by tests.

## Tests

| Layer | File | Runs |
|---|---|---|
| Rules (flag, entitlement, status mapping) | `server/lib/organiserSubscription.test.ts` | `npm run test:server-unit` |
| Hub gate on the real organizer router (402/403, grandfathered, admin) | `server/routes/organizerSubscriptionGate.test.ts` | same |
| Billing routes + signed webhook, fake Stripe/store | `server/routes/organizerBilling.test.ts` | same |
| Test hook `organiser-subscription` | `server/routes/testHooksSubscription.test.ts` | same |
| Copy, price formatting, visibility | `client/src/lib/organiserOnboarding.test.ts` | `npm run test:ui` |
| **Staging full regression** | `tests/organiser/organiser-subscription.spec.ts` (`ORG-SUB-002..011`) | phase `hub-msg-admin` (002-010), `stripe` (011, `E2E_ENABLE_STRIPE_TESTS=1`) |
| **Production smoke (only the basics)** | `tests/prod-safe/prod-safe.spec.ts` `PROD-SAFE-034` | `npm run test:e2e:prod-safe` |

Staging regression: run the suite twice - flag **off** (`ORG-SUB-002`, `-010` run; the others skip) and flag **on** (`-003..-009`, `-011` run). Tests that are not about billing keep working in both modes: `becomeOrganiser()` gives its run-owned organiser a subscription through the test hook when the flag is on.

Production runs **only** `PROD-SAFE-034`: GET-only, guest, flag-agnostic (billing status and the Hub API refuse a guest with 401 and reveal nothing). No login, no Checkout, no webhook, no writes - Production is never used to exercise payments.
