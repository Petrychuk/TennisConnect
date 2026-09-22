import { useEffect, useState } from "react";

const STORAGE_KEY = "organiser-sidebar-collapsed";

// Shared across every Organiser Hub page (Home, Sessions, Players,
// Messages, session workspace, new-session wizard) via the same
// localStorage key, so collapsing the sidebar on one page keeps it
// collapsed when navigating to the next one instead of resetting -
// this is specifically for tablet users managing a live session, who
// need the extra width back without re-toggling on every screen.
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return [collapsed, setCollapsed] as const;
}
