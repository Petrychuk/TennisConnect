import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Mail } from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { consumePostVerifyRedirect } from "@/lib/postVerifyRedirect";
import heroImage from "/assets/images/tennis_main.jpg";
import SEO from "@/components/seo";

type VerifyState = "verifying" | "success" | "invalid" | "expired" | "missing";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { verifyEmail, resendVerificationEmail } = useAuth();
  const [state, setState] = useState<VerifyState>("verifying");
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // React 18 dev-mode StrictMode mounts effects twice - without this,
  // the single-use token from the link would get consumed by the first
  // run and the second would always show "invalid" even on a genuinely
  // fresh, valid link.
  const hasRun = useRef(false);

  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setState("missing");
      return;
    }

    verifyEmail(token)
      .then((user) => {
        setState("success");

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

  if (state === "verifying") {
    return (
      <>
        {seo}
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground" data-testid="verify-email-loading">
              Confirming your email...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (state === "success") {
    return (
      <>
        {seo}
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center" data-testid="verify-email-success">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Email confirmed!</h1>
            <p className="text-muted-foreground mb-6">
              Your account is now active. Taking you there now...
            </p>
            <TennisBallSpinner />
          </div>
        </div>
      </>
    );
  }

  // "invalid", "expired", and "missing" all land on the same resend
  // form - none of them can tell you which email address to resend to
  // (an unknown/expired token doesn't reveal that, on purpose - see
  // server/services/emailVerification.ts), so the person types it in
  // again rather than the screen trying to guess it.
  const isExpired = state === "expired";

  return (
    <>
      {seo}
      <div className="min-h-screen flex">
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 lg:px-16 py-12 bg-background">
          <div className="max-w-md mx-auto w-full">
            <Link href="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>

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

            {resendSent ? (
              <div className="text-center py-4" data-testid="resend-verification-success">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <p className="text-muted-foreground">
                  If that account needs verifying, a new email has been sent. Please check your inbox.
                </p>
              </div>
            ) : (
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
            )}
          </div>
        </div>

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
