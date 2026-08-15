export function TennisLoader() {
  return (
    <div className="tennis-loader-wrapper">
      <div className="tennis-ball">
        <span className="line line-1" />
        <span className="line line-2" />
      </div>
      <div className="loading-text">Loading profile…</div>
    </div>
  );
}

// Compact version of the same spinner (no text, no full-page wrapper) for
// inline use inside buttons and other small spaces.
export function TennisBallSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`tennis-ball-sm ${className}`}>
      <span className="line line-1" />
      <span className="line line-2" />
    </div>
  );
}