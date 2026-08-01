import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

/**
 * Real unread-message count, from the same GET /api/messages/unread-count
 * endpoint the main navbar's own bell badge already uses - every bell
 * icon in the app (navbar, Organiser Hub sidebar, Organiser Hub header)
 * reflects the exact same number, since it's the same query.
 */
export function useUnreadMessagesCount() {
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: ["/api/messages/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/messages/unread-count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json() as Promise<{ count: number }>;
    },
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  return query.data?.count ?? 0;
}
