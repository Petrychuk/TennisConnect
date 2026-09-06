import { useState, type ComponentType } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Lock, ArrowRight, Check, Coffee, Trophy, Heart } from "lucide-react";
import desktopPhoto from "/assets/images/back-the-rally-desktop.webp";
import mobilePhoto from "/assets/images/back-the-rally-mobile.webp";

interface BackTheRallyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Set when the modal should open straight into the thank-you view -
  // the return from Stripe Checkout (see the ?support=success/
  // cancelled handling in navbar.tsx) reopens this same modal rather
  // than building a separate success page.
  initialView?: "select" | "success" | "cancelled";
}

// Lucide doesn't have a tennis-ball icon, and emoji render inconsistently
// across OSes/fonts (part of what was reported as looking wrong) - a
// small SVG in the same stroke style as the lucide icons around it
// reads consistently everywhere instead.
function TennisBallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M5.5 4c3 3.2 3 12.8 0 16" />
      <path d="M18.5 4c-3 3.2-3 12.8 0 16" />
    </svg>
  );
}

type SupportTier = "first_serve" | "keep_the_rally_going" | "game_point" | "game_changer";

const TIERS: { id: SupportTier; amount: string; label: string; icon: ComponentType<{ className?: string }>; note: string; popular?: boolean }[] = [
  { id: "first_serve", amount: "A$5", label: "A coffee for the cause", icon: Coffee, note: "A small boost" },
  { id: "keep_the_rally_going", amount: "A$10", label: "Keep the rally going", icon: TennisBallIcon, note: "Our most popular", popular: true },
  { id: "game_point", amount: "A$20", label: "Stronger together", icon: TennisBallIcon, note: "Big thanks!" },
  { id: "game_changer", amount: "A$50", label: "Game changer", icon: Trophy, note: "A real impact" },
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
      // "game_changer" ($50) is still just a fourth SUPPORT_TIERS entry
      // server-side (server/routes/support.ts) - the server looks up
      // its real amount from the tier name, same as the other three,
      // never trusting a client-sent dollar figure.
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

      // Opens in a new tab rather than navigating the current one away
      // from the site - the success/cancel redirect (success_url/
      // cancel_url in server/routes/support.ts) still points back to
      // this same site, so it lands in that new tab; this tab's own
      // modal is closed right after opening it rather than left open
      // showing the now-stale tier picker behind the new tab.
      window.open(data.url, "_blank", "noopener,noreferrer");
      setIsSubmitting(false);
      onOpenChange(false);
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
      <DialogContent
        className="max-w-md md:max-w-3xl p-0 gap-0 overflow-hidden max-h-[90vh]"
        data-testid="back-the-rally-modal"
      >
        {initialView === "success" ? (
          <div className="p-6">
            <SuccessView onClose={() => onOpenChange(false)} />
          </div>
        ) : initialView === "cancelled" ? (
          <div className="p-6">
            <CancelledView onTryAgain={() => onOpenChange(true)} onClose={() => onOpenChange(false)} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 max-h-[90vh] overflow-y-auto md:overflow-visible">
            {/* Desktop-only photo panel - decorative, the actual
                "Small support. A bigger game." message is baked into
                the photo itself, not overlaid separately. Never
                contains anything interactive, so it never competes
                with the form for clicks/taps. */}
            <div
              className="hidden md:block bg-cover bg-left"
              style={{ backgroundImage: `url(${desktopPhoto})` }}
              aria-hidden="true"
            />

            {/* Single content instance either way - the mobile photo
                backdrop below is a purely decorative absolutely-
                positioned layer behind it (hidden on desktop), not a
                second parallel copy of the form. Two copies would
                mean two elements sharing every data-testid at once
                whenever the viewport is below md, since both would
                exist in the DOM simultaneously (CSS only hides one
                visually) - exactly the kind of duplicate-testid bug
                fixed elsewhere in this project's test suite already. */}
            <div className="relative flex flex-col gap-4 p-6">
              {/* Mobile-only: the photo as this whole panel's
                  background, with a 50% background-colour overlay
                  between it and the content so text stays legible
                  while the photo still reads clearly through it. The
                  tier cards, custom-amount field, and Continue button
                  all keep their own solid backgrounds regardless, so
                  those specific pieces stay fully opaque - only the
                  empty space around them shows the photo. */}
              <div
                className="md:hidden absolute inset-0 -z-10 bg-cover rounded-lg"
                style={{ backgroundImage: `url(${mobilePhoto})`, backgroundPosition: "center 55%" }}
                aria-hidden="true"
              />
              <div className="md:hidden absolute inset-0 -z-10 bg-gradient-to-b from-background/50 to-background/20 rounded-lg" aria-hidden="true" />

              {renderContent()}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  function renderContent() {
    return (
      <>
              <div className="flex flex-col items-center text-center gap-2">
                <span
                  className="hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--tennis-ball))]/20"
                  aria-hidden="true"
                >
                  <Heart className="w-6 h-6 text-[hsl(var(--tennis-ball))]" fill="currentColor" />
                </span>
                <DialogTitle className="text-2xl font-bold">Back the Rally</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Your support helps us grow a stronger, more connected tennis
                  community across Australia.
                </DialogDescription>
              </div>

              <div
                role="radiogroup"
                aria-label="Choose a support amount"
                className="grid grid-cols-2 gap-2"
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
                      className={cn(
                        "relative flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3",
                        "text-sm font-semibold transition-colors bg-background",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        isSelected
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      {isSelected && (
                        <Check
                          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground p-0.5"
                          aria-hidden="true"
                        />
                      )}
                      <tier.icon className="w-6 h-6 text-[hsl(var(--tennis-ball))]" aria-hidden="true" />
                      <span className="text-xs font-medium text-muted-foreground leading-tight text-center">
                        {tier.label}
                      </span>
                      <span className="text-base">{tier.amount}</span>
                      <span className="text-[11px] font-normal text-muted-foreground leading-tight text-center">
                        {tier.note}
                      </span>
                      {tier.popular && (
                        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          Most popular
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <div
                  className={cn(
                    "flex items-center gap-1.5 w-full rounded-xl border border-border bg-background pl-3 pr-3",
                    "focus-within:border-2 focus-within:border-primary focus-within:pl-[11px] focus-within:pr-[11px]"
                  )}
                >
                  <span className="shrink-0 text-sm font-semibold text-muted-foreground leading-none">
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
                    className="w-full py-2.5 text-sm font-semibold leading-none bg-transparent focus-visible:outline-none"
                  />
                </div>
                {/* Fixed-height reserved space regardless of whether
                    the error is showing - it flips in and out as
                    someone types (e.g. "2" too low, "22" valid, "222"
                    still valid, "2222" too high again), and without a
                    reserved slot each flip visibly shifted the button
                    and everything below it up and down. */}
                <div className="h-4 mt-1">
                  {usingCustom && !customAmountValid && (
                    <p className="text-xs text-destructive" data-testid="custom-amount-error">
                      Enter an amount between A$3 and A$1,000.
                    </p>
                  )}
                </div>
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

              <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm text-muted-foreground text-center flex items-center justify-center gap-1.5">
                <span>
                  Your support goes directly towards developing TennisConnect and
                  growing the tennis community. Thank you for being part of the
                  journey!
                </span>
                <Heart className="w-4 h-4 shrink-0 text-[hsl(var(--tennis-ball))]" fill="currentColor" aria-hidden="true" />
              </div>
      </>
    );
  }
}

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4" data-testid="support-success-view">
      <TennisBallIcon className="w-10 h-10 text-[hsl(var(--tennis-ball))]" />
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
      <TennisBallIcon className="w-10 h-10 text-muted-foreground" />
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
