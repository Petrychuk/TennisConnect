import { useCallback, useEffect, useState } from "react";

export interface OrganizerStatusData {
  isOrganizer: boolean;
  request: {
    id: string;
    status: "pending" | "approved" | "rejected" | "revoked";
  } | null;
}

// Single fetch of /api/organizer/requests/me, shared by the
// "Become an Organizer" card and the "My Sessions" tab so both always
// agree on the same state — e.g. a user who checked "I want to organize
// tennis sessions" at sign-up already has a pending request, so the
// card must show "Pending", never the "Become an Organizer" button.
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

  // Player/coach has shown intent to organize — either by checking the
  // sign-up checkbox, pressing "Become an Organizer" later, or already
  // being approved. Gates the "My Sessions" tab: plain players/coaches
  // who never engaged with organizing don't need it.
  const hasEngagedWithOrganizing = !!data && (data.isOrganizer || data.request !== null);

  return { data, loading, refresh, hasEngagedWithOrganizing };
}
