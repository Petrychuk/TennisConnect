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