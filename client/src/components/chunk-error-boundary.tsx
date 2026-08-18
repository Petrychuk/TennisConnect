import { Component, type ReactNode } from "react";
import Error500 from "@/pages/error-500";

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
      // Statically imported (not lazy) on purpose: if what got us here was
      // a failed chunk fetch, a fallback that itself needs to fetch
      // another chunk could fail the exact same way. This ships in the
      // main bundle so it's always available.
      return <Error500 />;
    }
    return this.props.children;
  }
}
