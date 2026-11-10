import { useQuery } from "@tanstack/react-query";

/*
  Is TC Live available here (TC Live v1)? The server decides with
  TC_LIVE_ENABLED (server/lib/liveFeature.ts) and enforces it on every Live
  route; GET /api/organizer/features tells the Hub, so entry points ("Enter
  Live", "Open Live") are hidden instead of leading to a 404.

    off       nowhere
    internal  only for internal test sessions (session.isInternalTest)
    on        every session

  Without a session (e.g. the wizard's notes) only "on" counts. Unknown
  (loading / failed / signed out) = not available. Check-in is NOT part of
  this - it works everywhere from the Session Workspace Players tab.
*/
export type LiveMode = "off" | "internal" | "on";

export const LIVE_FEATURES_QUERY_KEY = ["/api/organizer/features"] as const;

export function useLiveMode(): LiveMode | undefined {
  const features = useQuery({
    queryKey: LIVE_FEATURES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/organizer/features", { credentials: "include" });
      if (!res.ok) return { live: "off" as LiveMode };
      return (await res.json()) as { live: LiveMode };
    },
    staleTime: 60_000,
  });
  return features.data?.live;
}

/** Same rule as the server's liveAllowedFor(). */
export function liveAvailableFor(mode: LiveMode | undefined, session?: { isInternalTest?: boolean | null } | null): boolean {
  if (mode === "on") return true;
  if (mode === "internal") return session?.isInternalTest === true;
  return false;
}

export function useLiveAvailable(session?: { isInternalTest?: boolean | null } | null): boolean {
  return liveAvailableFor(useLiveMode(), session);
}
