import { useEffect, useState } from "react";
import tennisBallImg from "/assets/images/tennis-ball.webp";

// Full-size version - centered ball + shadow + text, used as a
// whole-area loading state (profile pages, auth, session pages, etc).
// `text` is optional so existing call sites (<TennisLoader /> with no
// props) keep showing something sensible - only the wording changed
// from a hardcoded "Loading profile…" to a more generic default, since
// this same component is used well beyond just profile pages.
//
// The bounce (squash/stretch + vertical position) and the spin are on
// two separate nested elements deliberately - a single element can't
// run both as CSS animations, since two animations that each set
// `transform` on the same element don't combine, the later one just
// overrides the earlier one's value each frame.
export function TennisLoader({ text = "Loading…" }: { text?: string } = {}) {
  return (
    <div className="tennis-loader-wrapper">
      <div className="tennis-ball-bounce">
        <div className="tennis-ball-spin">
          <img src={tennisBallImg} alt="" className="tennis-ball-img" />
        </div>
        <div className="tennis-ball-shadow" />
      </div>
      {text && <div className="loading-text">{text}</div>}
    </div>
  );
}

// Compact version of the same spinner (no text, no full-page wrapper) for
// inline use inside buttons and other small spaces.
export function TennisBallSpinner({ className = "" }: { className?: string }) {
  return (
    <span className={`tennis-ball-bounce-sm ${className}`}>
      <span className="tennis-ball-spin-sm">
        <img src={tennisBallImg} alt="" className="tennis-ball-img-sm" />
      </span>
    </span>
  );
}
// ---------- Delayed page loader ----------

// Most page loads finish well under a second, so showing the ball straight
// away just made it flash - and, because the full-size loader covers the
// screen, flash on top of an image that had already loaded. Page-level
// loading states therefore wait this long before the ball appears; until
// then only a quiet placeholder (page background, no ball) is shown.
export const PAGE_LOADER_DELAY_MS = 3000;

/** False until `delayMs` has passed since mount, then true. */
export function useDelayElapsed(delayMs: number = PAGE_LOADER_DELAY_MS): boolean {
  const [elapsed, setElapsed] = useState(delayMs <= 0);

  // ---------- Timer ----------
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = window.setTimeout(() => setElapsed(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return elapsed;
}

/**
 * Full-size TennisLoader that only appears if loading takes longer than
 * PAGE_LOADER_DELAY_MS. Before that it renders an empty, accessible
 * placeholder, so fast loads never flash the ball.
 */
export function DelayedTennisLoader({
  text = "Loading…",
  delayMs = PAGE_LOADER_DELAY_MS,
}: { text?: string; delayMs?: number } = {}) {
  const showLoader = useDelayElapsed(delayMs);

  if (!showLoader) {
    return (
      <div className="min-h-[60vh]" aria-busy="true" data-testid="page-loader-pending">
        <span className="sr-only">{text || "Loading…"}</span>
      </div>
    );
  }

  return <TennisLoader text={text} />;
}
