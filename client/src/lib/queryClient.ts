import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log("🌐 API REQUEST:", method, url);

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  console.log("📥 API RESPONSE:", res.status, url);

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * TC-215 / OH-AUDIT-013 — Frontend data freshness:
 *
 * staleTime: 30 000 ms — queries older than 30 s are refetched automatically
 * on the next render or window focus. This replaces the previous Infinity
 * value that caused rosters, reports and rankings to stay frozen until the
 * organiser did a full page reload. 30 s is short enough to pick up another
 * organiser's changes (two-device / two-tab scenarios) and long enough to
 * avoid redundant fetches during normal single-tab navigation.
 *
 * refetchOnWindowFocus: true — when the organiser switches back to TennisConnect
 * from another tab or app, stale queries are refetched so the roster reflects
 * any join/leave/check-in that happened while they were away.
 *
 * Queries that are genuinely static (e.g. seasons) can override locally with
 * a longer staleTime.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
