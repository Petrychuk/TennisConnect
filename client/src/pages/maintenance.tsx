import { Facebook, Instagram, Sparkle, ArrowLeft } from "lucide-react";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
//import { ThreadsIcon } from "@/components/icons/ThreadsIcon";
import { Link } from "wouter";
import SEO from "@/components/seo";
import { useAuth } from "@/lib/auth-context";

// Technical "we'll be back soon" placeholder page.
// Shown while the site is between releases / undergoing maintenance.
// Not wired into the router as a site-wide gate - see ReadMe / ask
// engineering if you want every route to redirect here.
export default function Maintenance() {
  const { user } = useAuth();
  const profileHref = user?.role && user?.slug ? `/${user.role}/${user.slug}` : "/";

  return (
    <>
      <SEO
        title="TennisConnect - We're taking a quick break"
        description="TennisConnect is undergoing scheduled maintenance. We'll be back on court shortly."
        canonical="/maintenance"
      />

      <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
        {/* Background photo */}
        <img
          src="/assets/images/maintenance-hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[68%_center] sm:object-center"
        />

        {/* Legibility gradient - darkest bottom-left where the copy sits */}
        <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/55 to-black/20" />
        <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/10 to-transparent" />

        {/* Content
            lg:pl-28 - bigger left indent on desktop only (mobile/tablet
            untouched). Paired with the message block's lg:max-w-xs below,
            this leaves noticeably more open photo/negative space to the
            right on desktop than the previous max-w-lg block did. */}
        <div className="relative z-10 flex min-h-screen flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 lg:pl-28">
          {/* Logo - click returns home */}
          <Link
            href="/"
            className="flex w-fit items-center gap-1 font-display text-xl font-bold sm:text-2xl cursor-pointer"
          >
            Tennis
            <span className="text-[hsl(var(--tennis-ball))]">Connect</span>
            <div className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--tennis-ball))] animate-pulse" />
          </Link>

          {/* Main message */}
          <div className="max-w-lg pb-2 sm:pb-4 lg:max-w-md">
            <span className="inline-block rounded-full border border-[hsl(var(--tennis-ball))]/40 bg-[hsl(var(--tennis-ball))]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--tennis-ball))]">
              Scheduled maintenance
            </span>

            <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl">
              We're taking a quick{" "}
              <span className="text-[hsl(var(--tennis-ball))]">break</span>
            </h1>

            <p className="mt-3 max-w-sm text-sm text-gray-300 sm:mt-4 sm:text-base">
              We're working behind the scenes to make TennisConnect even
              better for you. We'll be back on court shortly! 🎾
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-sm sm:mt-6">
              <Sparkle className="h-4 w-4 shrink-0 text-[hsl(var(--tennis-ball))]" />
              <div className="leading-tight">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">
                  Estimated return
                </p>
                <p className="text-sm font-semibold">We'll be back soon</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-400 sm:mt-5">
              Thanks for your patience and support.
            </p>

            {/* Returns the signed-in user to their profile (or home if
                signed out) - a way off this page, not a real "undo". */}
            <Link
              href={profileHref}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--tennis-ball))] px-4 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02] sm:mt-6"
            >
              <ArrowLeft className="h-4 w-4" />
              {user ? "Back to my profile" : "Back to home"}
            </Link>
          </div>

          {/* Footer bar */}
          <div className="flex flex-col-reverse items-start gap-3 border-t border-white/10 pt-4 text-xs text-white/80 sm:flex-row sm:items-center">
            <span>
              © {new Date().getFullYear()} TennisConnect. All rights reserved.
            </span>

            <div className="flex gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TennisConnect on Facebook"
                className="text-[hsl(var(--tennis-ball))] transition-all hover:scale-110 hover:opacity-80"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TennisConnect on Instagram"
                className="text-[hsl(var(--tennis-ball))] transition-all hover:scale-110 hover:opacity-80"
              >
                <Instagram className="h-4 w-4" />
              </a>
              {/* TikTok/Threads accounts don't exist yet - links point at
                  the platform's homepage as a placeholder until they do. */}
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TennisConnect on TikTok"
                className="text-[hsl(var(--tennis-ball))] transition-all hover:scale-110 hover:opacity-80"
              >
                <TikTokIcon className="h-4 w-4" />
              </a>
              {/* <a
                href="https://threads.net"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TennisConnect on Threads"
                className="text-[hsl(var(--tennis-ball))] transition-all hover:scale-110 hover:opacity-80"
              >
                <ThreadsIcon className="h-4 w-4" />
              </a> */}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}