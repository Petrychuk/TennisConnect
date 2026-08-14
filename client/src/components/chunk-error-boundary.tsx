import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

const RELOAD_FLAG_KEY = "tc_chunk_reload_attempted";

// A lazy-loaded route's JS chunk fails to fetch when the person has an
// old tab open (or just an old cached index.html) from before the last
// deploy - the hashed filename it's asking for no longer exists because
// a new build replaced it. Without this boundary, React just unmounts
// the tree on that throw and the person sees a blank white page.
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return;

    // A full reload fetches the current index.html (never cached - see
    // server/static.ts) and the current chunk manifest, which resolves
    // this transparently almost every time. Only auto-retry once per tab
    // session, so a genuinely broken deploy shows the fallback below
    // instead of reload-looping forever.
    try {
      if (sessionStorage.getItem(RELOAD_FLAG_KEY)) return;
      sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
    } catch {
      // sessionStorage can throw in some locked-down browser contexts -
      // fall through to the manual-reload fallback UI instead.
      return;
    }
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground text-sm mb-6">
              This page failed to load. Reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-full cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
