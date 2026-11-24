import { useCallback, useEffect, useState } from "react";
import type { BillingPrice, BillingStage } from "@/lib/organiserOnboarding";

export interface OrganiserBillingStatus {
  enabled: boolean;
  stage: BillingStage;
  entitled: boolean;
  status?: string;
  trialEnd?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  price?: BillingPrice;
}

// GET /api/organizer/billing/status. With ORGANISER_SUBSCRIPTION_ENABLED off the
// server answers { enabled: false } and every caller shows nothing. A failed
// request leaves `data` null (callers then behave as if billing were off; the
// API still enforces the rule). pollMs > 0 re-reads on an interval - used right
// after returning from Stripe Checkout, until the webhook has landed.
export function useOrganiserBilling(enabled: boolean, pollMs = 0) {
  const [data, setData] = useState<OrganiserBillingStatus | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/organizer/billing/status", { credentials: "include" });
      if (res.ok) setData(await res.json());
    } catch {
      // supplementary: the Hub still works without it
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || pollMs <= 0) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, pollMs);
    return () => clearInterval(interval);
  }, [enabled, pollMs, refresh]);

  return { data, loading, refresh };
}

/** POSTs to a billing endpoint that answers { url } and sends the browser there. */
export async function startBillingRedirect(path: "/checkout" | "/portal"): Promise<{ ok: false; message: string } | undefined> {
  try {
    const res = await fetch(`/api/organizer/billing${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && typeof json?.url === "string") {
      window.location.assign(json.url);
      return undefined;
    }
    return { ok: false, message: typeof json?.message === "string" ? json.message : "Something went wrong. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach TennisConnect. Check your connection and try again." };
  }
}
