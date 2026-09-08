import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

/**
 * Real unread-message count, from the same GET /api/messages/unread-count
 * endpoint the main navbar's own bell badge already uses - every bell
 * icon in the app (navbar, Organiser Hub sidebar, Organiser Hub header)
 * reflects the exact same number, since it's the same query.
 */
export function useUnreadMessagesCount() {
  const { isAuthenticated, clearSession } = useAuth();
  const query = useQuery({
    queryKey: ["/api/messages/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/messages/unread-count", { credentials: "include" });
      if (res.status === 401) {
        // Session died server-side since this query last ran (e.g. a
        // dev-server restart wiped an in-memory session store) - stop
        // presenting as logged in instead of quietly 401ing on this
        // same interval forever. Flipping isAuthenticated to false
        // here is what actually stops the poll (enabled below).
        clearSession();
        return { count: 0 };
      }
      if (!res.ok) return { count: 0 };
      return res.json() as Promise<{ count: number }>;
    },
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  return query.data?.count ?? 0;
}
