import { useSyncExternalStore } from "react";
import { mockSessionsList } from "./organiser-sessions-mock-data";
import type { SessionListItem } from "./organiser-sessions-mock-data";

const STORAGE_KEY = "tc-organiser-sessions-v3";

function loadInitial(): SessionListItem[] {
  if (typeof window === "undefined") return mockSessionsList;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return mockSessionsList;
    // Full snapshot of every session (baseline mock ones included, once
    // touched) rather than a diff against the baseline catalogue - see
    // the note on persist() below for why that distinction matters.
    return JSON.parse(raw) as SessionListItem[];
  } catch {
    return mockSessionsList;
  }
}

let sessions: SessionListItem[] = loadInitial();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    // Snapshot everything, not just sessions created this "session" -
    // the previous version only persisted sessions whose id wasn't in
    // the static mock catalogue, on the assumption that baseline mock
    // sessions never change. But admin approval/rejection and
    // join/cancel both call updateSession() on ANY session, including
    // the pre-existing mock ones - filtering those out meant an admin
    // approving a baseline session, or a player joining one, silently
    // reverted to the original mock data on the next reload or in any
    // other tab. Persisting the full array is the fix.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage errors (private browsing, quota, etc.) - the
    // session still exists for the rest of this browser session.
  }
}

function notify() {
  listeners.forEach((l) => l());
}

// Cross-tab sync: the admin panel, the wizard, and a profile page are
// realistically open in different tabs at the same time. localStorage
// writes in one tab don't touch another tab's in-memory `sessions`
// variable on their own - the browser's own `storage` event is what
// tells other tabs a write happened elsewhere, so listen for it and
// pull the fresh state in rather than requiring a manual refresh.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    sessions = loadInitial();
    notify();
  });
}

export function getSessions(): SessionListItem[] {
  return sessions;
}

export function subscribeToSessions(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addSession(session: SessionListItem) {
  sessions = [session, ...sessions];
  persist();
  notify();
}

export function updateSession(id: string, patch: Partial<SessionListItem>) {
  sessions = sessions.map((s) => (s.id === id ? { ...s, ...patch } : s));
  persist();
  notify();
}

export function removeSession(id: string) {
  sessions = sessions.filter((s) => s.id !== id);
  persist();
  notify();
}

/** React hook - re-renders whenever the shared sessions list changes. */
export function useOrganiserSessions(): SessionListItem[] {
  return useSyncExternalStore(subscribeToSessions, getSessions, () => mockSessionsList);
}
