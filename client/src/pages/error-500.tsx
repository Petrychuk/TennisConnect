import { ArrowLeft, RotateCw, Users, CalendarDays, TrendingUp, Trophy } from "lucide-react";
import { Link } from "wouter";
import SEO from "@/components/seo";
import { useAuth } from "@/lib/auth-context";

// Full-page "something broke server-side" screen. Used both as its own
// route (/500, useful for a direct link or for QA to sanity-check the
// design) and as the fallback UI ChunkErrorBoundary renders when the app
// hits an error it can't quietly recover from.
export default function Error500() {
  const { user } = useAuth();
  const profileHref = user?.role && user?.slug ? `/${user.role}/${user.slug}` : "/";

  return (
    <>
      <SEO
        title="Something went wrong | TennisConnect"
        description="We're experiencing an internal issue. Our team has been notified and is working to get things back on track."
        noIndex
      />

      <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
        {/* Background photo */}
        <img
          src="/assets/images/error-500-hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[68%_center] sm:object-center"
        />

        {/* Legibility gradient - darkest bottom-left where the copy sits,
            matching the same treatment used on /maintenance */}
        <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/60 to-black/25" />
        <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/15 to-transparent" />

        <div className="relative z-10 flex min-h-screen flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 lg:pl-20">
          {/* Logo */}
          <Link
            href="/"
            className="flex w-fit items-center gap-1 font-display text-xl font-bold sm:text-2xl cursor-pointer"
          >
            Tennis
            <span className="text-[hsl(var(--tennis-ball))]">Connect</span>
            <div className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--tennis-ball))]" />
          </Link>

          {/* Main message */}
          <div className="max-w-lg pb-8 sm:pb-10 lg:max-w-xl">
            <p className="font-display text-6xl font-bold leading-none sm:text-8xl">
              5<span className="text-[hsl(var(--tennis-ball))]">00</span>
            </p>

            <h1 className="mt-3 font-display text-2xl font-bold sm:mt-4 sm:text-4xl">
              Something went wrong
            </h1>

            <div className="mt-3 h-1 w-12 rounded-full bg-[hsl(var(--tennis-ball))] sm:mt-4" />

            <p className="mt-4 max-w-sm text-sm text-gray-300 sm:mt-5 sm:text-base">
              We're experiencing an internal issue. Our team has been
              notified and is working to get things back on track.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row">
              <Link
                href={profileHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--tennis-ball))] px-5 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.02] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Go back home
              </Link>

              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/10 cursor-pointer"
              >
                Try again
                <RotateCw className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3 sm:mt-8">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--tennis-ball))]/50">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-[hsl(var(--tennis-ball))]" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3c-2.5 2.5-2.5 15.5 0 18" />
                  <path d="M12 3c2.5 2.5 2.5 15.5 0 18" />
                </svg>
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Thanks for your patience!</p>
                <p className="text-xs text-gray-400">
                  We'll be back in the game shortly.
                </p>
              </div>
            </div>
          </div>

          {/* Feature strip */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-4 sm:gap-x-0 sm:pt-6">
            {[
              { icon: Users, title: "Connect.", text: "Find players & coaches" },
              { icon: CalendarDays, title: "Play.", text: "Join sessions & tournaments" },
              { icon: TrendingUp, title: "Grow.", text: "Track progress & stats" },
              { icon: Trophy, title: "Together.", text: "Stronger tennis community" },
            ].map(({ icon: Icon, title, text }, i) => (
              <div
                key={title}
                className="flex items-center gap-2.5 sm:border-l sm:border-white/10 sm:px-4 sm:first:border-l-0 sm:first:pl-0"
              >
                <Icon className="h-5 w-5 shrink-0 text-[hsl(var(--tennis-ball))]" />
                <div className="leading-tight">
                  <p className="text-xs font-semibold sm:text-sm">{title}</p>
                  <p className="text-[11px] text-gray-400 sm:text-xs">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
