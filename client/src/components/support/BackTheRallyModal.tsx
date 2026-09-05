import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowRight, Check } from "lucide-react";

interface BackTheRallyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Set when the modal should open straight into the thank-you view -
  // the return from Stripe Checkout (see the ?support=success/
  // cancelled handling in navbar.tsx) reopens this same modal rather
  // than building a separate success page.
  initialView?: "select" | "success" | "cancelled";
}

type SupportTier = "first_serve" | "keep_the_rally_going" | "game_point";

const TIERS: { id: SupportTier; amount: string; label: string; popular?: boolean }[] = [
  { id: "first_serve", amount: "A$5", label: "First Serve" },
  { id: "keep_the_rally_going", amount: "A$10", label: "Keep the Rally Going", popular: true },
  { id: "game_point", amount: "A$20", label: "Game Point" },
];

export function BackTheRallyModal({
  open,
  onOpenChange,
  initialView = "select",
}: BackTheRallyModalProps) {
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<SupportTier | null>("keep_the_rally_going");
  const [customAmount, setCustomAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usingCustom = customAmount.trim().length > 0;
  const customAmountNumber = Number(customAmount);
  const customAmountValid =
    usingCustom && Number.isFinite(customAmountNumber) && customAmountNumber >= 3 && customAmountNumber <= 1000;

  const canContinue = usingCustom ? customAmountValid : !!selectedTier;

  function selectTier(tier: SupportTier) {
    setSelectedTier(tier);
    setCustomAmount("");
  }

  function handleCustomAmountChange(value: string) {
    setCustomAmount(value);
    if (value.trim().length > 0) {
      setSelectedTier(null);
    }
  }

  async function handleContinue() {
    if (!canContinue || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/support/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          usingCustom
            ? { tier: "custom", customAmountCents: Math.round(customAmountNumber * 100) }
            : { tier: selectedTier }
        ),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Something went wrong starting your payment.");
      }

      const data = await res.json();

      // Stripe Checkout is fully hosted - handing off here is the
      // entire "payment flow" as far as this app's own code goes.
      // window.gtag is the same Consent-Mode-aware gtag() already
      // wired up in client/index.html; firing an event through it
      // doesn't need any new analytics plumbing.
      (window as any).gtag?.("event", "support_checkout_started", {
        tier: usingCustom ? "custom" : selectedTier,
      });

      window.location.href = data.url;
    } catch (error: any) {
      setIsSubmitting(false);
      toast({
        title: "Couldn't start payment",
        description: error.message || "Please try again in a moment.",
        variant: "destructive",
      });
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      (window as any).gtag?.("event", "back_the_rally_opened");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="back-the-rally-modal">
        {initialView === "success" ? (
          <SuccessView onClose={() => onOpenChange(false)} />
        ) : initialView === "cancelled" ? (
          <CancelledView onTryAgain={() => onOpenChange(true)} onClose={() => onOpenChange(false)} />
        ) : (
          <>
            <div className="flex flex-col items-center text-center gap-2 pt-2">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--tennis-ball))]/20 text-2xl"
                aria-hidden="true"
              >
                💚
              </span>
              <DialogTitle className="text-2xl font-bold">Back the Rally</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Your support helps us keep TennisConnect growing and make tennis
                more connected for everyone.
              </DialogDescription>
            </div>

            <div
              role="radiogroup"
              aria-label="Choose a support amount"
              className="grid grid-cols-3 gap-2"
            >
              {TIERS.map((tier) => {
                const isSelected = selectedTier === tier.id && !usingCustom;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => selectTier(tier.id)}
                    data-testid={`support-tier-${tier.id}`}
                    className={`
                      relative flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3
                      text-sm font-semibold transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                      ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }
                    `}
                  >
                    {isSelected && (
                      <Check
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground p-0.5"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-base">{tier.amount}</span>
                    <span className="text-xs font-normal text-muted-foreground leading-tight text-center">
                      {tier.label}
                    </span>
                    {tier.popular && (
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Most popular
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                A$
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={3}
                max={1000}
                placeholder="Custom amount"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                data-testid="input-custom-amount"
                aria-label="Custom support amount in Australian dollars"
                className="w-full rounded-xl border-2 border-border pl-8 pr-3 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
              />
              {usingCustom && !customAmountValid && (
                <p className="mt-1.5 text-xs text-destructive" data-testid="custom-amount-error">
                  Enter an amount between A$3 and A$1,000.
                </p>
              )}
            </div>

            <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Your support goes directly towards developing TennisConnect and
              growing the tennis community. Thank you for being part of the
              journey! 💚
            </div>

            <Button
              onClick={handleContinue}
              disabled={!canContinue || isSubmitting}
              data-testid="button-continue-to-payment"
              className="w-full h-12 text-base font-bold"
            >
              {isSubmitting ? (
                "Redirecting..."
              ) : (
                <>
                  Continue to payment
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Secure payment powered by Stripe
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4" data-testid="support-success-view">
      <span className="text-4xl" aria-hidden="true">🎾</span>
      <DialogTitle className="text-2xl font-bold">You backed the rally!</DialogTitle>
      <DialogDescription className="text-muted-foreground">
        Thanks for supporting TennisConnect. You're helping us build a
        stronger tennis community.
      </DialogDescription>
      <Button onClick={onClose} className="w-full h-12 mt-2 font-bold" data-testid="button-back-to-tennisconnect">
        Back to TennisConnect
      </Button>
    </div>
  );
}

function CancelledView({
  onTryAgain,
  onClose,
}: {
  onTryAgain: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4" data-testid="support-cancelled-view">
      <span className="text-4xl" aria-hidden="true">🎾</span>
      <DialogTitle className="text-2xl font-bold">No worries!</DialogTitle>
      <DialogDescription className="text-muted-foreground">
        Your payment was cancelled and you haven't been charged. You can back
        the rally any time.
      </DialogDescription>
      <div className="flex gap-2 w-full mt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Close
        </Button>
        <Button onClick={onTryAgain} className="flex-1 font-bold">
          Try again
        </Button>
      </div>
    </div>
  );
}
