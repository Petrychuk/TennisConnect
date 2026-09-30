import { useCallback, useEffect, useState } from "react";

export interface OrganizerStatusData {
  isOrganizer: boolean;
  request: {
    id: string;
    status: "pending" | "approved" | "rejected" | "revoked";
  } | null;
}

// [BUG][ORGANIZER] Was a single fetch on mount only, with no re-check
// afterwards. An admin approving the request (or a coach/player's own
// profile staying open across that approval) never updated this data
// until the page was reloaded — the requester could sit on "Pending"
// indefinitely despite genuinely being approved. useUnreadMessagesCount
// (client/src/hooks/use-unread-messages.ts) already polls every 15s for
// exactly this reason; this hook now does the same, so "Become an
// Organizer" flips to "Open Organiser Hub" on its own, the same way the
// approval notification's unread badge already does.
const POLL_INTERVAL_MS = 15_000;

// Fetch of /api/organizer/requests/me, shared by the "Become an
// Organizer" card and the "My Sessions" tab so both always agree on the
// same state — e.g. a user who checked "I want to organize tennis
// sessions" at sign-up already has a pending request, so the card must
// show "Pending", never the "Become an Organizer" button.
export function useOrganizerStatus(enabled: boolean) {
  const [data, setData] = useState<OrganizerStatusData | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/organizer/requests/me", { credentials: "include" });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // supplementary data — the profile page still works without it
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    // Skip a background tab's polling entirely, not just its rendering —
    // no point spending a request every 15s on a tab nobody is looking
    // at; it'll refresh() again the moment it becomes visible.
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, refresh]);

  // Player/coach has shown intent to organize — either by checking the
  // sign-up checkbox, pressing "Become an Organizer" later, or already
  // being approved. Gates the "My Sessions" tab: plain players/coaches
  // who never engaged with organizing don't need it.
  const hasEngagedWithOrganizing = !!data && (data.isOrganizer || data.request !== null);

  return { data, loading, refresh, hasEngagedWithOrganizing };
}
