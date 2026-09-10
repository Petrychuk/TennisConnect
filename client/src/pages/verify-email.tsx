import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Clock, Mail } from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { consumePostVerifyRedirect } from "@/lib/postVerifyRedirect";
import heroImage from "/assets/images/tennis_main.jpg";
import SEO from "@/components/seo";

// Fires the verification request the moment the page loads - no extra
// "Confirm Email Address" click required beyond the one that got them
// here from the email. An earlier version required a second on-page
// click specifically to guard against mail clients/scanners that
// pre-fetch links to check them for safety before a human ever opens
// the email, which can silently burn a single-use token before the
// real click happens - but that's a real cost (an extra click on every
// single confirmation) against a threat that was never confirmed as
// the actual cause of anything seen in testing. Back to auto-firing;
// if a genuine pre-fetch-burns-the-token case shows up on the real
// domain, the fix is to require a click again, not to keep paying the
// cost of one in the meantime "just in case".
type VerifyState = "verifying" | "success" | "invalid" | "expired" | "missing";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { verifyEmail, resendVerificationEmail } = useAuth();

  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  const [state, setState] = useState<VerifyState>(token ? "verifying" : "missing");
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // profileCompleted isn't known until verifyEmail() resolves, so the
  // redirect target for the success screen's "click here" fallback link
  // (shown if the automatic redirect below doesn't fire) is stored once
  // it's known, rather than recomputed from stale state.
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);

  // React 18 dev-mode StrictMode mounts effects twice - without this,
  // the single-use token would get consumed by the first run and the
  // second would always show "invalid" even on a genuinely fresh, valid
  // link.
  const hasRun = useRef(false);

  useEffect(() => {
    if (!token || hasRun.current) return;
    hasRun.current = true;

    verifyEmail(token)
      .then((user) => {
        const redirect = consumePostVerifyRedirect();
        const target = redirect
          ? (() => {
              const url = new URL(redirect.returnTo, window.location.origin);
              if (redirect.joinSession) url.searchParams.set("joinSession", redirect.joinSession);
              return url.pathname + url.search;
            })()
          : !user.profileCompleted
            ? "/complete-profile"
            : `/${user.role}/${user.slug}`;

        setRedirectTarget(target);
        setState("success");

        toast({
          title: "Email confirmed!",
          description: "Welcome to TennisConnect.",
        });

        setTimeout(() => setLocation(target), 1500);
      })
      .catch((error: any) => {
        setState(error?.status === "expired" ? "expired" : "invalid");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setResendLoading(true);
    try {
      await resendVerificationEmail(resendEmail);
      setResendSent(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend verification email.",
      });
    } finally {
      setResendLoading(false);
    }
  };

  const seo = (
    <SEO
      title="Verify Email | TennisConnect"
      description="Confirm your TennisConnect email address."
      canonical="/verify-email"
      noIndex
    />
  );

  // Shared two-column shell (form column + hero image) used by every
  // state below except the brief "verifying"/"success" transitions,
  // which are simple centered screens like a normal loading/success
  // toast rather than a full page.
  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <>
        {seo}
        <div className="min-h-screen flex">
          <main id="main-content" className="w-full lg:w-1/2 flex flex-col justify-center px-8 lg:px-16 py-12 bg-background">
            <div className="max-w-md mx-auto w-full">
              <Link href="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
              {children}
            </div>
          </main>

          <div
            className="hidden lg:block lg:w-1/2 bg-cover bg-center relative"
            style={{ backgroundImage: `url(${heroImage})` }}
          >
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute bottom-12 left-12 right-12 text-white">
              <p className="text-2xl font-display font-bold mb-4">
                "Tennis is more than a game. It's friendship, community and a sense of belonging."
              </p>
              <p className="text-white/80">— Nataliia Petrychuk, Founder</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (state === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <TennisBallSpinner />
          <p className="text-muted-foreground mt-4" data-testid="verify-email-loading">
            Confirming your email...
          </p>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <main id="main-content" className="max-w-md w-full text-center" data-testid="verify-email-success">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Email confirmed!</h1>
          <p className="text-muted-foreground mb-6">
            Your account is now active. Taking you there now...
          </p>
          {redirectTarget && (
            <button
              onClick={() => setLocation(redirectTarget)}
              className="text-sm text-primary underline mb-4 block mx-auto"
            >
              Not redirected? Click here.
            </button>
          )}
          <TennisBallSpinner />
        </main>
      </div>
    );
  }

  // "invalid", "expired", and "missing" all land on the same resend
  // form - none of them can tell you which email address to resend to
  // (an unknown/expired token doesn't reveal that, on purpose - see
  // server/services/emailVerification.ts), so the person types it in
  // again rather than the screen trying to guess it.
  const isExpired = state === "expired";

  return (
    <Shell>
      {resendSent ? (
        // Replaces the "invalid/expired link" header entirely rather
        // than appending a confirmation below it - keeping "Invalid
        // verification link" on screen right next to "a new email has
        // been sent" read as contradictory (which link is it talking
        // about now?).
        <div data-testid="resend-verification-success">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-muted-foreground">
            If that account needs verifying, a new email has been sent. Please check your inbox -
            the new link expires in 24 hours.
          </p>
        </div>
      ) : (
        <>
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6" data-testid={isExpired ? "verify-email-expired" : "verify-email-invalid"}>
            {isExpired ? (
              <Clock className="w-8 h-8 text-red-500" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500" />
            )}
          </div>

          <h1 className="text-2xl font-bold mb-2">
            {isExpired ? "Verification link expired" : "Invalid verification link"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isExpired
              ? "This verification link has expired. Enter your email below and we'll send you a new one."
              : state === "missing"
                ? "This link is missing a verification token. Enter your email below to request a new link."
                : "This verification link is invalid or has already been used. Enter your email below to request a new one."}
          </p>

          <form onSubmit={handleResend} className="space-y-4">
            <input
              type="email"
              placeholder="name@example.com"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              data-testid="resend-verification-email-input"
              className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button
              type="submit"
              className="w-2/3 mx-auto flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full h-12"
              disabled={resendLoading}
              data-testid="resend-verification-button"
            >
              {resendLoading ? <TennisBallSpinner /> : "Resend verification email"}
            </Button>
          </form>
        </>
      )}
    </Shell>
  );
}
