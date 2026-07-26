import { useSyncExternalStore } from "react";
import { mockSessionsList } from "./organiser-sessions-mock-data";
import type { SessionListItem } from "./organiser-sessions-mock-data";

const STORAGE_KEY = "tc-organiser-sessions-v1";

function loadInitial(): SessionListItem[] {
  if (typeof window === "undefined") return mockSessionsList;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return mockSessionsList;
    const stored = JSON.parse(raw) as SessionListItem[];
    // Merge: stored sessions (created this "session") layered on top of
    // the baseline mock catalogue, de-duplicated by id.
    const storedIds = new Set(stored.map((s) => s.id));
    return [...stored, ...mockSessionsList.filter((s) => !storedIds.has(s.id))];
  } catch {
    return mockSessionsList;
  }
}

let sessions: SessionListItem[] = loadInitial();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    // Only persist sessions not already in the static catalogue, so we're
    // not writing the whole mock list to localStorage every time.
    const baselineIds = new Set(mockSessionsList.map((s) => s.id));
    const created = sessions.filter((s) => !baselineIds.has(s.id));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
  } catch {
    // Ignore storage errors (private browsing, quota, etc.) - the
    // session still exists for the rest of this browser session.
  }
}

function notify() {
  listeners.forEach((l) => l());
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
